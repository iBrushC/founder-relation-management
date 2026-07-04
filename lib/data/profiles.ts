import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/data/session";

/**
 * DAL + DTO for the `profiles` table. Partitioned by database table, not by
 * page: any feature that needs profile data comes through here, and every
 * function validates the user before touching the row.
 */

/** Data Transfer Object — the only shape of a profile the rest of the app sees. */
export type Profile = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  settings: Record<string, unknown>;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  settings: Record<string, unknown> | null;
};

const COLUMNS = "id, email, full_name, avatar_url, settings";

/** Map a raw DB row to the DTO — drops timestamps and any future internal columns. */
function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    settings: row.settings ?? {},
  };
}

/** The signed-in user's own profile, or null if it can't be read. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const { userId } = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNS)
    .eq("id", userId)
    .single<ProfileRow>();

  if (error || !data) return null;
  return toProfile(data);
});

/** Update the signed-in user's own profile. RLS + the id filter both scope it. */
export async function updateProfile(input: {
  fullName?: string;
  avatarUrl?: string;
  settings?: Record<string, unknown>;
}): Promise<Profile | null> {
  const { userId } = await verifySession();
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;
  if (input.settings !== undefined) patch.settings = input.settings;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(COLUMNS)
    .single<ProfileRow>();

  if (error || !data) return null;
  return toProfile(data);
}
