import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  connections,
  eventParticipants,
  events,
  projectOutreach,
  type EventCategory,
  type Interaction,
} from "@/drizzle/schema";
import {
  INTERACTION_TYPES,
  OUTREACH_STATUSES,
  type InteractionType,
  type OutreachStatus,
} from "@/lib/data";
import { formatInteractionWhen } from "@/lib/data/format";
import { withUserRLS } from "@/lib/db/rls";
import { chat, type ChatMessage, type ToolSchema } from "@/lib/ai/openrouter";

/**
 * The "brain" behind AI Quick Add — an agentic tool loop.
 *
 * One line of plain language from a founder drives a short conversation with the
 * model: it may call *read* tools to look up the user's people, events and
 * outreach, then *write* tools to file what happened. Each tool call runs
 * server-side against the caller's own rows (Postgres RLS, via `withUserRLS`),
 * so a name or id the model invents can only ever touch data it's allowed to
 * see. The model can add or edit — the toolset has no delete.
 *
 * The loop runs each tool as the model asks for it (reads and writes execute
 * live) and stops when the model answers with plain prose or the round cap is
 * reached. There is no separate confirm step; the returned `applied` lines are
 * the record of what was written.
 */

/** Today, resolved in the user's timezone — see `todayInZone` in ../data/format. */
export type Today = { iso: string; weekday: string };

/** Per-run identity + clock the write tools need. */
export type QuickAddSession = {
  ownerId: string;
  email: string;
  today: Today;
};

export type QuickAddResult = {
  /** One human-readable line per write that actually landed. */
  applied: string[];
  /** The model's closing message (a summary, or a question it couldn't resolve). */
  message: string;
};

/** How many model↔tool round-trips before we stop, as a runaway backstop. */
const MAX_ROUNDS = 6;

/* ------------------------------------------------------------------ */
/*  Normalisation helpers                                              */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Case-insensitive match of a free string to a known enum value. */
function matchEnum<T extends string>(raw: string, values: readonly T[]): T | null {
  const n = norm(raw);
  return values.find((v) => norm(v) === n) ?? null;
}

/** Interaction type from the model's free string; unknown kinds fall back to "Other". */
function resolveInteractionType(raw: string | undefined): InteractionType {
  if (!raw) return "Other";
  return matchEnum(raw, INTERACTION_TYPES) ?? "Other";
}

/** Outreach status, with common follow-up phrasings folded onto real statuses. */
function resolveStatus(raw: string): OutreachStatus | null {
  const direct = matchEnum(raw, OUTREACH_STATUSES);
  if (direct) return direct;
  const n = norm(raw);
  if (/(follow.?up|followed up|reached out|contacted)/.test(n)) return "Sent";
  if (/repl/.test(n)) return "Replied";
  if (/(await|waiting|pending)/.test(n)) return "Awaiting reply";
  if (/(closed|done|won|lost)/.test(n)) return "Closed";
  return null;
}

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

/* ------------------------------------------------------------------ */
/*  Tools                                                              */
/* ------------------------------------------------------------------ */

/**
 * A tool the model can call. `run` executes it against the signed-in user's
 * data and returns:
 *   - `result` — JSON fed back to the model so it can decide its next move.
 *   - `applied` — a human line recorded when the call *wrote* something.
 *
 * Handlers validate their own args (the model's output is untrusted) and return
 * an `{ error }` result on bad input rather than throwing, so the model can read
 * the message and correct itself on the next round.
 */
type ToolResult = { result: unknown; applied?: string };
type ToolHandler = (args: unknown, ctx: QuickAddSession) => Promise<ToolResult>;
type Tool = { schema: ToolSchema; run: ToolHandler };

/** Small helper to declare a function tool with a JSON-Schema object of params. */
function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  run: ToolHandler,
): Tool {
  return {
    schema: {
      type: "function",
      function: {
        name,
        description,
        parameters: {
          type: "object",
          properties,
          required,
          additionalProperties: false,
        },
      },
    },
    run,
  };
}

