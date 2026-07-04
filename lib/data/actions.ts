"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import {
  connections,
  eventParticipants,
  events,
  profiles,
  projectParticipants,
  projectStages,
  projectTasks,
  projects,
  type EventCategory,
  type Subtask,
} from "@/drizzle/schema";
import {
  me,
  connections as demoConnections,
  events as demoEvents,
  projects as demoProjects,
} from "@/lib/data";
import { verifySession } from "@/lib/data/session";
import { withUserRLS } from "@/lib/db/rls";
import { monthDayToIso } from "./format";

/**
 * Write side of the CRM data layer: the "Load sample data" seeder plus the
 * handful of basic mutations wired to the UI's primary buttons. Everything runs
 * through `withUserRLS`, and each write first ensures the caller has a `profiles`
 * row (every table's `owner_id` references it).
 */

type Tx = Parameters<Parameters<typeof withUserRLS>[0]>[0];

/** Placeholder year for birthdays — only the month/day is ever shown. */
const BIRTH_YEAR = 2000;

/** Idempotently make sure the signed-in user has a profile row to own data. */
async function ensureProfile(
  tx: Tx,
  user: { userId: string; email: string },
  fullName?: string,
) {
  await tx
    .insert(profiles)
    .values({ id: user.userId, email: user.email, fullName: fullName ?? null })
    .onConflictDoNothing();
  if (fullName) {
    await tx.update(profiles).set({ fullName }).where(eq(profiles.id, user.userId));
  }
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Turn a demo `when` label ("in 5 days" / "Jul 12") into a concrete ISO date. */
function whenToIso(when: string): string {
  const now = new Date();
  const rel = when.match(/^in (\d+) days?$/i);
  if (rel) {
    return isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + Number(rel[1])));
  }
  return monthDayToIso(when, now.getFullYear()) ?? isoOf(now);
}

/** Best-effort event category from its name (only affects the updates feed). */
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
 * Fill the signed-in user's account with the Maya Chen sample dataset (the same
 * data the prototype used to hard-code). Wipes any existing CRM rows first so the
 * button is safe to click more than once. Runs in one transaction.
 */
