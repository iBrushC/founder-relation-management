import "server-only";

import { verifySession } from "@/lib/data/session";
import { isGoogleConfigured } from "@/lib/google/oauth";
import { getGoogleAccountStatus } from "@/lib/google/tokens";

/**
 * Read side of the integrations settings (layer 3, the DAL).
 *
 * `getGoogleAccountStatus` takes an ownerId and trusts it, so the `verifySession`
 * call here is what makes that safe — it's the boundary that turns a request into
 * a proven user id. Never pass a caller-supplied id through this.
 */

/** What the client is allowed to know about a Google link. No tokens, ever. */
export type GoogleIntegration = {
  /** False when GOOGLE_CLIENT_ID/SECRET are unset — the UI disables the row. */
  configured: boolean;
  connected: boolean;
  /** The linked Google account's email, which may differ from the SFRM login. */
  email: string | null;
  connectedAt: string | null;
  /** Null until the first Gmail sync. Sync is manual, so the UI shows staleness. */
  lastSyncedAt: string | null;
};

export async function getGoogleIntegration(): Promise<GoogleIntegration> {
  const { userId } = await verifySession();

  if (!isGoogleConfigured()) {
    return {
      configured: false,
      connected: false,
      email: null,
      connectedAt: null,
      lastSyncedAt: null,
    };
  }

  const status = await getGoogleAccountStatus(userId);

  return {
    configured: true,
    connected: status.connected,
    email: status.email,
    connectedAt: status.connectedAt?.toISOString() ?? null,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
  };
}
