import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Google OAuth 2.0 — endpoints, config, and the raw HTTP exchanges.
 *
 * This is a direct authorization-code flow rather than Supabase's Google
 * provider. Supabase's social login is built to *authenticate* a user; it does
 * not durably hand us the provider refresh token, and SFRM needs offline access
 * (reading mail on the user's behalf) long after the sign-in that granted it.
 * Supabase Auth remains the only identity system — Google here is purely a
 * linked data source. Token *storage* lives in ./tokens.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/** The path Google redirects back to. Must match the Cloud Console entry byte-for-byte. */
export const GOOGLE_CALLBACK_PATH = "/api/integrations/google/callback";

/**
 * What we ask the user to grant.
 *
 * `gmail.readonly` is a RESTRICTED scope: past 100 users it requires Google app
 * verification plus an annual third-party CASA security assessment. Until then
 * the Cloud project must stay in Testing mode with each user added as a test
 * user — anyone else gets "access blocked" at the consent screen.
 *
 * If read-only proves broader than needed, `gmail.metadata` (headers only, no
 * bodies) is still restricted but a materially easier verification story. It is
 * enough to log *that* two people corresponded and when, which may be all the
 * CRM timeline actually needs.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Read and validate OAuth env. Throws rather than limping along with a partial
 * config — a half-configured OAuth client fails at Google with an opaque error.
 */
export function googleConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set (see .env.local).",
    );
  }

  return { clientId, clientSecret, redirectUri: redirectUri() };
}

/** True when Google linking is configured at all — lets the UI hide the row instead of erroring. */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * The redirect URI, derived from one env var so dev/preview/prod can't drift
 * apart. Never derived from the request's Host header: that's attacker-supplied,
 * and it decides where an authorization code gets delivered.
 */
function redirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}${GOOGLE_CALLBACK_PATH}`;
}

/* ------------------------------------------------------------------ */
/*  PKCE + state                                                       */
/* ------------------------------------------------------------------ */

/**
 * PKCE, even though this is a confidential client holding a secret. It costs one
 * hash and closes authorization-code injection — Google recommends it for web
 * server apps too.
 */
export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Opaque CSRF token tying the callback to the browser that started the flow. */
export function createState(): string {
  return randomBytes(32).toString("base64url");
}

/* ------------------------------------------------------------------ */
/*  Flow steps                                                         */
/* ------------------------------------------------------------------ */

/** Build the Google consent URL to send the user to. */
export function buildAuthUrl({
  state,
  codeChallenge,
  loginHint,
}: {
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const { clientId, redirectUri } = googleConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // offline + consent: Google returns a refresh_token only on the FIRST consent
    // unless we force the prompt. Without this, a user who reconnects gets an
    // access token and no refresh token, and the link silently dies in an hour.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  // Pre-fills the account chooser with their SFRM email. A hint only — the user
  // can still pick a different Google account, which is why we store whatever
  // `sub`/email actually comes back rather than assuming it matches.
  if (loginHint) params.set("login_hint", loginHint);

  return `${AUTH_ENDPOINT}?${params}`;
}

export type GoogleTokens = {
  accessToken: string;
  /** Absent when Google decides consent was already granted — see callers. */
  refreshToken?: string;
  expiresInSeconds: number;
  scope: string;
};

/** Exchange the one-time authorization code for tokens. */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = googleConfig();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${describeError(res.status, json)}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
    scope: json.scope ?? "",
  };
}

/** Trade a refresh token for a fresh access token. Google does not return a new refresh token here. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<Omit<GoogleTokens, "refreshToken">> {
  const { clientId, clientSecret } = googleConfig();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // `invalid_grant` means the user revoked access, changed their password, or
    // the token aged out of a Testing-mode project (7 days). The link is dead;
    // callers surface it as "reconnect" rather than retrying.
    throw new GoogleAuthError(describeError(res.status, json), json?.error);
  }

  return {
    accessToken: json.access_token,
    expiresInSeconds: json.expires_in,
    scope: json.scope ?? "",
  };
}

/** The Google account behind a token — used to label the connection in Settings. */
export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<{ sub: string; email: string }> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Google userinfo failed: ${res.status}`);

  const json = await res.json();
  return { sub: json.sub, email: json.email ?? "" };
}

/**
 * Tell Google to forget the grant. Best-effort: we still drop our row even if
 * this fails, so a user can always disconnect from our side.
 */
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
  });
}

/** Raised when Google says the grant itself is no longer valid. */
export class GoogleAuthError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

function describeError(status: number, json: unknown): string {
  const body = json as { error?: string; error_description?: string } | null;
  const detail = body?.error_description ?? body?.error;
  return detail ? `${status} ${detail}` : `HTTP ${status}`;
}
