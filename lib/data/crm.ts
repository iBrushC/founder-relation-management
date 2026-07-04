import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import {
  connections,
  eventParticipants,
  events,
  projectParticipants,
  projectStages,
  projectTasks,
  projects,
} from "@/drizzle/schema";
import type { Connection, EventItem, Project, Update } from "@/lib/data";
import { withUserRLS } from "@/lib/db/rls";
import {
  toConnection,
  toEvent,
  toPhase,
  toProject,
  toTask,
  toUpdate,
  type UpdatesViewRow,
} from "./mappers";

/**
 * Read side of the CRM data layer. Every function runs through `withUserRLS`, so
 * Postgres scopes each query to the signed-in user's rows — the DAL never has to
 * add an `owner_id` filter of its own. Rows come back as the UI display types
 * (see ./mappers), so pages can drop these in where the demo arrays used to be.
 */

/** All of the user's connections, in a stable order (rank = position). */
export async function listConnections(): Promise<Connection[]> {
  return withUserRLS(async (tx) => {
    const rows = await tx
      .select()
      .from(connections)
      .orderBy(asc(connections.createdAt));
    return rows.map((row, i) => toConnection(row, i + 1));
  });
}

/** Group a flat list of `{ [key]: id }` rows into a map of key → values. */
function groupBy<T, K extends string | number, V>(
  rows: T[],
  key: (row: T) => K,
  value: (row: T) => V,
): Map<K, V[]> {
  const out = new Map<K, V[]>();
  for (const row of rows) {
    const k = key(row);
    (out.get(k) ?? out.set(k, []).get(k)!).push(value(row));
  }
  return out;
}

/**
 * Assemble projects from their rows plus the child tasks/stages/participants.
 * Shared by `listProjects` and `getProject` so both build the same shape.
 */
async function assembleProjects(
  where?: ReturnType<typeof eq>,
): Promise<Project[]> {
  return withUserRLS(async (tx) => {
    const projectRows = await (where
      ? tx.select().from(projects).where(where)
      : tx.select().from(projects).orderBy(asc(projects.createdAt)));
    if (projectRows.length === 0) return [];

    const [taskRows, stageRows, participantRows] = await Promise.all([
      tx.select().from(projectTasks).orderBy(asc(projectTasks.position)),
      tx.select().from(projectStages).orderBy(asc(projectStages.position)),
      tx.select().from(projectParticipants),
    ]);

    const tasksByProject = groupBy(taskRows, (t) => t.projectId, toTask);
    const stagesByProject = groupBy(stageRows, (s) => s.projectId, toPhase);
    const peopleByProject = groupBy(
      participantRows,
      (p) => p.projectId,
      (p) => p.connectionId,
    );

    return projectRows.map((row) =>
      toProject(row, {
        tasks: tasksByProject.get(row.id) ?? [],
        phases: stagesByProject.get(row.id) ?? [],
        connectionIds: peopleByProject.get(row.id) ?? [],
      }),
    );
  });
}

/** All of the user's projects with their tasks, stages, and linked people. */
export async function listProjects(): Promise<Project[]> {
  return assembleProjects();
}

/** A single project by id, or null if it isn't the user's / doesn't exist. */
export async function getProject(id: string): Promise<Project | null> {
  const [project] = await assembleProjects(eq(projects.id, id));
  return project ?? null;
}

/** All events, upcoming (soonest first) then past (most recent first). */
export async function listEvents(): Promise<EventItem[]> {
  return withUserRLS(async (tx) => {
    const [eventRows, participantRows] = await Promise.all([
      tx.select().from(events),
      tx.select().from(eventParticipants),
    ]);

    const peopleByEvent = groupBy(
      participantRows,
      (p) => p.eventId,
      (p) => p.connectionId,
    );

    const sorted = [...eventRows].sort((a, b) => {
      const au = a.eventDate >= today();
      const bu = b.eventDate >= today();
      if (au !== bu) return au ? -1 : 1; // upcoming before past
      // Upcoming: soonest first (asc). Past: most recent first (desc).
      return au
        ? a.eventDate.localeCompare(b.eventDate)
        : b.eventDate.localeCompare(a.eventDate);
    });

    return sorted.map((row, i) =>
      toEvent(row, peopleByEvent.get(row.id) ?? [], i + 1),
    );
  });
}

/** The derived homepage feed for the next 30 days (task/event/birthday rows). */
export async function listUpdates(): Promise<Update[]> {
  return withUserRLS(async (tx) => {
    const rows = (await tx.execute(sql`
      select * from public.updates
      where sort_at <= current_date + 30
      order by sort_at
    `)) as unknown as UpdatesViewRow[];
    return rows.map(toUpdate);
  });
}

/** Today's calendar date as `YYYY-MM-DD`, matching stored `date` columns. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
