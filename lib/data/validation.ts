import { z } from "zod";
import { INTERACTION_TYPES, OUTREACH_STATUSES } from "@/lib/data";

/**
 * Input validation for the CRM write actions (`lib/data/actions.ts`).
 *
 * RLS already scopes every row to its owner, so this layer isn't a trust
 * boundary against *other* users — it's a robustness/abuse guard on a user's own
 * writes: it caps text length and rejects malformed ids, dates, tones, and enum
 * values before anything reaches Postgres. Actions fail closed (early return /
 * `null`) on a parse failure, matching their existing no-op-on-empty contract.
 * (Surfacing that rejection to the user is tracked as rec 1 — see REVIEW_FOLLOWUPS.md.)
 */

/* ---- Primitives --------------------------------------------------- */

/** Optional free text, trimmed and length-capped. Empty is allowed. */
export const txt = (max: number) => z.string().trim().max(max);
/** Required free text: non-empty after trimming, length-capped. */
export const reqTxt = (max: number) => z.string().trim().min(1).max(max);

export const zTone = z.enum([
  "red",
  "amber",
  "blue",
  "green",
  "purple",
  "teal",
  "slate",
]);
export const zStatus = z.enum(OUTREACH_STATUSES);
export const zUuid = z.uuid();
/** A stored calendar date, `YYYY-MM-DD`. */
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
/** A date input that may also be blank (""), e.g. "no reminder". */
export const zDateOrEmpty = z.union([zDate, z.literal("")]);
/** A uuid reference that may also be blank ("") to mean "none". */
export const zUuidOrEmpty = z.union([zUuid, z.literal("")]);

/* ---- Field-cap conveniences --------------------------------------- */

const name = reqTxt(200);
const shortText = txt(200); // role, company, location, channel, status label…
const email = txt(320);
const phone = txt(50);
const url = txt(500); // linkedin / website
const longText = txt(5000); // notes, description, summary, bio

/* ---- Composite JSONB element shapes ------------------------------- */

export const zTag = z.object({ label: reqTxt(60), tone: zTone });
export const zInteractionType = z.enum(INTERACTION_TYPES);
export const zInteraction = z
  .object({
    label: txt(500),
    when: txt(100),
    type: zInteractionType.optional(),
    date: zDate.optional(),
    until: zDate.optional(),
  })
  // An entry needs *something* to identify it: a type, a note, or a date.
  .refine((i) => Boolean(i.type || i.label || i.date), {
    message: "Add a type or a note",
  });
export const zExtraField = z.object({ label: reqTxt(100), value: txt(1000) });
export const zSubtask = z.object({
  id: txt(100),
  label: reqTxt(300),
  done: z.boolean(),
});
export const zStrList = z.array(txt(200)).max(200);

/* ---- Per-action input schemas ------------------------------------- */

const contact = {
  role: shortText.optional(),
  company: shortText.optional(),
  email: email.optional(),
};

export const CreateConnectionInput = z.object({ name, ...contact });
export const CreateLinkedConnectionInput = CreateConnectionInput;

export const CreateEventInput = z.object({
  name,
  eventDate: zDate,
  location: shortText.optional(),
});

export const CreateProjectInput = z.object({
  name,
  summary: longText.optional(),
});

export const UpdateConnectionPatch = z.object({
  name,
  role: shortText.optional(),
  company: shortText.optional(),
  email: email.optional(),
  phone: phone.optional(),
  location: shortText.optional(),
  linkedin: url.optional(),
  birthday: zDate.nullable().optional(),
  tags: z.array(zTag).max(100).optional(),
  avatarTone: zTone.optional(),
  extraFields: z.array(zExtraField).max(100).optional(),
});

export const InteractionsInput = z.array(zInteraction).max(500);

export const UpdateEventPatch = z.object({
  name,
  eventDate: zDate,
  location: shortText.optional(),
  organizers: zStrList.optional(),
  metGuests: zStrList.optional(),
  note: longText.optional(),
  link: url.optional(),
  hostedByMe: z.boolean().optional(),
  invitedById: zUuidOrEmpty.nullable().optional(),
  avatarTone: zTone.optional(),
});

export const UpdateProjectPatch = z.object({
  name,
  summary: longText.optional(),
  description: longText.optional(),
  statusLabel: shortText.optional(),
  statusTone: zTone.optional(),
  icon: txt(100).optional(),
  tone: zTone.optional(),
});

export const CreateTaskInput = z.object({
  label: reqTxt(500),
  dueDate: zDate.nullable().optional(),
  description: longText.optional(),
});

export const UpdateTaskPatch = z.object({
  label: reqTxt(500).optional(),
  dueDate: zDate.nullable().optional(),
  description: longText.optional(),
});

export const SubtasksInput = z.array(zSubtask).max(200);

export const CreateStageInput = z.object({
  label: reqTxt(200),
  startDate: zDate,
  endDate: zDate,
  tone: zTone.optional(),
});

const outreachFields = {
  channel: shortText.optional(),
  email: email.optional(),
  phone: phone.optional(),
  website: url.optional(),
  status: zStatus.optional(),
  connectionId: zUuidOrEmpty.nullable().optional(),
  lastContacted: zDateOrEmpty.nullable().optional(),
  followUpAt: zDateOrEmpty.nullable().optional(),
  notes: longText.optional(),
};

export const CreateOutreachInput = z.object({
  label: reqTxt(200),
  ...outreachFields,
});

export const UpdateOutreachPatch = z.object({
  label: reqTxt(200).optional(),
  ...outreachFields,
});
