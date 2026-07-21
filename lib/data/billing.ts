import type { Tone } from "@/lib/data";

/**
 * Plan + billing helpers. Safe to import from both client and server:
 * contains no DAL, no `"server-only"` markers, and no React.
 *
 * The active plan lives under `Profile.settings.billing.plan` (a single
 * string) — no dedicated column on `profiles`. New users (and any row with a
 * missing/unknown value) resolve to `"free"`, which is the only tier that
 * can't use Quick Add.
 */

export type Plan = "free" | "quick" | "grow";

export const PLAN_VALUES = ["free", "quick", "grow"] as const satisfies readonly Plan[];

/** Human-readable plan label, used in the Settings Select + sidebar pill. */
export const planLabel: Record<Plan, string> = {
  free: "Free",
  quick: "Quick",
  grow: "Grow",
};

/** Tone for each plan — drives the sidebar pill, reusing existing `tone-*` tokens. */
export const planTone: Record<Plan, Tone> = {
  free: "slate",
  quick: "blue",
  grow: "amber",
};

/** True for plans that may use Quick Add. Free is the only gated tier. */
export function planAllowsQuickAdd(plan: Plan): boolean {
  return plan !== "free";
}

/**
 * Read the plan off a profile's settings blob. Unknown / missing values
 * collapse to `"free"` so a brand-new user is treated as the free tier.
 */
export function resolvePlan(
  settings: Record<string, unknown> | null | undefined,
): Plan {
  const raw = (settings?.billing as { plan?: unknown } | undefined)?.plan;
  return PLAN_VALUES.includes(raw as Plan) ? (raw as Plan) : "free";
}