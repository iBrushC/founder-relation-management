import "server-only";

import { z } from "zod";

import {
  INTERACTION_TYPES,
  OUTREACH_STATUSES,
  type InteractionType,
  type OutreachStatus,
} from "@/lib/data";
import { listConnections, listEvents, listProjects } from "@/lib/data/crm";
import { chatJson, type ChatMessage } from "@/lib/ai/openrouter";

/** Today, resolved in the user's timezone — see `todayInZone` in ./format. */
export type Today = { iso: string; weekday: string };

/**
 * The "brain" behind AI Quick Add.
 *
 * A single structured-JSON model call turns one line of plain language into a
 * short list of typed operations. The model references people/events/outreach by
 * *name* (never id) — this module then resolves those names to the signed-in
 * user's real rows (creating when there's no match) and produces a
 * plain-language preview. Nothing is written here; `applyQuickAdd`
 * (lib/data/quick-add-actions.ts) executes the resolved plan after the user
 * confirms. The model can only add or edit — the vocabulary has no delete op.
 */

/* ------------------------------------------------------------------ */
/*  Context handed to the model                                        */
/* ------------------------------------------------------------------ */

type OutreachRef = {
  id: string;
  label: string;
  projectId: string;
  status: OutreachStatus;
};

export type QuickAddContext = {
  connections: { id: string; name: string; company: string }[];
  events: { id: string; name: string }[];
  outreach: OutreachRef[];
};

/** Gather the compact entity lists the parser needs (≤50 connections in V1). */
export async function buildQuickAddContext(): Promise<QuickAddContext> {
  const [connections, projects, events] = await Promise.all([
    listConnections(),
    listProjects(),
    listEvents(),
  ]);

  const outreach: OutreachRef[] = [];
  for (const p of projects) {
    for (const o of p.outreach) {
      outreach.push({ id: o.id, label: o.label, projectId: p.id, status: o.status });
    }
  }

  return {
    connections: connections.map((c) => ({ id: c.id, name: c.name, company: c.company })),
    events: events.map((e) => ({ id: e.id, name: e.name })),
    outreach,
  };
}

/* ------------------------------------------------------------------ */
/*  Model output schema (entities referenced by name)                  */
/* ------------------------------------------------------------------ */

// Enum-ish fields are parsed as free strings and normalized in resolution, so a
// small model writing "coffee" or "follow-up sent" doesn't hard-fail validation.
const RawOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create_connection"),
    name: z.string().min(1).max(200),
    role: z.string().max(200).optional(),
    company: z.string().max(200).optional(),
    email: z.string().max(320).optional(),
  }),
  z.object({
    op: z.literal("log_interaction"),
    person: z.string().min(1).max(200),
    type: z.string().max(50).optional(),
    note: z.string().max(500).optional(),
    date: z.string().max(20).optional(),
  }),
  z.object({
    op: z.literal("link_event_person"),
    person: z.string().min(1).max(200),
    event: z.string().min(1).max(200),
    eventDate: z.string().max(20).optional(),
  }),
  z.object({
    op: z.literal("create_event"),
    name: z.string().min(1).max(200),
    date: z.string().max(20).optional(),
    location: z.string().max(200).optional(),
  }),
  z.object({
    op: z.literal("set_outreach_status"),
    recipient: z.string().min(1).max(200),
    status: z.string().max(50),
  }),
  z.object({
    op: z.literal("clarify"),
    question: z.string().min(1).max(300),
  }),
]);

const ModelOutput = z.object({ operations: z.array(RawOp).min(1).max(10) });

/* ------------------------------------------------------------------ */
/*  Resolved plan (entities resolved to ids; ready to apply)           */
/* ------------------------------------------------------------------ */

export type ResolvedStep =
  | {
      kind: "create_connection";
      name: string;
      role?: string;
      company?: string;
      email?: string;
      summary: string;
    }
  | {
      kind: "log_interaction";
      connectionId: string | null;
      personName: string;
      type: InteractionType;
      note?: string;
      date?: string;
      summary: string;
    }
  | {
      kind: "link_event_person";
      connectionId: string | null;
      personName: string;
      eventId: string | null;
      eventName: string;
      eventDate?: string;
      summary: string;
    }
  | {
      kind: "create_event";
      name: string;
      date?: string;
      location?: string;
      summary: string;
    }
  | {
      kind: "set_outreach_status";
      outreachId: string;
      projectId: string;
      recipientLabel: string;
      status: OutreachStatus;
      summary: string;
    }
  | { kind: "clarify"; question: string }
  | { kind: "noop"; summary: string };

