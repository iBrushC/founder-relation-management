"use server";

import { revalidatePath } from "next/cache";

import { profiles } from "@/drizzle/schema";
import { verifySession } from "@/lib/data/session";
import { withUserRLS } from "@/lib/db/rls";
import { todayInZone } from "@/lib/data/format";
import { getProfile } from "@/lib/data/profiles";
import { profileExtras } from "@/lib/data/profile-shared";
import { planAllowsQuickAdd, resolvePlan } from "@/lib/data/billing";
import { type ActionResult, fail, ok } from "@/lib/data/result";
import { runQuickAdd as runAgent, type QuickAddResult } from "@/lib/ai/quick-add";
import { OpenRouterError } from "@/lib/ai/openrouter";

/**
 * Server action for AI Quick Add.
 *
 * `runQuickAdd(text)` hands the line to an agentic tool loop (lib/ai/quick-add):
 * the model reads and writes the signed-in user's CRM through tools, each call
 * running under `withUserRLS` so it can only ever touch that user's own rows.
 * Reads and writes happen live — there is no separate preview/confirm step — and
 * the toolset can only add or edit, never delete. We return the lines that were
 * written plus the model's closing message, and revalidate the affected pages.
 */

const MAX_TEXT = 500;

/** The signed-in user's saved IANA timezone (Settings → About), if any. */
async function userTimeZone(): Promise<string | undefined> {
  return profileExtras(await getProfile()).timezone;
}

/** Ensure the owner's profile row exists — every `owner_id` references it. */
async function ensureProfile(id: string, email: string): Promise<void> {
  await withUserRLS((tx) =>
    tx.insert(profiles).values({ id, email }).onConflictDoNothing(),
  );
}

/** Interpret one line and file it via the agent. Writes the user's own rows. */
export async function runQuickAdd(
  text: string,
): Promise<ActionResult<QuickAddResult>> {
  const user = await verifySession();
  const clean = (text ?? "").trim();
  if (!clean) return fail("Type something to add.");
  if (clean.length > MAX_TEXT) return fail("That's a bit long — try a shorter note.");

  // Plan gate — runs before any DB read (including the dedupe lookups) so a
  // free user can't probe the CRM through Quick Add's read tools either.
  const plan = resolvePlan((await getProfile())?.settings);
  if (!planAllowsQuickAdd(plan)) {
    return fail(
      "Quick Add is available on the Quick and Grow plans. Upgrade in Settings to keep going.",
    );
  }

  try {
    const today = todayInZone(await userTimeZone());
    await ensureProfile(user.userId, user.email);

    const result = await runAgent(clean, {
      ownerId: user.userId,
      email: user.email,
      today,
    });

    if (result.applied.length > 0) {
      revalidatePath("/connections");
      revalidatePath("/events");
      revalidatePath("/projects");
      revalidatePath("/", "layout");
    }
    return ok(result);
  } catch (e) {
    console.error(e);
    if (e instanceof OpenRouterError) {
      return fail("Quick Add isn't available right now — check the AI configuration.");
    }
    return fail("Something went wrong reading that. Please try again.");
  }
}