export async function seedSampleData(): Promise<{ ok: true }> {
  const user = await verifySession();
  const nowIso = new Date().toISOString();
  const dueYear = new Date().getFullYear();

  await withUserRLS(async (tx) => {
    await ensureProfile(tx, user, me.name);

    // Clear first (children cascade from these three parents).
    await tx.delete(events);
    await tx.delete(projects);
    await tx.delete(connections);

    // Connections — keep a slug → new-uuid map to wire up the relations below.
    const idBySlug = new Map<string, string>();
    for (const c of demoConnections) {
      const [row] = await tx
        .insert(connections)
        .values({
          ownerId: user.userId,
          name: c.name,
          role: c.role || null,
          company: c.company || null,
          avatarTone: c.avatarTone,
          email: c.email || null,
          phone: c.phone || null,
          location: c.location || null,
          birthday: monthDayToIso(c.birthday, BIRTH_YEAR),
          tags: c.tags,
          interactions: c.timeline,
          notes: c.note
            ? [{ id: randomUUID(), body: c.note, createdAt: nowIso }]
            : [],
        })
        .returning({ id: connections.id });
      idBySlug.set(c.id, row.id);
    }

    // Projects + their tasks, stages, and participants.
    for (const p of demoProjects) {
      const [row] = await tx
        .insert(projects)
        .values({
          ownerId: user.userId,
          name: p.name,
          icon: p.icon,
          tone: p.tone,
          summary: p.summary || null,
          description: p.description || null,
          statusLabel: p.status.label,
          statusTone: p.status.tone,
          tags: [],
        })
        .returning({ id: projects.id });

      for (const [i, t] of p.tasks.entries()) {
        await tx.insert(projectTasks).values({
          ownerId: user.userId,
          projectId: row.id,
          label: t.label,
          done: t.done,
          dueDate: t.due ? monthDayToIso(t.due, dueYear) : null,
          description: t.description ?? null,
          subtasks: t.subtasks ?? [],
          position: i,
        });
      }
      for (const [i, ph] of p.phases.entries()) {
        await tx.insert(projectStages).values({
          ownerId: user.userId,
          projectId: row.id,
          label: ph.label,
          tone: ph.tone,
          startDate: ph.start,
          endDate: ph.end,
          position: i,
        });
      }
      for (const cid of p.connectionIds) {
        const connectionId = idBySlug.get(cid);
        if (connectionId) {
          await tx.insert(projectParticipants).values({
            ownerId: user.userId,
            projectId: row.id,
            connectionId,
          });
        }
      }
    }

    // Events + the people met at each.
    for (const e of demoEvents) {
      const [row] = await tx
        .insert(events)
        .values({
          ownerId: user.userId,
          name: e.name,
          category: categoryFor(e.name),
          eventDate: whenToIso(e.when),
          location: e.where || null,
          organizers: e.organizers,
          metGuests: e.metGuests ?? [],
          note: e.note || null,
          avatarTone: e.avatarTone,
        })
        .returning({ id: events.id });

      for (const cid of e.metIds) {
        const connectionId = idBySlug.get(cid);
        if (connectionId) {
          await tx.insert(eventParticipants).values({
            ownerId: user.userId,
            eventId: row.id,
            connectionId,
          });
        }
      }
    }
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Basic mutations wired to the UI's primary buttons                  */
/* ------------------------------------------------------------------ */

/** Toggle a task's done state (task-list checkbox). */
export async function toggleTask(
  taskId: string,
  done: boolean,
  projectId?: string,
): Promise<void> {
  await withUserRLS((tx) =>
    tx.update(projectTasks).set({ done }).where(eq(projectTasks.id, taskId)),
  );
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

/** Persist a task's checklist after a subtask is toggled. */
export async function updateSubtasks(
  taskId: string,
  subtasks: Subtask[],
  projectId?: string,
): Promise<void> {
  await withUserRLS((tx) =>
    tx.update(projectTasks).set({ subtasks }).where(eq(projectTasks.id, taskId)),
  );
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createConnection(input: {
  name: string;
  role?: string;
  company?: string;
  email?: string;
}): Promise<void> {
  const user = await verifySession();
  const name = input.name.trim();
  if (!name) return;

  await withUserRLS(async (tx) => {
    await ensureProfile(tx, user);
    await tx.insert(connections).values({
      ownerId: user.userId,
      name,
      role: input.role?.trim() || null,
      company: input.company?.trim() || null,
      email: input.email?.trim() || null,
    });
  });
  revalidatePath("/connections");
  revalidatePath("/");
}

export async function createEvent(input: {
  name: string;
  eventDate: string;
  location?: string;
}): Promise<void> {
  const user = await verifySession();
  const name = input.name.trim();
  if (!name || !input.eventDate) return;

  await withUserRLS(async (tx) => {
    await ensureProfile(tx, user);
    await tx.insert(events).values({
      ownerId: user.userId,
      name,
      category: categoryFor(name),
      eventDate: input.eventDate,
      location: input.location?.trim() || null,
    });
  });
  revalidatePath("/events");
  revalidatePath("/");
}

export async function createProject(input: {
  name: string;
  summary?: string;
}): Promise<void> {
  const user = await verifySession();
  const name = input.name.trim();
  if (!name) return;

  await withUserRLS(async (tx) => {
    await ensureProfile(tx, user);
    await tx.insert(projects).values({
      ownerId: user.userId,
      name,
      summary: input.summary?.trim() || null,
      statusLabel: "Active",
      statusTone: "green",
    });
  });
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function removeConnection(id: string): Promise<void> {
  await withUserRLS((tx) => tx.delete(connections).where(eq(connections.id, id)));
  revalidatePath("/connections");
  revalidatePath("/");
}

export async function removeEvent(id: string): Promise<void> {
  await withUserRLS((tx) => tx.delete(events).where(eq(events.id, id)));
  revalidatePath("/events");
  revalidatePath("/");
}