const str = (description: string) => ({ type: "string", description });

/** Bad-args result shaped so the model sees a correctable error, not a crash. */
function argError(err: z.ZodError): ToolResult {
  return { result: { error: err.issues[0]?.message ?? "Invalid arguments." } };
}

/** Look up a connection by (normalised) exact name within an open transaction. */
async function findConnectionByName(
  tx: Parameters<Parameters<typeof withUserRLS>[0]>[0],
  name: string,
) {
  const n = norm(name);
  const rows = await tx.select().from(connections);
  return rows.find((r) => norm(r.name) === n) ?? null;
}

/* ---- read tools ---- */

const SearchArgs = z.object({ query: z.string().max(200).optional() });

const searchConnections = tool(
  "search_connections",
  "Find the user's existing connections by name or company. Returns their ids. Call this before logging an interaction or linking a person so you can reference an existing connection instead of creating a duplicate. Omit `query` to list everyone.",
  { query: str("Name or company to search for. Leave empty to list all.") },
  [],
  async (args) => {
    const parsed = SearchArgs.safeParse(args);
    if (!parsed.success) return argError(parsed.error);
    const q = norm(parsed.data.query ?? "");
    const matches = await withUserRLS(async (tx) => {
      const rows = await tx.select().from(connections);
      return rows
        .filter(
          (r) =>
            !q ||
            norm(r.name).includes(q) ||
            (r.company ? norm(r.company).includes(q) : false),
        )
        .slice(0, 25)
        .map((r) => ({ id: r.id, name: r.name, company: r.company, role: r.role }));
    });
    return { result: { matches } };
  },
);

const listEventsTool = tool(
  "list_events",
  "List the user's events (conferences, demo days, mixers…) with their ids and dates. Call this before linking a person to an existing event.",
  {},
  [],
  async () => {
    const rows = await withUserRLS((tx) => tx.select().from(events));
    return {
      result: {
        events: rows.map((e) => ({ id: e.id, name: e.name, date: e.eventDate })),
      },
    };
  },
);

const listOutreachTool = tool(
  "list_outreach",
  "List the user's outreach recipients with their ids and current pipeline status. Call this to find the id before changing a recipient's status.",
  {},
  [],
  async () => {
    const rows = await withUserRLS((tx) => tx.select().from(projectOutreach));
    return {
      result: {
        recipients: rows.map((o) => ({
          id: o.id,
          label: o.label,
          status: o.status,
        })),
      },
    };
  },
);

/* ---- write tools ---- */

const CreateConnectionArgs = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
});

const createConnection = tool(
  "create_connection",
  "Add a brand-new person to the user's connections. Search first to avoid duplicates.",
  {
    name: str("The person's full name."),
    role: str("Their role/title, if mentioned."),
    company: str("Their company, if mentioned."),
    email: str("Their email, if mentioned."),
  },
  ["name"],
  async (args, ctx) => {
    const parsed = CreateConnectionArgs.safeParse(args);
    if (!parsed.success) return argError(parsed.error);
    const op = parsed.data;

    return withUserRLS(async (tx) => {
      const existing = await findConnectionByName(tx, op.name);
      if (existing) {
        return {
          result: {
            ok: true,
            note: `${existing.name} already exists.`,
            connectionId: existing.id,
          },
        };
      }
      const [row] = await tx
        .insert(connections)
        .values({
          ownerId: ctx.ownerId,
          name: op.name.trim(),
          role: op.role?.trim() || null,
          company: op.company?.trim() || null,
          email: op.email?.trim() || null,
        })
        .returning({ id: connections.id });
      const extras = [op.role, op.company].filter(Boolean).join(", ");
      return {
        result: { ok: true, connectionId: row.id },
        applied: `Add new connection ${op.name}${extras ? ` (${extras})` : ""}.`,
      };
    });
  },
);

const LogInteractionArgs = z.object({
  connectionId: z.uuid().optional(),
  personName: z.string().min(1).max(200),
  type: z.string().max(50).optional(),
  note: z.string().max(500).optional(),
  date: z.string().max(20).optional(),
});