export type ResolvedPlan = {
  steps: ResolvedStep[];
  /** One human-readable line per step, for the confirmation preview. */
  summary: string[];
  /** The first clarify question, if any — blocks applying until resolved. */
  clarification: string | null;
  /** True when at least one step will actually write something. */
  actionable: boolean;
};

/* ------------------------------------------------------------------ */
/*  Prompt                                                             */
/* ------------------------------------------------------------------ */

function contextBlock(ctx: QuickAddContext): string {
  const people = ctx.connections.length
    ? ctx.connections
        .map((c) => (c.company ? `${c.name} (${c.company})` : c.name))
        .join(", ")
    : "(none yet)";
  const events = ctx.events.length ? ctx.events.map((e) => e.name).join(", ") : "(none yet)";
  const outreach = ctx.outreach.length
    ? ctx.outreach.map((o) => o.label).join(", ")
    : "(none yet)";
  return `CONNECTIONS: ${people}\nEVENTS: ${events}\nOUTREACH RECIPIENTS: ${outreach}`;
}

function systemPrompt(ctx: QuickAddContext, today: Today): string {
  return `You turn one line of plain language from a founder into structured CRM operations.

Today is ${today.weekday}, ${today.iso} (in the user's timezone; dates are YYYY-MM-DD). Resolve any relative dates the user gives ("today", "yesterday", "this Saturday", "next Tuesday", "in 3 days") against this — e.g. "Saturday" means the ${today.weekday === "Saturday" ? "current" : "coming"} Saturday. Always output dates as YYYY-MM-DD.

You can ONLY add or edit records — never delete. Reply with a single JSON object: {"operations": [ ... ]}. Each operation is one of:

- {"op":"create_connection","name":"...","role":"?","company":"?","email":"?"} — add a new person.
- {"op":"log_interaction","person":"...","type":"...","note":"?","date":"YYYY-MM-DD?"} — record a touchpoint with a person. "type" must be one of: ${INTERACTION_TYPES.join(", ")}. If the person is not in CONNECTIONS, they will be created automatically.
- {"op":"create_event","name":"...","date":"YYYY-MM-DD?","location":"?"} — add an event (a conference, demo day, mixer, meetup…). Use this when the user only mentions an event, with no person to link.
- {"op":"link_event_person","person":"...","event":"...","eventDate":"YYYY-MM-DD?"} — record that a person was met at an event. Missing person and/or event are created automatically. Use this instead of create_event whenever a person is involved.
- {"op":"set_outreach_status","recipient":"...","status":"..."} — change an outreach recipient's status. "status" must be one of: ${OUTREACH_STATUSES.join(", ")}. Map "followed up" / "sent follow-up" to "Sent". The recipient must be in OUTREACH RECIPIENTS.
- {"op":"clarify","question":"..."} — use this when the request is ambiguous or you cannot tell which operation applies. Do not guess.

Rules:
- Refer to people/events/recipients by name exactly as written by the user; do not invent ids.
- Prefer a single operation. Only combine (e.g. create + log) when the sentence clearly implies both.
- If the user asks to delete/remove anything, respond with a clarify explaining you can only add or edit.

Current data for this user:
${contextBlock(ctx)}`;
}

/* ------------------------------------------------------------------ */
/*  Resolution helpers                                                 */
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

function findConnection(ctx: QuickAddContext, name: string) {
  const n = norm(name);
  return ctx.connections.find((c) => norm(c.name) === n) ?? null;
}

function findEvent(ctx: QuickAddContext, name: string) {
  const n = norm(name);
  return ctx.events.find((e) => norm(e.name) === n) ?? null;
}

function findOutreach(ctx: QuickAddContext, label: string) {
  const n = norm(label);
  // Exact first, then a contains match so "JP Morgan" finds "JP Morgan Chase".
  return (
    ctx.outreach.find((o) => norm(o.label) === n) ??
    ctx.outreach.find((o) => norm(o.label).includes(n) || n.includes(norm(o.label))) ??
    null
  );
}

