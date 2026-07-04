/**
 * DB row → UI display type mappers. The components were built against the rich,
 * denormalized shapes in `lib/data.ts` (with derived fields like `last`, `rank`,
 * and human `when`/`birthday` labels), so the read DAL maps rows into those exact
 * shapes and nothing downstream has to change.
 */

import type { IconKey } from "@/lib/icons";
import type {
  Connection,
  EventItem,
  Project,
  Phase,
  Task,
  Update,
} from "@/lib/data";
import type {
  ConnectionRow,
  EventRow,
  ProjectRow,
  ProjectStageRow,
  ProjectTaskRow,
} from "@/drizzle/schema";
import { formatMonthDay, formatWhen, isUpcoming, relativeSince } from "./format";

/** The `public.updates` view is SQL-only; this is the shape a row comes back as. */
export type UpdatesViewRow = {
  id: string;
  owner_id: string;
  source: string;
  sort_at: string;
  icon: string;
  title: string;
  kind: string;
  tone: Update["tone"];
  detail: string | null;
  connection_ids: string[];
  project_ids: string[];
};

export function toConnection(row: ConnectionRow, rank: number): Connection {
  const timeline = row.interactions ?? [];
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? "",
    company: row.company ?? "",
    avatarTone: row.avatarTone,
    tags: row.tags ?? [],
    last: timeline[0]?.when ?? relativeSince(row.updatedAt),
    rank,
    email: row.email ?? "",
    phone: row.phone ?? "",
    location: row.location ?? "",
    birthday: row.birthday ? formatMonthDay(row.birthday) : "—",
    note: row.notes?.[0]?.body ?? "",
    timeline,
  };
}

export function toEvent(row: EventRow, metIds: string[], rank: number): EventItem {
  return {
    id: row.id,
    name: row.name,
    when: formatWhen(row.eventDate),
    where: row.location ?? "",
    organizers: row.organizers ?? [],
    metIds,
    metGuests: row.metGuests ?? [],
    note: row.note ?? "",
    upcoming: isUpcoming(row.eventDate),
    avatarTone: row.avatarTone,
    rank,
  };
}

export function toTask(row: ProjectTaskRow): Task {
  return {
    id: row.id,
    label: row.label,
    done: row.done,
    due: row.dueDate ? formatMonthDay(row.dueDate) : undefined,
    description: row.description ?? undefined,
    subtasks: row.subtasks ?? [],
  };
}

export function toPhase(row: ProjectStageRow): Phase {
  return {
    id: row.id,
    label: row.label,
    tone: row.tone,
    start: row.startDate,
    end: row.endDate,
  };
}

export function toProject(
  row: ProjectRow,
  extras: { tasks: Task[]; phases: Phase[]; connectionIds: string[] },
): Project {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as IconKey,
    tone: row.tone,
    summary: row.summary ?? "",
    description: row.description ?? "",
    status: { label: row.statusLabel ?? "", tone: row.statusTone },
    connectionIds: extras.connectionIds,
    tasks: extras.tasks,
    phases: extras.phases,
  };
}

export function toUpdate(row: UpdatesViewRow): Update {
  return {
    id: row.id,
    icon: row.icon as IconKey,
    title: row.title,
    kind: row.kind,
    tone: row.tone,
    when: formatWhen(row.sort_at),
    detail: row.detail ?? "",
    connectionIds: row.connection_ids ?? [],
    projectIds: row.project_ids ?? [],
  };
}
