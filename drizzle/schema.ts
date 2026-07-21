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
  uniqueIndex,
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
    /**
     * Additional addresses for the same person, beyond `email`.
     *
     * `email` stays the primary — it's what the UI shows, what CSV import/export
     * maps, and what outreach copies — so nothing downstream had to change. This
     * exists because Gmail matching is only as good as the addresses we know
     * about, and one person routinely has a work and a personal address. Matched
     * alongside `email`; see `lib/google/sync.ts`.
     */
    altEmails: jsonb("alt_emails").$type<string[]>().notNull().default([]),
    phone: text(),
    location: text(),
    /** Full LinkedIn profile URL. */
    linkedin: text(),
    /** Month/day matter for birthday reminders; the year may be a placeholder. */
    birthday: date(),
    tags: jsonb().$type<Tag[]>().notNull().default([]),
    /** The interaction timeline (most-recent first). */
    interactions: jsonb().$type<Interaction[]>().notNull().default([]),
    /**
     * The last day a check-in reminder for this connection was surfaced to the
     * user. Together with `interactions[0].date`, this drives the recurring
     * "every N days" cadence — a fresh interaction resets the cycle (the
     * column is cleared on log), the next reminder is anchored on the newer
     * of the two dates, and acknowledging the reminder advances the cycle by
     * N days. See `lib/reminders/check-ins.ts`.
     */
    lastCheckInNotifiedAt: date("last_check_in_notified_at"),
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
    /**
     * Guests met who aren't (yet) connections — plain names. The connection-backed
     * guests live in `event_participants`; the UI shows the two as one list and can
     * promote a name here into a real connection later.
     */
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
/*  google_accounts — linked Google OAuth grants                       */
/* ------------------------------------------------------------------ */

/**
 * A user's linked Google account, holding the OAuth refresh/access tokens that
 * let SFRM call the Gmail API on their behalf.
 *
 * RLS is enabled with NO policies, which is deliberate and load-bearing: an
 * enabled-but-policy-less table denies the `authenticated` role everything, so
 * the anon key in the browser cannot read this table via PostgREST even with a
 * valid session. That matters because a refresh token here grants Gmail read
 * access — a `select` policy scoped to the owner (the pattern every other table
 * uses) would let the user's own browser fetch it, putting it one XSS away from
 * exfiltration. Reads therefore go through `lib/google/tokens.ts` on the trusted
 * `postgres` connection (`lib/db`), never `withUserRLS`.
 *
 * Tokens are additionally encrypted at rest (AES-256-GCM, see `lib/google/crypto.ts`)
 * so a database dump alone is not enough to read anyone's mail.
 */
export const googleAccounts = pgTable("google_accounts", {
  /** PK, not just FK: one linked Google account per user. */
  ownerId: uuid("owner_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  /** Google's stable user id (the `sub` claim) — survives an email change. */
  googleUserId: text("google_user_id").notNull(),
  /** The Google account's email, shown in Settings. Not an SFRM identity. */
  email: text().notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }).notNull(),
  /** Space-delimited, exactly as Google returned it — what was actually granted. */
  scope: text().notNull(),
  /**
   * When Gmail was last swept for this user. Null until the first sync. Drives
   * the "Last synced …" label in Settings; sync is manual, so this is the only
   * way the user can tell how fresh the mirrored threads are.
   */
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps,
}).enableRLS();

/* ------------------------------------------------------------------ */
/*  email_threads — Gmail conversations mirrored onto a connection      */
/* ------------------------------------------------------------------ */

/**
 * One row per Gmail thread per connection: an email *chain* is a single
 * interaction, so the whole conversation collapses here rather than logging a
 * row per message.
 *
 * Deliberately NOT stored in `connections.interactions`. That array is the
 * user's own hand-written timeline: it has no stable per-entry id, the panel
 * edits entries by array index, and `updateInteractions` replaces it wholesale.
 * Synced mail living there would mean a re-sync either duplicates every thread
 * or clobbers hand-written notes, and a user edit would silently rewrite Gmail
 * data as if they'd authored it. Keeping it in its own table makes sync
 * idempotent (upsert on the natural key below) and keeps the two sources
 * physically unable to corrupt each other — they're merged for display only,
 * on the read path (see `lib/data/mappers.ts`).
 *
 * Unlike `google_accounts` (which holds tokens and is deliberately unreadable to
 * the `authenticated` role), this is ordinary user CRM data: normal owner RLS,
 * read through `withUserRLS` like every other table.
 */
export const emailThreads = pgTable(
  "email_threads",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    /** Gmail's thread id — stable across syncs, and the dedupe key. */
    threadId: text("thread_id").notNull(),
    /** Subject of the first message in the thread ("" when Gmail sends none). */
    subject: text().notNull().default(""),
    /** Gmail's own ~100-char preview of the latest message. Never a full body. */
    snippet: text().notNull().default(""),
    /** Timestamp of the most recent message — what the timeline sorts on. */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull(),
    messageCount: integer("message_count").notNull().default(1),
    /** "sent" | "received" | "both", relative to the linked Google account. */
    direction: text().notNull().default("both"),
    ...timestamps,
  },
  (t) => [
    index("email_threads_owner_id_idx").on(t.ownerId),
    index("email_threads_connection_id_idx").on(t.connectionId),
    // The natural key sync upserts on: one row per thread per person. Scoped by
    // owner too, since two users can legitimately mirror the same thread id.
    uniqueIndex("email_threads_owner_connection_thread_idx").on(
      t.ownerId,
      t.connectionId,
      t.threadId,
    ),
    ...ownerRls(t.ownerId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Inferred row types                                                 */
/* ------------------------------------------------------------------ */

export type EmailThreadRow = typeof emailThreads.$inferSelect;
export type NewEmailThreadRow = typeof emailThreads.$inferInsert;
export type GoogleAccountRow = typeof googleAccounts.$inferSelect;
export type NewGoogleAccountRow = typeof googleAccounts.$inferInsert;
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
