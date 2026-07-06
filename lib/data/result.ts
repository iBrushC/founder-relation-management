import type { ZodError } from "zod";

/**
 * The result contract for CRM write actions (`lib/data/actions.ts`).
 *
 * Actions used to return `void` and fail *silently* — a thrown DB error or a
 * rejected-by-validation input (rec 2) both looked identical to success on the
 * client. `ActionResult` makes the outcome explicit so the UI can revert its
 * optimistic change and surface a message (rec 1 — see REVIEW_FOLLOWUPS.md):
 *
 *   - `{ ok: true }`            — succeeded (optionally carrying `data`).
 *   - `{ ok: false, error }`    — rejected/failed, with a user-facing message.
 *
 * `data` is optional so the common "nothing to return" success stays `{ ok: true }`.
 */
export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Shown when a mutation throws for a reason we don't have a specific message for. */
const GENERIC_ERROR = "Something went wrong. Please try again.";

export const ok = <T>(data?: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

/**
 * The first human-readable message from a Zod failure, for surfacing to the
 * user. Field caps/enums use Zod's default text; a friendly fallback covers the
 * rare empty case.
 */
export function firstIssue(
  error: ZodError,
  fallback = "That doesn't look right — please check your input.",
): string {
  return error.issues[0]?.message || fallback;
}

/**
 * Next.js signals `redirect()` / `notFound()` by *throwing* a tagged error that
 * the framework must catch itself — swallowing it (e.g. treating a login
 * redirect as a failed mutation) would break navigation. Detect it by digest.
 */
function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

/**
 * Run a mutation body and turn a thrown DB/unknown error into a failed
 * `ActionResult` so the client can surface it. Next.js redirect/notFound errors
 * are re-thrown untouched. Validation should run *before* this and short-circuit
 * with `fail(...)`; `run` only guards the side-effecting body.
 */
export async function run<T>(fn: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    console.error(e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
