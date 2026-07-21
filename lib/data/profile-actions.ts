"use server";

import { z } from "zod";
import { getProfile, updateProfile } from "@/lib/data/profiles";
import {
  profileExtras,
  type ResumeRef,
  type SaveProfileResult,
} from "@/lib/data/profile-shared";
import { PLAN_VALUES, type Plan } from "@/lib/data/billing";

/**
 * Client-callable write for the Settings "About" form. Wraps the `updateProfile`
 * DAL: the display name lands in the `full_name` column, and the extra
 * biographical fields (bio, school, country, timezone, resume) live under
 * `settings.profile` in the profile's jsonb blob — the `profiles` table has no
 * dedicated columns for them.
 *
 * As a `"use server"` module this may only export async functions; the shared
 * types and the sync `profileExtras` helper live in `profile-shared.ts`.
 */

const SaveProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(200),
  bio: z.string().max(2000).optional(),
  school: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(100).optional(),
  resume: z
    .object({ path: z.string().max(500), name: z.string().max(300) })
    .nullable()
    .optional(),
});

export async function saveProfile(input: unknown): Promise<SaveProfileResult> {
  const parsed = SaveProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid profile.",
    };
  }

  const { fullName, ...extras } = parsed.data;

  // Merge into existing settings so we don't clobber other jsonb keys.
  const current = await getProfile();
  const prevSettings = current?.settings ?? {};
  const prevExtras = profileExtras(current);

  const settings = {
    ...prevSettings,
    profile: { ...prevExtras, ...extras },
  };

  const profile = await updateProfile({ fullName, settings });
  if (!profile) return { ok: false, error: "Couldn't save your profile." };

  return { ok: true, profile };
}

const ResumeSchema = z
  .object({ path: z.string().max(500), name: z.string().max(300) })
  .nullable();

/**
 * Persist just the resume reference (after an upload or removal), without
 * touching the name/bio the user may be mid-editing in the About form. Keeps the
 * `resumes` bucket and the profile in sync as a single step.
 */
export async function saveResume(
  resume: ResumeRef | null,
): Promise<SaveProfileResult> {
  const parsed = ResumeSchema.safeParse(resume);
  if (!parsed.success) return { ok: false, error: "Invalid resume." };

  const current = await getProfile();
  const prevSettings = current?.settings ?? {};
  const prevExtras = profileExtras(current);

  const settings = {
    ...prevSettings,
    profile: { ...prevExtras, resume: parsed.data },
  };

  const profile = await updateProfile({ settings });
  if (!profile) return { ok: false, error: "Couldn't save your resume." };

  return { ok: true, profile };
}

const CheckInSchema = z.object({
  enabled: z.boolean(),
  value: z.number().int().min(1).max(365),
  unit: z.enum(["days", "weeks", "months"]),
});

const NotificationSettingsSchema = z.object({
  checkins: CheckInSchema,
});

export type SaveNotificationSettingsResult =
  | { ok: true; profile: import("@/lib/data/profiles").Profile }
  | { ok: false; error: string };

/**
 * Persist the notification toggles (currently just the Check-ins cadence).
 * Lives alongside `saveProfile` so the Settings page can save the About card
 * and the Notification card with two distinct actions without clobbering each
 * other's jsonb keys — both are merged into the same `settings` blob.
 */
export async function saveNotificationSettings(
  input: unknown,
): Promise<SaveNotificationSettingsResult> {
  const parsed = NotificationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid notification settings.",
    };
  }

  const current = await getProfile();
  const prevSettings = current?.settings ?? {};

  const settings = {
    ...prevSettings,
    notifications: parsed.data,
  };

  const profile = await updateProfile({ settings });
  if (!profile) return { ok: false, error: "Couldn't save your settings." };

  return { ok: true, profile };
}

const PlanSchema = z.object({
  plan: z.enum(PLAN_VALUES as unknown as [Plan, ...Plan[]]),
});

export type SavePlanResult = SaveProfileResult;

/**
 * Persist the user's plan tier. Lives in the same `settings.billing` blob as
 * the rest of the billing-shaped settings so future keys (renewal date,
 * seats…) can ride along without another column. Payment isn't wired up —
 * this just toggles which features the UI and server allow.
 */
export async function savePlan(input: unknown): Promise<SavePlanResult> {
  const parsed = PlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid plan.",
    };
  }

  const current = await getProfile();
  const prevSettings = current?.settings ?? {};
  const prevBilling =
    prevSettings.billing && typeof prevSettings.billing === "object"
      ? (prevSettings.billing as Record<string, unknown>)
      : {};

  const settings = {
    ...prevSettings,
    billing: { ...prevBilling, plan: parsed.data.plan },
  };

  const profile = await updateProfile({ settings });
  if (!profile) return { ok: false, error: "Couldn't save your plan." };

  return { ok: true, profile };
}
