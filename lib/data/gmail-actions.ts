"use server";

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/data/session";
import { fail, ok, type ActionResult } from "@/lib/data/result";
import { GmailError } from "@/lib/google/gmail";
import { GoogleAuthError } from "@/lib/google/oauth";
import { syncGmail, type SyncSummary } from "@/lib/google/sync";

/**
 * Client-callable Gmail sync for the Settings integrations row.
 *
 * Takes no arguments on purpose: the session decides whose mailbox is read, so
 * there's no id a caller could tamper with.
 *
 * This doesn't use the shared `run()` helper. `run` flattens every throw into
 * one generic message, and the three ways a sync fails need to be told apart —
 * a dead grant means "reconnect", a Gmail error means "try again", and neither
 * should read as a bug. Failures are still caught and mapped here, so the
 * ActionResult contract holds.
 */
export async function syncGmailNow(): Promise<ActionResult<SyncSummary>> {
  const { userId } = await verifySession();

  try {
    const summary = await syncGmail(userId);

    if (!summary) {
      return fail("Connect your Google account first.");
    }

    // Synced mail shows up in the connection timeline, and a connection's
    // "last contact" label is derived from it — so both surfaces are stale now.
    revalidatePath("/connections");
    revalidatePath("/");

    return ok(summary);
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      // Two paths reach here. The common one is a refresh token Google no longer
      // honours (revoked, password changed, or aged out of a Testing-mode
      // project after 7 days) — `getAccessToken` has already dropped that row,
      // so the UI re-reads as disconnected. The rarer one is Gmail 401ing a
      // token that had just refreshed cleanly, which leaves the row in place.
      // Either way retrying can't help and re-consent can, so both say so.
      return fail("Google access has expired. Please reconnect your account.");
    }
    if (e instanceof GmailError) {
      console.error("Gmail sync failed:", e);
      return fail("Gmail couldn't be reached. Please try again in a moment.");
    }
    console.error("Gmail sync failed:", e);
    return fail("Something went wrong syncing Gmail. Please try again.");
  }
}