/** Turn one validated model op into a resolved, id-bearing step. */
function resolveOp(
  op: z.infer<typeof RawOp>,
  ctx: QuickAddContext,
): ResolvedStep {
  switch (op.op) {
    case "clarify":
      return { kind: "clarify", question: op.question };

    case "create_connection": {
      const existing = findConnection(ctx, op.name);
      if (existing) {
        return {
          kind: "noop",
          summary: `${existing.name} is already in your connections — nothing to add.`,
        };
      }
      const extras = [op.role, op.company].filter(Boolean).join(", ");
      return {
        kind: "create_connection",
        name: op.name,
        role: op.role,
        company: op.company,
        email: op.email,
        summary: `Add new connection ${op.name}${extras ? ` (${extras})` : ""}.`,
      };
    }

    case "log_interaction": {
      const match = findConnection(ctx, op.person);
      const type = resolveInteractionType(op.type);
      const created = match ? "" : " (new connection)";
      const noteBit = op.note ? ` — "${op.note}"` : "";
      return {
        kind: "log_interaction",
        connectionId: match?.id ?? null,
        personName: match?.name ?? op.person,
        type,
        note: op.note,
        date: op.date,
        summary: `Log a ${type} with ${match?.name ?? op.person}${created}${noteBit}.`,
      };
    }

    case "link_event_person": {
      const person = findConnection(ctx, op.person);
      const event = findEvent(ctx, op.event);
      const pNew = person ? "" : " (new connection)";
      const eNew = event ? "" : " (new event)";
      return {
        kind: "link_event_person",
        connectionId: person?.id ?? null,
        personName: person?.name ?? op.person,
        eventId: event?.id ?? null,
        eventName: event?.name ?? op.event,
        eventDate: op.eventDate,
        summary: `Link ${person?.name ?? op.person}${pNew} to event ${event?.name ?? op.event}${eNew}.`,
      };
    }

    case "create_event": {
      const existing = findEvent(ctx, op.name);
      if (existing) {
        return {
          kind: "noop",
          summary: `${existing.name} is already one of your events — nothing to add.`,
        };
      }
      const where = op.location ? ` at ${op.location}` : "";
      const on = op.date ? ` on ${op.date}` : "";
      return {
        kind: "create_event",
        name: op.name,
        date: op.date,
        location: op.location,
        summary: `Add event ${op.name}${on}${where}.`,
      };
    }

    case "set_outreach_status": {
      const match = findOutreach(ctx, op.recipient);
      const status = resolveStatus(op.status);
      if (!match) {
        return {
          kind: "clarify",
          question: `I couldn't find an outreach recipient matching "${op.recipient}". Which one did you mean?`,
        };
      }
      if (!status) {
        return {
          kind: "clarify",
          question: `I couldn't map "${op.status}" to a status. Options: ${OUTREACH_STATUSES.join(", ")}.`,
        };
      }
      return {
        kind: "set_outreach_status",
        outreachId: match.id,
        projectId: match.projectId,
        recipientLabel: match.label,
        status,
        summary: `Set outreach ${match.label} → ${status}.`,
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

/** Parse the model's JSON reply, tolerating a stray ```json fence or prose. */
function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Model did not return JSON.");
  }
}

/**
 * Interpret one Quick Add line into a resolved, previewable plan. Makes a single
 * model call with one retry on a malformed reply; if it still can't produce a
 * valid plan, returns a `clarify` step rather than throwing.
 */
export async function interpretQuickAdd(
  text: string,
  ctx: QuickAddContext,
  today: Today,
): Promise<ResolvedPlan> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(ctx, today) },
    { role: "user", content: text },
  ];

  let parsed: z.infer<typeof ModelOutput> | null = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const reply = await chatJson(messages);
    const candidate = ModelOutput.safeParse(parseModelJsonSafe(reply));
    if (candidate.success) {
      parsed = candidate.data;
    } else if (attempt === 0) {
      messages.push(
        { role: "assistant" as const, content: reply },
        {
          role: "user" as const,
          content:
            'That was not valid. Reply with ONLY a JSON object of the form {"operations":[...]} using the allowed ops.',
        },
      );
    }
  }

  if (!parsed) {
    return {
      steps: [{ kind: "clarify", question: "I didn't quite catch that — can you rephrase?" }],
      summary: [],
      clarification: "I didn't quite catch that — can you rephrase?",
      actionable: false,
    };
  }

  const steps = parsed.operations.map((op) => resolveOp(op, ctx));
  const clarifyStep = steps.find((s) => s.kind === "clarify");
  const actionable = steps.some(
    (s) => s.kind !== "clarify" && s.kind !== "noop",
  );
  const summary = steps
    .filter((s): s is Exclude<ResolvedStep, { kind: "clarify" }> => s.kind !== "clarify")
    .map((s) => s.summary);

  return {
    steps,
    summary,
    clarification: clarifyStep?.kind === "clarify" ? clarifyStep.question : null,
    actionable,
  };
}

/** parseModelJson that returns `null` instead of throwing, for the retry loop. */
function parseModelJsonSafe(raw: string): unknown {
  try {
    return parseModelJson(raw);
  } catch {
    return null;
  }
}
