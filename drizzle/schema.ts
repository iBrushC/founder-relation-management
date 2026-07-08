import { sql, type AnyColumn } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";
import type { InteractionType } from "@/lib/data";

/**
 * SFRM database. Drizzle is the SINGLE source of truth for the schema: the
 * enums, tables, columns, indexes, RLS, and policies declared here are the only
 * definition of them — generate a migration with `drizzle-kit generate` and
 * apply it with `drizzle-kit migrate`. There is no hand-written SQL twin to keep
 * in sync.
 *
 * Security architecture, layer 2 of 3: RLS. This is a single-tenant-per-user CRM
 * — every row is owned by exactly one auth user, and every table below carries an
 * `owner_id` so the policies can scope reads/writes to `auth.uid()`. `authUid` is
 * drizzle-orm/supabase's `(select auth.uid())`, matching the SQL policies.
 *
 * NOTE: a few objects Drizzle does not manage live ONLY in SQL under
 * `supabase/migrations` — the `updated_at`/auth triggers, the `handle_updated_at`
 * / `handle_new_user` / `next_birthday` functions, the derived `public.updates`
 * view, and the `resumes` storage bucket. Those files are applied AFTER
 * `drizzle-kit migrate` and never redefine anything declared here.
 */

/* ------------------------------------------------------------------ */
/*  Shared vocabulary                                                  */
/* ------------------------------------------------------------------ */

/** The seven UI accent colors. Mirrors `Tone` in `lib/data.ts`. */
export const tone = pgEnum("tone", [
  "red",
  "amber",
  "blue",
  "green",
  "purple",
  "teal",
  "slate",
]);

/**
 * What kind of event a row is. Drives the "kind"/icon of a derived update.
 * `check_in` is how connection-oriented follow-ups ("coffee with Priya") are
 * modeled — a lightweight event with one participant.
 */
export const eventCategory = pgEnum("event_category", [
  "mixer",
  "demo_day",
  "meetup",
  "meeting",
  "check_in",
  "milestone",
  "info_session",
  "other",
]);

export type Tone = (typeof tone.enumValues)[number];
export type EventCategory = (typeof eventCategory.enumValues)[number];

/** A colored label attached to a connection or project. */
export type Tag = { label: string; tone: Tone };
/** One entry in a connection's interaction timeline. */
export type Interaction = {
  label: string;
  when: string;
  /** Kind of touchpoint. Absent on older free-text entries. */
  type?: InteractionType;
  /** ISO date (YYYY-MM-DD) the interaction happened. Absent on legacy entries. */
  date?: string;
  /** Optional ISO end date, for a multi-day interaction. */
  until?: string;
};
/** A free-form note on a connection. Stored inline; never queried individually. */
export type ConnectionNote = { id: string; body: string; createdAt: string };
/** A free-form key/value detail beyond a connection's fixed contact fields. */
export type ExtraField = { label: string; value: string };
/** A checklist item nested under a task. */
export type Subtask = { id: string; label: string; done: boolean };

/* ------------------------------------------------------------------ */
/*  Reusable column + policy builders                                  */
/* ------------------------------------------------------------------ */

/** `created_at` / `updated_at`, kept fresh by the `handle_updated_at` trigger. */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** The owning auth user. Referenced via `profiles` (1:1 with `auth.users`). */
const ownerId = () =>
  uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" });

/**
 * The four owner-scoped RLS policies every data table shares: a user may only
 * ever see or touch rows they own. Policy names are per-table in Postgres, so
 * reusing them across tables is intentional and fine.
 */
function ownerRls(owner: AnyColumn) {
  return [
    pgPolicy("Owner can view own rows", {
      for: "select",
      to: authenticatedRole,
      using: sql`${authUid} = ${owner}`,
    }),
    pgPolicy("Owner can insert own rows", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${authUid} = ${owner}`,
    }),
    pgPolicy("Owner can update own rows", {
      for: "update",
      to: authenticatedRole,
      using: sql`${authUid} = ${owner}`,
      withCheck: sql`${authUid} = ${owner}`,
    }),
    pgPolicy("Owner can delete own rows", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${authUid} = ${owner}`,
    }),
  ];
}

/* ------------------------------------------------------------------ */
/*  profiles — one row per auth user (mirrors 0001_profiles.sql)       */
/* ------------------------------------------------------------------ */