const logInteraction = tool(
  "log_interaction",
  `Record a touchpoint (Coffee, Call, Email, Meeting, Message, Intro, LinkedIn, Other) with a person. Pass the connectionId from search_connections when the person exists; otherwise they'll be created from personName. Dates are YYYY-MM-DD.`,
  {
    connectionId: str("Existing connection id from search_connections, if known."),
    personName: str("The person's name (used to create them if no id is given)."),
    type: str(`One of: ${INTERACTION_TYPES.join(", ")}.`),
    note: str("A short note about the touchpoint."),
    date: str("When it happened, as YYYY-MM-DD."),
  },
  ["personName"],
  async (args, ctx) => {
    const parsed = LogInteractionArgs.safeParse(args);
    if (!parsed.success) return argError(parsed.error);
    const op = parsed.data;
    const type = resolveInteractionType(op.type);
    const date = isoDate(op.date, ctx.today.iso);

    return withUserRLS(async (tx) => {
      let connectionId = op.connectionId ?? null;
      let created = false;
      if (connectionId) {
        // Confirm the id is really the caller's (RLS-scoped read); ignore if not.
        const [own] = await tx
          .select({ id: connections.id })
          .from(connections)
          .where(eq(connections.id, connectionId));
        if (!own) connectionId = null;
      }
      if (!connectionId) {
        const match = await findConnectionByName(tx, op.personName);
        if (match) {
          connectionId = match.id;
        } else {
          const [row] = await tx
            .insert(connections)
            .values({ ownerId: ctx.ownerId, name: op.personName.trim() })
            .returning({ id: connections.id });
          connectionId = row.id;
          created = true;
        }
      }

      const entry: Interaction = {
        label: op.note?.trim() ?? "",
        when: formatInteractionWhen(date) ?? "Just now",
        type,
        date,
      };
      const [existing] = await tx
        .select({ interactions: connections.interactions })
        .from(connections)
        .where(eq(connections.id, connectionId));
      await tx
        .update(connections)
        .set({ interactions: [entry, ...(existing?.interactions ?? [])] })
        .where(eq(connections.id, connectionId));

      const newBit = created ? " (new connection)" : "";
      const noteBit = op.note ? ` — "${op.note}"` : "";
      return {
        result: { ok: true, connectionId },
        applied: `Log a ${type} with ${op.personName}${newBit}${noteBit}.`,
      };
    });
  },
);

const LinkEventPersonArgs = z.object({
  connectionId: z.uuid().optional(),
  personName: z.string().min(1).max(200),
  eventId: z.uuid().optional(),
  eventName: z.string().min(1).max(200),
  eventDate: z.string().max(20).optional(),
});

