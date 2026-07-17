"use server";

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/data/session";
import { type ActionResult, run } from "@/lib/data/result";
import { disconnectGoogleAccount } from "@/lib/google/tokens";

/**
 * Client-callable writes for the Settings "Integrations" section.
 *
 * Connecting is not here: OAuth needs a real browser redirect to Google's
 * consent screen, which a server action can't do from a fetch — that's the
 * `/api/integrations/google/connect` route handler instead. Disconnecting is a
 * plain mutation, so it stays an action.
 *
 * As a `"use server"` module this may only export async functions.
 */

/** Unlink Google and revoke the grant. Takes no id — the session decides whose. */
export async function disconnectGoogle(): Promise<ActionResult> {
  const { userId } = await verifySession();
  return run(async () => {
    await disconnectGoogleAccount(userId);
    // Unlinking also removes every mirrored Gmail thread, so connection
    // timelines (and the "last contact" labels derived from them) are stale.
    revalidatePath("/connections");
    revalidatePath("/");
  });
}
