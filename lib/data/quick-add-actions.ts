"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  connections,
  eventParticipants,
  events,
  profiles,
  projectOutreach,
  type EventCategory,
  type Interaction,
} from "@/drizzle/schema";
import { INTERACTION_TYPES, OUTREACH_STATUSES } from "@/lib/data";
import { verifySession } from "@/lib/data/session";
import { withUserRLS } from "@/lib/db/rls";
import { formatInteractionWhen, todayInZone } from "@/lib/data/format";
import { getProfile } from "@/lib/data/profiles";
import { profileExtras } from "@/lib/data/profile-shared";
import { type ActionResult, fail, ok, run } from "@/lib/data/result";
import {
  buildQuickAddContext,
  interpretQuickAdd as interpret,
  type ResolvedPlan,
} from "@/lib/ai/quick-add";
import { OpenRouterError } from "@/lib/ai/openrouter";

/**
 * Server actions for AI Quick Add. Two steps, mirroring the UI flow:
 *
 *   1. `interpretQuickAdd(text)` — call the model and resolve a previewable plan.
 *   2. `applyQuickAdd(plan)`      — after the user confirms, write it.
 *
 * The plan round-trips through the untrusted client, so `applyQuickAdd`
 * re-validates its shape (uuids, enums, caps) before executing. All writes run
 * through `withUserRLS`, so a tampered id can only ever reference the caller's
 * own rows. There is no delete path — the vocabulary can only add or edit.
 */

const MAX_TEXT = 500;

/** The signed-in user's saved IANA timezone (Settings → About), if any. */
async function userTimeZone(): Promise<string | undefined> {
  return profileExtras(await getProfile()).timezone;
}

/** Interpret one line into a resolved plan for preview. Never writes. */
export async function interpretQuickAdd(
  text: string,
): Promise<ActionResult<ResolvedPlan>> {
  await verifySession();
  const clean = (text ?? "").trim();
  if (!clean) return fail("Type something to add.");
  if (clean.length > MAX_TEXT) return fail("That's a bit long — try a shorter note.");

  try {
    const [ctx, today] = await Promise.all([
      buildQuickAddContext(),
      userTimeZone().then(todayInZone),
    ]);
    const plan = await interpret(clean, ctx, today);
    return ok(plan);
  } catch (e) {
    console.error(e);
    if (e instanceof OpenRouterError) {
      return fail("Quick Add isn't available right now — check the AI configuration.");
    }
    return fail("Something went wrong reading that. Please try again.");
  }
}

/* ------------------------------------------------------------------ */
/*  Plan validation (client-supplied → trust boundary)                 */
/* ------------------------------------------------------------------ */

const zUuid = z.uuid();

const zStep = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create_connection"),
    name: z.string().min(1).max(200),
    role: z.string().max(200).optional(),
    company: z.string().max(200).optional(),
    email: z.string().max(320).optional(),
    summary: z.string(),
  }),
  z.object({
    kind: z.literal("log_interaction"),
    connectionId: zUuid.nullable(),
    personName: z.string().min(1).max(200),
    type: z.enum(INTERACTION_TYPES),
    note: z.string().max(500).optional(),
    date: z.string().max(20).optional(),
    summary: z.string(),
  }),
  z.object({
    kind: z.literal("link_event_person"),
    connectionId: zUuid.nullable(),
    personName: z.string().min(1).max(200),
    eventId: zUuid.nullable(),
    eventName: z.string().min(1).max(200),
    eventDate: z.string().max(20).optional(),
    summary: z.string(),
  }),
  z.object({
    kind: z.literal("create_event"),
    name: z.string().min(1).max(200),
    date: z.string().max(20).optional(),
    location: z.string().max(200).optional(),
    summary: z.string(),
  }),
  z.object({
    kind: z.literal("set_outreach_status"),
    outreachId: zUuid,
    projectId: zUuid,
    recipientLabel: z.string().max(200),
    status: z.enum(OUTREACH_STATUSES),
    summary: z.string(),
  }),
  z.object({ kind: z.literal("clarify"), question: z.string() }),
  z.object({ kind: z.literal("noop"), summary: z.string() }),
]);

const zPlan = z.object({ steps: z.array(zStep).max(10) });

/* ------------------------------------------------------------------ */
/*  Apply                                                              */
/* ------------------------------------------------------------------ */

