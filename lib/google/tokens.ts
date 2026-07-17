import "server-only";

import { eq } from "drizzle-orm";

import { emailThreads, googleAccounts } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "./crypto";
import {
  GoogleAuthError,
  refreshAccessToken,
  revokeToken,
  type GoogleTokens,
} from "./oauth";

/**
 * Storage and lifecycle for Google OAuth tokens.
 *
 * NOTE ON `db` vs `withUserRLS`: every other server module in this app reaches
 * the database through `withUserRLS` so Postgres enforces ownership. This one
 * intentionally uses the trusted `db` client, because `google_accounts` has RLS
 * enabled with no policies — the `authenticated` role can't read it at all, by
 * design (see the schema comment). Ownership is enforced here instead: every
 * exported function takes an `ownerId` that the CALLER must have obtained from
 * `verifySession()`, never from user input.
 */

/** Refresh this long before actual expiry, so an in-flight API call can't race the clock. */
const EXPIRY_SKEW_MS = 60_000;

/** What Settings is allowed to see. Deliberately excludes every token field. */
export type GoogleAccountStatus = {
  connected: boolean;
  email: string | null;
  scope: string | null;
  connectedAt: Date | null;
  /** Null until the first Gmail sweep. Sync is manual, so the UI surfaces this. */
  lastSyncedAt: Date | null;
};

/** Persist a fresh grant, replacing any existing link for this user. */
export async function saveGoogleAccount({
  ownerId,
  googleUserId,
  email,
  tokens,
}: {
  ownerId: string;
  googleUserId: string;
  email: string;
  tokens: GoogleTokens & { refreshToken: string };
}): Promise<void> {
  const row = {
    ownerId,
    googleUserId,
    email,
    accessTokenEnc: encryptToken(tokens.accessToken),
    refreshTokenEnc: encryptToken(tokens.refreshToken),
    accessTokenExpiresAt: expiryFrom(tokens.expiresInSeconds),
    scope: tokens.scope,
    updatedAt: new Date(),
  };

  await db
    .insert(googleAccounts)
    .values(row)
    .onConflictDoUpdate({ target: googleAccounts.ownerId, set: row });
}

/** Status for the Settings UI. Never returns tokens. */
export async function getGoogleAccountStatus(
  ownerId: string,
): Promise<GoogleAccountStatus> {
  const [row] = await db
    .select({
      email: googleAccounts.email,
      scope: googleAccounts.scope,
      createdAt: googleAccounts.createdAt,
      lastSyncedAt: googleAccounts.lastSyncedAt,
    })
    .from(googleAccounts)
    .where(eq(googleAccounts.ownerId, ownerId))
    .limit(1);

  if (!row) {
    return {
      connected: false,
      email: null,
      scope: null,
      connectedAt: null,
      lastSyncedAt: null,
    };
  }

  return {
    connected: true,
    email: row.email,
    scope: row.scope,
    connectedAt: row.createdAt,
    lastSyncedAt: row.lastSyncedAt,
  };
}

/**
 * A usable access token for `ownerId`, refreshing it first if it's expired or
 * about to be. This is the ONLY way the rest of the app should reach a Google
 * token — callers get a bearer string and never touch ciphertext.
 *
 * Returns null when the user has no link. Throws `GoogleAuthError` when the link
 * exists but Google has invalidated it (revoked, password changed, or a Testing-
 * mode refresh token past its 7-day life) — the row is dropped first, so the UI
 * reads as disconnected and the user is prompted to reconnect.
 */
export async function getAccessToken(ownerId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(googleAccounts)
    .where(eq(googleAccounts.ownerId, ownerId))
    .limit(1);

  if (!row) return null;

  const stillFresh =
    row.accessTokenExpiresAt.getTime() - EXPIRY_SKEW_MS > Date.now();
  if (stillFresh) return decryptToken(row.accessTokenEnc);

  const refreshToken = decryptToken(row.refreshTokenEnc);

  let refreshed;
  try {
    refreshed = await refreshAccessToken(refreshToken);
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      // The grant is gone for good — retrying can't fix it. Clear the dead row
      // so Settings stops claiming "Connected" and offers Connect instead.
      //
      // Mirrored `email_threads` are deliberately NOT dropped here, unlike in
      // `disconnectGoogleAccount`. Losing a token is not the same as asking us
      // to forget your mail: in a Testing-mode project refresh tokens expire
      // every 7 days, so deleting here would silently wipe the user's timeline
      // roughly weekly. Reconnecting re-syncs and upserts over what's there.
      await db.delete(googleAccounts).where(eq(googleAccounts.ownerId, ownerId));
    }
    throw e;
  }

  // Two concurrent requests can both refresh here and race to write. That's
  // benign: Google keeps older access tokens valid, both writes are complete
  // rows, and whichever lands last is a working token.
  await db
    .update(googleAccounts)
    .set({
      accessTokenEnc: encryptToken(refreshed.accessToken),
      accessTokenExpiresAt: expiryFrom(refreshed.expiresInSeconds),
      updatedAt: new Date(),
    })
    .where(eq(googleAccounts.ownerId, ownerId));

  return refreshed.accessToken;
}

/**
 * Drop the link and ask Google to forget the grant. Revocation is best-effort —
 * our row goes regardless, so "Disconnect" always works from the user's side.
 *
 * Mirrored Gmail threads go too. "Stop reading my mail" should mean the mail
 * leaves, and keeping them would strand a copy the user can no longer refresh,
 * verify, or re-sync. Hand-written interactions are untouched — they're the
 * user's own writing, in a different table, and were never Google's to take.
 * The delete is inlined rather than imported from ./sync to avoid a cycle
 * (sync depends on getAccessToken above).
 */
export async function disconnectGoogleAccount(ownerId: string): Promise<void> {
  const [row] = await db
    .select({ refreshTokenEnc: googleAccounts.refreshTokenEnc })
    .from(googleAccounts)
    .where(eq(googleAccounts.ownerId, ownerId))
    .limit(1);

  await db.delete(emailThreads).where(eq(emailThreads.ownerId, ownerId));
  await db.delete(googleAccounts).where(eq(googleAccounts.ownerId, ownerId));

  if (!row) return;

  try {
    // Revoking the refresh token also invalidates the access tokens derived from it.
    await revokeToken(decryptToken(row.refreshTokenEnc));
  } catch (e) {
    console.error("Google token revocation failed (link removed locally):", e);
  }
}

function expiryFrom(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}