const linkEventPerson = tool(
  "link_event_person",
  "Record that a person was met at an event. Pass ids from search_connections / list_events when they exist; a missing person and/or event are created automatically. Dates are YYYY-MM-DD.",
  {
    connectionId: str("Existing connection id, if known."),
    personName: str("The person's name (used to create them if no id is given)."),
    eventId: str("Existing event id from list_events, if known."),
    eventName: str("The event's name (used to create it if no id is given)."),
    eventDate: str("The event's date as YYYY-MM-DD, if creating it."),
  },
  ["personName", "eventName"],
  async (args, ctx) => {
    const parsed = LinkEventPersonArgs.safeParse(args);
    if (!parsed.success) return argError(parsed.error);
    const op = parsed.data;

    return withUserRLS(async (tx) => {
      // Resolve / create the person.
      let connectionId = op.connectionId ?? null;
      let personNew = false;
      if (connectionId) {
        const [own] = await tx
          .select({ id: connections.id })
          .from(connections)
          .where(eq(connections.id, connectionId));
        if (!own) connectionId = null;
      }
      if (!connectionId) {
        const match = await findConnectionByName(tx, op.personName);
        if (match) {
          connectionId = match.id;
        } else {
          const [row] = await tx
            .insert(connections)
            .values({ ownerId: ctx.ownerId, name: op.personName.trim() })
            .returning({ id: connections.id });
          connectionId = row.id;
          personNew = true;
        }
      }

      // Resolve / create the event.
      let eventId = op.eventId ?? null;
      let eventNew = false;
      if (eventId) {
        const [own] = await tx
          .select({ id: events.id })
          .from(events)
          .where(eq(events.id, eventId));
        if (!own) eventId = null;
      }
      if (!eventId) {
        const [row] = await tx
          .insert(events)
          .values({
            ownerId: ctx.ownerId,
            name: op.eventName.trim(),
            category: categoryFor(op.eventName),
            eventDate: isoDate(op.eventDate, ctx.today.iso),
          })
          .returning({ id: events.id });
        eventId = row.id;
        eventNew = true;
      }

      await tx
        .insert(eventParticipants)
        .values({ ownerId: ctx.ownerId, eventId, connectionId })
        .onConflictDoNothing();

      const pNew = personNew ? " (new connection)" : "";
      const eNew = eventNew ? " (new event)" : "";
      return {
        result: { ok: true, connectionId, eventId },
        applied: `Link ${op.personName}${pNew} to event ${op.eventName}${eNew}.`,
      };
    });
  },
);

const CreateEventArgs = z.object({
  name: z.string().min(1).max(200),
  date: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
});

const createEvent = tool(
  "create_event",
  "Add an event (a conference, demo day, mixer, meetup…) with no person to link. Use link_event_person instead whenever a person is involved. Dates are YYYY-MM-DD.",
  {
    name: str("The event's name."),
    date: str("The event's date as YYYY-MM-DD."),
    location: str("Where it takes place, if mentioned."),
  },
  ["name"],
  async (args, ctx) => {
    const parsed = CreateEventArgs.safeParse(args);
    if (!parsed.success) return argError(parsed.error);
    const op = parsed.data;

    return withUserRLS(async (tx) => {
      const rows = await tx.select().from(events);
      const existing = rows.find((e) => norm(e.name) === norm(op.name));
      if (existing) {
        return {
          result: { ok: true, note: `${existing.name} already exists.`, eventId: existing.id },
        };
      }
      const [row] = await tx
        .insert(events)
        .values({
          ownerId: ctx.ownerId,
          name: op.name.trim(),
          category: categoryFor(op.name),
          eventDate: isoDate(op.date, ctx.today.iso),
          location: op.location?.trim() || null,
        })
        .returning({ id: events.id });
      const where = op.location ? ` at ${op.location}` : "";
      const on = op.date ? ` on ${op.date}` : "";
      return {
        result: { ok: true, eventId: row.id },
        applied: `Add event ${op.name}${on}${where}.`,
      };
    });
  },
);

const SetOutreachStatusArgs = z.object({
  outreachId: z.uuid(),
  status: z.string().min(1).max(50),
});

const setOutreachStatus = tool(
  "set_outreach_status",
  `Change an outreach recipient's pipeline status. Get the outreachId from list_outreach first. status must map to one of: ${OUTREACH_STATUSES.join(", ")} ("followed up" → Sent).`,
  {
    outreachId: str("The recipient id from list_outreach."),
    status: str(`One of: ${OUTREACH_STATUSES.join(", ")}.`),
  },
  ["outreachId", "status"],
  async (args) => {
    const parsed = SetOutreachStatusArgs.safeParse(args);
    if (!parsed.success) return argError(parsed.error);
    const op = parsed.data;
    const status = resolveStatus(op.status);
    if (!status) {
      return {
        result: {
          error: `Couldn't map "${op.status}" to a status. Options: ${OUTREACH_STATUSES.join(", ")}.`,
        },
      };
    }

    return withUserRLS(async (tx) => {
      const [row] = await tx
        .update(projectOutreach)
        .set({ status })
        .where(eq(projectOutreach.id, op.outreachId))
        .returning({ label: projectOutreach.label });
      if (!row) {
        return {
          result: { error: "No outreach recipient with that id — call list_outreach." },
        };
      }
      return {
        result: { ok: true },
        applied: `Set outreach ${row.label} → ${status}.`,
      };
    });
  },
);

