"use server";

import { z } from "zod";
import { getProfile, updateProfile } from "@/lib/data/profiles";
import { profileExtras, type SaveProfileResult } from "@/lib/data/profile-shared";

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
  resume: z.string().max(500).nullable().optional(),
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
