"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import {
  connections,
  eventParticipants,
  events,
  profiles,
  projectOutreach,
  projectParticipants,
  projectStages,
  projectTasks,
  projects,
  type ConnectionNote,
  type EventCategory,
  type ExtraField,
  type Interaction,
  type Subtask,
  type Tag,
  type Tone,
} from "@/drizzle/schema";
import type { OutreachStatus } from "@/lib/data";
import {
  me,
  connections as demoConnections,
  events as demoEvents,
  projects as demoProjects,
  type Connection,
} from "@/lib/data";
import { verifySession } from "@/lib/data/session";
import { withUserRLS } from "@/lib/db/rls";
import { monthDayToIso } from "./format";
import { toConnection } from "./mappers";

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
          linkedin: c.linkedin || null,
          birthday: monthDayToIso(c.birthday, BIRTH_YEAR),
          tags: c.tags,
          interactions: c.timeline,
          notes: c.note
            ? [{ id: randomUUID(), body: c.note, createdAt: nowIso }]
            : [],
          extraFields: c.extraFields,
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
      for (const [i, o] of p.outreach.entries()) {
        await tx.insert(projectOutreach).values({
          ownerId: user.userId,
          projectId: row.id,
          connectionId: o.connectionId ? idBySlug.get(o.connectionId) ?? null : null,
          label: o.label,
          channel: o.channel || null,
          email: o.email || null,
          phone: o.phone || null,
          website: o.website || null,
          status: o.status,
          lastContacted: o.lastContacted || null,
          followUpAt: o.followUpAt || null,
          notes: o.notes || null,
          position: i,
        });
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

/* ------------------------------------------------------------------ */
/*  Edits — in-place updates to existing rows                          */
/* ------------------------------------------------------------------ */

/** Trim a string; treat empty/whitespace as "cleared" (null in the DB). */
function orNull(s: string | undefined | null): string | null {
  const t = s?.trim();
  return t ? t : null;
}

/**
 * Update a connection's editable fields. Tags and avatar tone are set from the
 * inline panel; birthday arrives as an ISO date (or null to clear). Timeline and
 * notes have their own actions below since they're read-modify-write on JSONB.
 */
export async function updateConnection(
  id: string,
  patch: {
    name: string;
    role?: string;
    company?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    birthday?: string | null;
    tags?: Tag[];
    avatarTone?: Tone;
    extraFields?: ExtraField[];
  },
): Promise<void> {
  const name = patch.name.trim();
  if (!name) return;

  await withUserRLS((tx) =>
    tx
      .update(connections)
      .set({
        name,
        role: orNull(patch.role),
        company: orNull(patch.company),
        email: orNull(patch.email),
        phone: orNull(patch.phone),
        location: orNull(patch.location),
        linkedin: orNull(patch.linkedin),
        birthday: patch.birthday ?? null,
        ...(patch.tags ? { tags: patch.tags } : {}),
        ...(patch.avatarTone ? { avatarTone: patch.avatarTone } : {}),
        ...(patch.extraFields ? { extraFields: patch.extraFields } : {}),
      })
      .where(eq(connections.id, id)),
  );
  revalidatePath("/connections");
  revalidatePath("/");
}

/** Prepend one entry to a connection's interaction timeline (most-recent first). */
export async function logInteraction(
  connectionId: string,
  interaction: Interaction,
): Promise<void> {
  const label = interaction.label.trim();
  if (!label) return;
  const when = interaction.when.trim() || "Just now";

  await withUserRLS(async (tx) => {
    const [row] = await tx
      .select({ interactions: connections.interactions })
      .from(connections)
      .where(eq(connections.id, connectionId));
    if (!row) return;
    await tx
      .update(connections)
      .set({ interactions: [{ label, when }, ...(row.interactions ?? [])] })
      .where(eq(connections.id, connectionId));
  });
  revalidatePath("/connections");
  revalidatePath("/");
}

/** Replace a connection's whole timeline (used to edit/reorder/delete entries). */
export async function updateInteractions(
  connectionId: string,
  interactions: Interaction[],
): Promise<void> {
  await withUserRLS((tx) =>
    tx
      .update(connections)
      .set({ interactions })
      .where(eq(connections.id, connectionId)),
  );
  revalidatePath("/connections");
  revalidatePath("/");
}

/**
 * Upsert a connection's single visible note. The UI edits one note; an empty
 * body clears it. Preserves the existing note's id/createdAt when present.
 */
export async function updateConnectionNote(
  connectionId: string,
  body: string,
): Promise<void> {
  const text = body.trim();

  await withUserRLS(async (tx) => {
    const [row] = await tx
      .select({ notes: connections.notes })
      .from(connections)
      .where(eq(connections.id, connectionId));
    if (!row) return;

    const existing = row.notes?.[0];
    const notes: ConnectionNote[] = !text
      ? []
      : [
          {
            id: existing?.id ?? randomUUID(),
            body: text,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
          },
        ];
    await tx
      .update(connections)
      .set({ notes })
      .where(eq(connections.id, connectionId));
  });
  revalidatePath("/connections");
  revalidatePath("/");
}

/** Update an event's editable fields. Date is required; the rest may clear. */
export async function updateEvent(
  id: string,
  patch: {
    name: string;
    eventDate: string;
    location?: string;
    organizers?: string[];
    metGuests?: string[];
    note?: string;
    avatarTone?: Tone;
  },
): Promise<void> {
  const name = patch.name.trim();
  if (!name || !patch.eventDate) return;

  await withUserRLS((tx) =>
    tx
      .update(events)
      .set({
        name,
        category: categoryFor(name),
        eventDate: patch.eventDate,
        location: orNull(patch.location),
        note: orNull(patch.note),
        ...(patch.organizers ? { organizers: patch.organizers } : {}),
        ...(patch.metGuests ? { metGuests: patch.metGuests } : {}),
        ...(patch.avatarTone ? { avatarTone: patch.avatarTone } : {}),
      })
      .where(eq(events.id, id)),
  );
  revalidatePath("/events");
  revalidatePath("/");
}

/** Update a project's editable fields (header + presentation). */
export async function updateProject(
  id: string,
  patch: {
    name: string;
    summary?: string;
    description?: string;
    statusLabel?: string;
    statusTone?: Tone;
    icon?: string;
    tone?: Tone;
  },
): Promise<void> {
  const name = patch.name.trim();
  if (!name) return;

  await withUserRLS((tx) =>
    tx
      .update(projects)
      .set({
        name,
        summary: orNull(patch.summary),
        description: orNull(patch.description),
        statusLabel: orNull(patch.statusLabel),
        ...(patch.statusTone ? { statusTone: patch.statusTone } : {}),
        ...(patch.icon ? { icon: patch.icon } : {}),
        ...(patch.tone ? { tone: patch.tone } : {}),
      })
      .where(eq(projects.id, id)),
  );
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function removeProject(id: string): Promise<void> {
  await withUserRLS((tx) => tx.delete(projects).where(eq(projects.id, id)));
  revalidatePath("/projects");
  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/*  Project tasks                                                       */
/* ------------------------------------------------------------------ */

/** Append a task to a project (new tasks sort to the end). */
export async function createTask(
  projectId: string,
  input: { label: string; dueDate?: string | null; description?: string },
): Promise<void> {
  const user = await verifySession();
  const label = input.label.trim();
  if (!label) return;

  await withUserRLS(async (tx) => {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(projectTasks)
      .where(eq(projectTasks.projectId, projectId));
    await tx.insert(projectTasks).values({
      ownerId: user.userId,
      projectId,
      label,
      dueDate: input.dueDate ?? null,
      description: orNull(input.description),
      position: count,
    });
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

/** Edit a task's label, due date, and/or description. */
export async function updateTask(
  taskId: string,
  patch: { label?: string; dueDate?: string | null; description?: string },
  projectId?: string,
): Promise<void> {
  const set: Partial<{
    label: string;
    dueDate: string | null;
    description: string | null;
  }> = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) return;
    set.label = label;
  }
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate ?? null;
  if (patch.description !== undefined) set.description = orNull(patch.description);
  if (Object.keys(set).length === 0) return;

  await withUserRLS((tx) =>
    tx.update(projectTasks).set(set).where(eq(projectTasks.id, taskId)),
  );
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function removeTask(
  taskId: string,
  projectId?: string,
): Promise<void> {
  await withUserRLS((tx) =>
    tx.delete(projectTasks).where(eq(projectTasks.id, taskId)),
  );
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/*  Project participants (linked people)                               */
/* ------------------------------------------------------------------ */

/** Link an existing connection to a project. Idempotent on the composite PK. */
export async function linkParticipant(
  projectId: string,
  connectionId: string,
  role?: string,
): Promise<void> {
  const user = await verifySession();
  await withUserRLS((tx) =>
    tx
      .insert(projectParticipants)
      .values({
        ownerId: user.userId,
        projectId,
        connectionId,
        role: orNull(role),
      })
      .onConflictDoNothing(),
  );
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function unlinkParticipant(
  projectId: string,
  connectionId: string,
): Promise<void> {
  await withUserRLS((tx) =>
    tx
      .delete(projectParticipants)
      .where(
        and(
          eq(projectParticipants.projectId, projectId),
          eq(projectParticipants.connectionId, connectionId),
        ),
      ),
  );
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

/**
 * Create a brand-new connection and link it to a project in one step, so people
 * met through a project can be added without leaving it. Returns the created
 * connection (mapped to the UI shape) so the caller can show it immediately.
 */
export async function createLinkedConnection(
  projectId: string,
  input: { name: string; role?: string; company?: string; email?: string },
): Promise<Connection | null> {
  const user = await verifySession();
  const name = input.name.trim();
  if (!name) return null;

  let created: Connection | null = null;
  await withUserRLS(async (tx) => {
    await ensureProfile(tx, user);
    const [row] = await tx
      .insert(connections)
      .values({
        ownerId: user.userId,
        name,
        role: input.role?.trim() || null,
        company: input.company?.trim() || null,
        email: input.email?.trim() || null,
      })
      .returning();
    await tx
      .insert(projectParticipants)
      .values({ ownerId: user.userId, projectId, connectionId: row.id })
      .onConflictDoNothing();
    created = toConnection(row, 0);
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/connections");
  revalidatePath("/");
  return created;
}

/* ------------------------------------------------------------------ */
/*  Project stages (Gantt bars)                                         */
/* ------------------------------------------------------------------ */

/** Append a stage to a project's Gantt timeline. */
export async function createStage(
  projectId: string,
  input: { label: string; startDate: string; endDate: string; tone?: Tone },
): Promise<void> {
  const user = await verifySession();
  const label = input.label.trim();
  if (!label || !input.startDate || !input.endDate) return;
  // Guard against inverted ranges — keep start ≤ end.
  const [startDate, endDate] =
    input.startDate <= input.endDate
      ? [input.startDate, input.endDate]
      : [input.endDate, input.startDate];

  await withUserRLS(async (tx) => {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(projectStages)
      .where(eq(projectStages.projectId, projectId));
    await tx.insert(projectStages).values({
      ownerId: user.userId,
      projectId,
      label,
      tone: input.tone ?? "slate",
      startDate,
      endDate,
      position: count,
    });
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/*  Project outreach (recipients + follow-up reminders)               */
/* ------------------------------------------------------------------ */

/** ISO date `days` from today, e.g. the default one-week follow-up reminder. */
function plusDaysIso(days: number): string {
  const now = new Date();
  return isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

/** Add an outreach recipient to a project. Defaults the follow-up to +1 week. */
export async function createOutreach(
  projectId: string,
  input: {
    label: string;
    channel?: string;
    email?: string;
    phone?: string;
    website?: string;
    status?: OutreachStatus;
    connectionId?: string | null;
    lastContacted?: string | null;
    followUpAt?: string | null;
    notes?: string;
  },
): Promise<void> {
  const user = await verifySession();
  const label = input.label.trim();
  if (!label) return;

  await withUserRLS(async (tx) => {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(projectOutreach)
      .where(eq(projectOutreach.projectId, projectId));
    await tx.insert(projectOutreach).values({
      ownerId: user.userId,
      projectId,
      connectionId: input.connectionId || null,
      label,
      channel: orNull(input.channel),
      email: orNull(input.email),
      phone: orNull(input.phone),
      website: orNull(input.website),
      status: input.status ?? "Not started",
      lastContacted: input.lastContacted || null,
      // `undefined` → default a week out; an empty string → no reminder.
      followUpAt:
        input.followUpAt === undefined ? plusDaysIso(7) : input.followUpAt || null,
      notes: orNull(input.notes),
      position: count,
    });
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

/** Edit an outreach recipient's fields. Only provided keys are changed. */
export async function updateOutreach(
  id: string,
  patch: {
    label?: string;
    channel?: string;
    email?: string;
    phone?: string;
    website?: string;
    status?: OutreachStatus;
    connectionId?: string | null;
    lastContacted?: string | null;
    followUpAt?: string | null;
    notes?: string;
  },
  projectId?: string,
): Promise<void> {
  const set: Partial<{
    label: string;
    channel: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    status: OutreachStatus;
    connectionId: string | null;
    lastContacted: string | null;
    followUpAt: string | null;
    notes: string | null;
  }> = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) return;
    set.label = label;
  }
  if (patch.channel !== undefined) set.channel = orNull(patch.channel);
  if (patch.email !== undefined) set.email = orNull(patch.email);
  if (patch.phone !== undefined) set.phone = orNull(patch.phone);
  if (patch.website !== undefined) set.website = orNull(patch.website);
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.connectionId !== undefined) set.connectionId = patch.connectionId || null;
  if (patch.lastContacted !== undefined) set.lastContacted = patch.lastContacted || null;
  if (patch.followUpAt !== undefined) set.followUpAt = patch.followUpAt || null;
  if (patch.notes !== undefined) set.notes = orNull(patch.notes);
  if (Object.keys(set).length === 0) return;

  await withUserRLS((tx) =>
    tx.update(projectOutreach).set(set).where(eq(projectOutreach.id, id)),
  );
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function removeOutreach(
  id: string,
  projectId?: string,
): Promise<void> {
  await withUserRLS((tx) =>
    tx.delete(projectOutreach).where(eq(projectOutreach.id, id)),
  );
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/*  Danger zone — wipe all CRM data (keeps the account + profile)      */
/* ------------------------------------------------------------------ */

/**
 * Delete everything the user owns except their account: connections, projects
 * (tasks/stages/participants/outreach cascade), and events (participants
 * cascade). The `profiles` row and auth user are left intact, so the user stays
 * signed in with an empty workspace.
 */
export async function deleteAllData(): Promise<{ ok: true }> {
  await verifySession();
  await withUserRLS(async (tx) => {
    await tx.delete(events);
    await tx.delete(projects);
    await tx.delete(connections);
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
