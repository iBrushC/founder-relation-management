import type { Profile } from "@/lib/data/profiles";

/**
 * Client-safe profile helpers and types. Kept out of `profile-actions.ts`
 * because that file is `"use server"` — a Server Actions module may only export
 * async functions, not types or sync helpers. Importing `Profile` here is
 * type-only, so none of the server-only DAL code is pulled into the client.
 */

/** An uploaded resume: its storage path in the `resumes` bucket + display name. */
export type ResumeRef = { path: string; name: string };

/** Extended profile fields kept in `Profile.settings.profile`. */
export type ProfileExtras = {
  bio?: string;
  school?: string;
  country?: string;
  timezone?: string;
  /** Uploaded resume reference, or null when none. */
  resume?: ResumeRef | null;
};

/** Read the extended fields off a Profile's settings blob, typed. */
export function profileExtras(profile: Profile | null): ProfileExtras {
  const raw = profile?.settings?.profile;
  return raw && typeof raw === "object" ? (raw as ProfileExtras) : {};
}

export type SaveProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string };