export const profiles = pgTable(
  "profiles",
  {
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    email: text().notNull(),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    settings: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    pgPolicy("Profiles are viewable by their owner", {
      for: "select",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.id}`,
    }),
    pgPolicy("Users can insert their own profile", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${authUid} = ${t.id}`,
    }),
    pgPolicy("Users can update their own profile", {
      for: "update",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.id}`,
      withCheck: sql`${authUid} = ${t.id}`,
    }),
  ],
);

/* ------------------------------------------------------------------ */
/*  connections — the CRM's people                                     */
/* ------------------------------------------------------------------ */

/**
 * A person the founder knows. Tags, the interaction timeline, and notes are kept
 * inline as JSONB: they are small, always loaded with the connection, and never
 * queried on their own — so no child tables (per the design brief).
 */
export const connections = pgTable(
  "connections",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    name: text().notNull(),
    role: text(),
    company: text(),
    avatarTone: tone("avatar_tone").notNull().default("slate"),
    email: text(),
    phone: text(),
    location: text(),
    /** Full LinkedIn profile URL. */
    linkedin: text(),
    /** Month/day matter for birthday reminders; the year may be a placeholder. */
    birthday: date(),
    tags: jsonb().$type<Tag[]>().notNull().default([]),
    /** The interaction timeline (most-recent first). */
    interactions: jsonb().$type<Interaction[]>().notNull().default([]),
    notes: jsonb().$type<ConnectionNote[]>().notNull().default([]),
    /** Free-form key/value details beyond the fixed contact fields. */
    extraFields: jsonb("extra_fields").$type<ExtraField[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    index("connections_owner_id_idx").on(t.ownerId),
    index("connections_birthday_idx").on(t.birthday),
    ...ownerRls(t.ownerId),
  ],
);

/* ------------------------------------------------------------------ */
/*  projects                                                           */
/* ------------------------------------------------------------------ */

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    name: text().notNull(),
    /** Icon key from `lib/icons` (e.g. "sparkles", "target"). */
    icon: text().notNull().default("folder"),
    tone: tone().notNull().default("slate"),
    summary: text(),
    description: text(),
    /** Free-text status pill, e.g. "On track" / "Due soon" / "Paused". */
    statusLabel: text("status_label"),
    statusTone: tone("status_tone").notNull().default("slate"),
    tags: jsonb().$type<Tag[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [index("projects_owner_id_idx").on(t.ownerId), ...ownerRls(t.ownerId)],
);

/* ------------------------------------------------------------------ */
/*  project_tasks                                                      */
/* ------------------------------------------------------------------ */

export const projectTasks = pgTable(
  "project_tasks",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Optional primary contact this task involves (feeds the updates panel). */
    connectionId: uuid("connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    label: text().notNull(),
    done: boolean().notNull().default(false),
    dueDate: date("due_date"),
    description: text(),
    subtasks: jsonb().$type<Subtask[]>().notNull().default([]),
    /** Manual ordering within a project. */
    position: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("project_tasks_owner_id_idx").on(t.ownerId),
    index("project_tasks_project_id_idx").on(t.projectId),
    index("project_tasks_due_date_idx").on(t.dueDate),
    ...ownerRls(t.ownerId),
  ],
);

/* ------------------------------------------------------------------ */
/*  project_stages — Gantt bars; stages routinely overlap              */
/* ------------------------------------------------------------------ */

export const projectStages = pgTable(
  "project_stages",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text().notNull(),
    tone: tone().notNull().default("slate"),
    /** Inclusive ISO date range. */
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    position: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("project_stages_owner_id_idx").on(t.ownerId),
    index("project_stages_project_id_idx").on(t.projectId),
    ...ownerRls(t.ownerId),
  ],
);

/* ------------------------------------------------------------------ */
/*  project_participants — connections involved in a project           */
/* ------------------------------------------------------------------ */

export const projectParticipants = pgTable(
  "project_participants",
  {
    ownerId: ownerId(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    /** Optional role on this project, e.g. "Advisor", "Investor". */
    role: text(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.connectionId] }),
    index("project_participants_owner_id_idx").on(t.ownerId),
    index("project_participants_connection_id_idx").on(t.connectionId),
    ...ownerRls(t.ownerId),
  ],
);

/* ------------------------------------------------------------------ */
/*  project_outreach — recipients/messages with follow-up reminders    */
/* ------------------------------------------------------------------ */

/**
 * One organization or person you've reached out to under a project — e.g. an
 * investor you emailed or a lead you DM'd. `label` is the recipient's name;
 * `followUpAt` is a reminder date (the UI defaults it to a week out) and pending
 * follow-ups surface in the homepage `updates` feed. Optionally tied to the
 * connection being contacted, though outreach targets often aren't connections.
 */
export const projectOutreach = pgTable(
  "project_outreach",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    label: text().notNull(),
    /** Free-text channel, e.g. "email", "linkedin", "phone". */
    channel: text(),
    /** Recipient's email address, if known. */
    email: text(),
    /** Recipient's phone number, if known. */
    phone: text(),
    /** Recipient's website URL, if known. */
    website: text(),
    /** Pipeline status: Not started / Sent / Awaiting reply / Replied / Closed. */
    status: text().notNull().default("Not started"),
    lastContacted: date("last_contacted"),
    /** Reminder date to send the next follow-up. */
    followUpAt: date("follow_up_at"),
    notes: text(),
    position: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("project_outreach_owner_id_idx").on(t.ownerId),
    index("project_outreach_project_id_idx").on(t.projectId),
    index("project_outreach_connection_id_idx").on(t.connectionId),
    index("project_outreach_follow_up_at_idx").on(t.followUpAt),
    ...ownerRls(t.ownerId),
  ],
);

/* ------------------------------------------------------------------ */
/*  events                                                             */
/* ------------------------------------------------------------------ */

/** Whether an event is upcoming is derived from `event_date` vs. today. */
export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    name: text().notNull(),
    category: eventCategory().notNull().default("other"),
    eventDate: date("event_date").notNull(),
    /** Optional start time; null for all-day events. */
    startTime: time("start_time"),
    location: text(),
    /** Who ran it — orgs or people, free text (not necessarily connections). */
    organizers: jsonb().$type<string[]>().notNull().default([]),
    /** People met who aren't (yet) connections. */
    metGuests: jsonb("met_guests").$type<string[]>().notNull().default([]),
    /** Optional project this event relates to (e.g. a "Weekly sync — Lumen"). */
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    note: text(),
    /** URL of the event's page — a Luma, Eventbrite, or meetup listing. */
    link: text(),
    /** True when the founder is hosting the event themselves. */
    hostedByMe: boolean("hosted_by_me").notNull().default(false),
    /**
     * The connection who invited the founder, if any. Mutually exclusive with
     * `hostedByMe` in the UI — you either host or you're invited. Set null on the
     * connection's deletion so the event survives.
     */
    invitedById: uuid("invited_by_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    avatarTone: tone("avatar_tone").notNull().default("slate"),
    ...timestamps,
  },
  (t) => [
    index("events_owner_id_idx").on(t.ownerId),
    index("events_event_date_idx").on(t.eventDate),
    index("events_project_id_idx").on(t.projectId),
    index("events_invited_by_id_idx").on(t.invitedById),
    ...ownerRls(t.ownerId),
  ],
);

/* ------------------------------------------------------------------ */
/*  event_participants — connections met at an event                   */
/* ------------------------------------------------------------------ */

export const eventParticipants = pgTable(
  "event_participants",
  {
    ownerId: ownerId(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.connectionId] }),
    index("event_participants_owner_id_idx").on(t.ownerId),
    index("event_participants_connection_id_idx").on(t.connectionId),
    ...ownerRls(t.ownerId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Inferred row types                                                 */
/* ------------------------------------------------------------------ */

export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfileRow = typeof profiles.$inferInsert;
export type ConnectionRow = typeof connections.$inferSelect;
export type NewConnectionRow = typeof connections.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type ProjectTaskRow = typeof projectTasks.$inferSelect;
export type NewProjectTaskRow = typeof projectTasks.$inferInsert;
export type ProjectStageRow = typeof projectStages.$inferSelect;
export type NewProjectStageRow = typeof projectStages.$inferInsert;
export type ProjectOutreachRow = typeof projectOutreach.$inferSelect;
export type NewProjectOutreachRow = typeof projectOutreach.$inferInsert;
export type ProjectParticipantRow = typeof projectParticipants.$inferSelect;
export type NewProjectParticipantRow = typeof projectParticipants.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type EventParticipantRow = typeof eventParticipants.$inferSelect;
export type NewEventParticipantRow = typeof eventParticipants.$inferInsert;