/** Every tool, keyed by name for dispatch. */
const TOOLS: Record<string, Tool> = Object.fromEntries(
  [
    searchConnections,
    listEventsTool,
    listOutreachTool,
    createConnection,
    logInteraction,
    linkEventPerson,
    createEvent,
    setOutreachStatus,
  ].map((t) => [t.schema.function.name, t]),
);

const TOOL_SCHEMAS = Object.values(TOOLS).map((t) => t.schema);

/* ------------------------------------------------------------------ */
/*  Prompt                                                             */
/* ------------------------------------------------------------------ */

function systemPrompt(today: Today): string {
  return `You are the assistant behind a founder CRM's Quick Add box. The user types one line of plain language about something that happened; you file it by calling tools.

Today is ${today.weekday}, ${today.iso} (in the user's timezone). Resolve relative dates ("today", "yesterday", "this Saturday", "in 3 days") against this and always pass dates as YYYY-MM-DD.

How to work:
- Use the read tools (search_connections, list_events, list_outreach) to find existing records and their ids BEFORE writing, so you don't create duplicates.
- Then call the write tools to record what happened. You may make several tool calls; when a sentence implies two things (e.g. "met Priya at Demo Day and she wants a call"), do both.
- You can ONLY add or edit. If the user asks to delete or remove something, don't call a tool — reply explaining you can only add or edit.
- When the request is genuinely ambiguous, don't guess — reply with a short clarifying question instead of calling a tool.
- When you're done, reply with ONE short sentence summarising what you filed (or your question). Keep it plain and friendly.`;
}

/* ------------------------------------------------------------------ */
/*  Agentic loop                                                       */
/* ------------------------------------------------------------------ */

/** Dispatch one tool call, turning any thrown error into a model-readable result. */
async function executeTool(
  name: string,
  rawArgs: string,
  ctx: QuickAddSession,
): Promise<ToolResult> {
  const t = TOOLS[name];
  if (!t) return { result: { error: `Unknown tool "${name}".` } };
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { result: { error: "Arguments were not valid JSON." } };
  }
  try {
    return await t.run(args, ctx);
  } catch (e) {
    console.error(`Quick Add tool "${name}" failed`, e);
    return { result: { error: "That tool call failed — try a different approach." } };
  }
}

/**
 * Run one Quick Add line to completion: let the model read and write via tools
 * until it answers with prose (or we hit the round cap). Returns the lines that
 * were actually written plus the model's closing message.
 */
export async function runQuickAdd(
  text: string,
  session: QuickAddSession,
): Promise<QuickAddResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(session.today) },
    { role: "user", content: text },
  ];
  const applied: string[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const reply = await chat(messages, { tools: TOOL_SCHEMAS });
    const calls = reply.tool_calls ?? [];

    if (calls.length === 0) {
      return {
        applied,
        message: reply.content?.trim() || defaultMessage(applied),
      };
    }

    // Echo the assistant turn (with its tool calls) before answering each one.
    messages.push({
      role: "assistant",
      content: reply.content ?? null,
      tool_calls: calls,
    });

    for (const call of calls) {
      const { result, applied: line } = await executeTool(
        call.function.name,
        call.function.arguments,
        session,
      );
      if (line) applied.push(line);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Ran out of rounds — report whatever landed rather than looping forever.
  return {
    applied,
    message: applied.length
      ? defaultMessage(applied)
      : "I couldn't finish that — try rephrasing it as a single, clearer note.",
  };
}

/** A fallback closing line when the model didn't supply its own. */
function defaultMessage(applied: string[]): string {
  if (applied.length === 0) return "Nothing to add.";
  if (applied.length === 1) return "Added to your CRM.";
  return `Filed ${applied.length} things.`;
}
