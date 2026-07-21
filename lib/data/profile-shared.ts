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

/** The "Check-ins" toggle + cadence kept in `Profile.settings.notifications`. */
export type CheckInNotificationSettings = {
  enabled: boolean;
  /** Whole number; the magnitude of the cadence the user picked. */
  value: number;
  /** Days / weeks / months; converted to whole days by `intervalDays`. */
  unit: "days" | "weeks" | "months";
};

/** Every notification toggle the Settings UI surfaces. */
export type NotificationSettings = {
  checkins: CheckInNotificationSettings;
};

/** Read the extended fields off a Profile's settings blob, typed. */
export function profileExtras(profile: Profile | null): ProfileExtras {
  const raw = profile?.settings?.profile;
  return raw && typeof raw === "object" ? (raw as ProfileExtras) : {};
}

/**
 * Read the user's notification settings, with safe defaults for missing values.
 * The Settings UI's defaults (6 weeks for check-ins) match the original local
 * state, so a brand-new user who never opened Settings sees the same reminder
 * cadence they would have seen before this field was persisted.
 */
export function notificationSettings(
  profile: Profile | null,
): NotificationSettings {
  const raw = profile?.settings?.notifications;
  const checkins =
    raw && typeof raw === "object" && "checkins" in (raw as Record<string, unknown>)
      ? (raw as { checkins?: Partial<CheckInNotificationSettings> }).checkins
      : undefined;
  return {
    checkins: {
      enabled: checkins?.enabled ?? true,
      value: checkins?.value ?? 6,
      unit: checkins?.unit ?? "weeks",
    },
  };
}

export type SaveProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string };
