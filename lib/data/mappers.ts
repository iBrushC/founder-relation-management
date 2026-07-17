/**
 * DB row → UI display type mappers. The components were built against the rich,
 * denormalized shapes in `lib/data.ts` (with derived fields like `last`, `rank`,
 * and human `when`/`birthday` labels), so the read DAL maps rows into those exact
 * shapes and nothing downstream has to change.
 */

import type { IconKey } from "@/lib/icons";
import type {
  Connection,
  EmailThread,
  EventItem,
  Outreach,
  OutreachStatus,
  Project,
  Phase,
  Task,
  Update,
} from "@/lib/data";
import { OUTREACH_STATUSES } from "@/lib/data";
import type {
  ConnectionRow,
  EmailThreadRow,
  EventRow,
  ProjectOutreachRow,
  ProjectRow,
  ProjectStageRow,
  ProjectTaskRow,
} from "@/drizzle/schema";
import {
  formatInteractionWhen,
  formatMonthDay,
  formatWhen,
  isUpcoming,
  legacyWhenToIso,
  relativeSince,
  sortInteractions,
} from "./format";

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

/** A synced Gmail row → its display shape. Dates derive their own labels. */
export function toEmailThread(row: EmailThreadRow): EmailThread {
  const date = toIsoDate(row.lastMessageAt);
  return {
    id: row.id,
    subject: row.subject,
    snippet: row.snippet,
    date,
    when: formatWhen(date),
    messageCount: row.messageCount,
    // The column is plain text (it's written by sync, not by a user), so coerce
    // rather than trust it — an unknown value reads as a neutral "both".
    direction:
      row.direction === "sent" || row.direction === "received"
        ? row.direction
        : "both",
  };
}

/** A timestamptz → the `YYYY-MM-DD` form the timeline sorts and labels on. */
function toIsoDate(ts: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ts.getFullYear()}-${p(ts.getMonth() + 1)}-${p(ts.getDate())}`;
}

export function toConnection(
  row: ConnectionRow,
  rank: number,
  threadRows: EmailThreadRow[] = [],
): Connection {
  // Recover a date for legacy entries saved before dates were stamped, so they
  // sort and age like new ones. Absolute labels ("Jun 24") are recoverable;
  // relative ones ("Just now") keep their frozen label until re-dated.
  const dated = (row.interactions ?? []).map((it) =>
    it.date ? it : { ...it, date: legacyWhenToIso(it.when) ?? undefined },
  );
  const timeline = sortInteractions(dated);
  const emailThreads = sortInteractions(threadRows.map(toEmailThread));

  // "Last contact" spans both sources — an email you never hand-logged is still
  // contact. Compare on the ISO dates, then label whichever won.
  const top = timeline[0];
  const topThread = emailThreads[0];
  const last = pickLast(
    top ? { date: top.date, label: formatInteractionWhen(top.date, top.until) ?? top.when } : null,
    topThread ? { date: topThread.date, label: topThread.when } : null,
  );

  return {
    id: row.id,
    name: row.name,
    role: row.role ?? "",
    company: row.company ?? "",
    avatarTone: row.avatarTone,
    tags: row.tags ?? [],
    last: last ?? relativeSince(row.updatedAt),
    rank,
    email: row.email ?? "",
    altEmails: row.altEmails ?? [],
    phone: row.phone ?? "",
    location: row.location ?? "",
    linkedin: row.linkedin ?? "",
    birthday: row.birthday ? formatMonthDay(row.birthday) : "—",
    note: row.notes?.[0]?.body ?? "",
    extraFields: row.extraFields ?? [],
    timeline,
    emailThreads,
  };
}

/** The more recent of two candidate "last contact" labels; undated entries lose. */
function pickLast(
  a: { date?: string; label: string } | null,
  b: { date?: string; label: string } | null,
): string | null {
  if (!a) return b?.label ?? null;
  if (!b) return a.label;
  return (b.date ?? "") > (a.date ?? "") ? b.label : a.label;
}

export function toEvent(row: EventRow, metIds: string[], rank: number): EventItem {
  return {
    id: row.id,
    name: row.name,
    when: formatWhen(row.eventDate),
    date: row.eventDate,
    where: row.location ?? "",
    metIds,
    metGuests: row.metGuests ?? [],
    note: row.note ?? "",
    link: row.link ?? undefined,
    hostedByMe: row.hostedByMe,
    invitedById: row.invitedById ?? null,
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

/** Coerce a stored status string to a known OutreachStatus (falls back safely). */
function toOutreachStatus(raw: string): OutreachStatus {
  return (OUTREACH_STATUSES as readonly string[]).includes(raw)
    ? (raw as OutreachStatus)
    : "Not started";
}

export function toOutreach(row: ProjectOutreachRow): Outreach {
  return {
    id: row.id,
    label: row.label,
    connectionId: row.connectionId ?? null,
    channel: row.channel ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    website: row.website ?? "",
    status: toOutreachStatus(row.status),
    lastContacted: row.lastContacted ?? "",
    followUpAt: row.followUpAt ?? "",
    notes: row.notes ?? "",
  };
}

export function toProject(
  row: ProjectRow,
  extras: {
    tasks: Task[];
    phases: Phase[];
    connectionIds: string[];
    outreach: Outreach[];
  },
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
    outreach: extras.outreach,
  };
}

export function toUpdate(row: UpdatesViewRow): Update {
  return {
    id: row.id,
    icon: row.icon as IconKey,
    title: row.title,
    kind: row.kind,
    tone: row.tone,
    date: row.sort_at.slice(0, 10),
    when: formatWhen(row.sort_at),
    detail: row.detail ?? "",
    connectionIds: row.connection_ids ?? [],
    projectIds: row.project_ids ?? [],
  };
}