/** Keep a valid ISO date, else fall back to the caller's "today". */
function isoDate(d: string | undefined, fallbackIso: string): string {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallbackIso;
}

/** Best-effort event category from its name (mirrors the seeder's heuristic). */
function categoryFor(name: string): EventCategory {
  const n = name.toLowerCase();
  if (n.includes("demo day")) return "demo_day";
  if (n.includes("mixer")) return "mixer";
  if (n.includes("meetup")) return "meetup";
  if (n.includes("info session")) return "info_session";
  if (n.includes("office hours")) return "meeting";
  return "other";
}

/**
 * Execute a confirmed plan in one transaction, creating any referenced-but-new
 * people/events so ids resolve. Returns the human-readable lines that were
 * actually applied.
 */
export async function applyQuickAdd(
  plan: ResolvedPlan,
): Promise<ActionResult<{ applied: string[] }>> {
  const user = await verifySession();
  const parsed = zPlan.safeParse(plan);
  if (!parsed.success) return fail("That action couldn't be applied.");

  const steps = parsed.data.steps;
  if (steps.some((s) => s.kind === "clarify")) {
    return fail("Please resolve the question first.");
  }
  if (!steps.some((s) => s.kind !== "noop")) return fail("Nothing to add.");

  const ownerId = user.userId;
  // "Today" for any step the model left undated — in the user's own timezone.
  const todayIso = todayInZone(await userTimeZone()).iso;

  const result = await run(async () => {
    const applied: string[] = [];

    await withUserRLS(async (tx) => {
      // Every owner_id references a profile row — make sure it exists.
      await tx
        .insert(profiles)
        .values({ id: ownerId, email: user.email })
        .onConflictDoNothing();

      const newConnection = async (name: string): Promise<string> => {
        const [row] = await tx
          .insert(connections)
          .values({ ownerId, name: name.trim() })
          .returning({ id: connections.id });
        return row.id;
      };

      for (const step of steps) {
        switch (step.kind) {
          case "noop":
            break;

          case "create_connection": {
            await tx.insert(connections).values({
              ownerId,
              name: step.name.trim(),
              role: step.role?.trim() || null,
              company: step.company?.trim() || null,
              email: step.email?.trim() || null,
            });
            applied.push(step.summary);
            break;
          }

          case "log_interaction": {
            const connectionId = step.connectionId ?? (await newConnection(step.personName));
            const date = isoDate(step.date, todayIso);
            const entry: Interaction = {
              label: step.note?.trim() ?? "",
              when: formatInteractionWhen(date) ?? "Just now",
              type: step.type,
              date,
            };
            const [existing] = await tx
              .select({ interactions: connections.interactions })
              .from(connections)
              .where(eq(connections.id, connectionId));
            if (existing) {
              await tx
                .update(connections)
                .set({ interactions: [entry, ...(existing.interactions ?? [])] })
                .where(eq(connections.id, connectionId));
              applied.push(step.summary);
            }
            break;
          }

          case "link_event_person": {
            const connectionId = step.connectionId ?? (await newConnection(step.personName));
            let eventId = step.eventId;
            if (!eventId) {
              const [row] = await tx
                .insert(events)
                .values({
                  ownerId,
                  name: step.eventName.trim(),
                  category: categoryFor(step.eventName),
                  eventDate: isoDate(step.eventDate, todayIso),
                })
                .returning({ id: events.id });
              eventId = row.id;
            }
            await tx
              .insert(eventParticipants)
              .values({ ownerId, eventId, connectionId })
              .onConflictDoNothing();
            applied.push(step.summary);
            break;
          }

          case "create_event": {
            await tx.insert(events).values({
              ownerId,
              name: step.name.trim(),
              category: categoryFor(step.name),
              eventDate: isoDate(step.date, todayIso),
              location: step.location?.trim() || null,
            });
            applied.push(step.summary);
            break;
          }

          case "set_outreach_status": {
            await tx
              .update(projectOutreach)
              .set({ status: step.status })
              .where(eq(projectOutreach.id, step.outreachId));
            applied.push(step.summary);
            break;
          }
        }
      }
    });

    return { applied };
  });

  if (result.ok) {
    revalidatePath("/connections");
    revalidatePath("/events");
    revalidatePath("/projects");
    revalidatePath("/", "layout");
  }
  return result;
}
