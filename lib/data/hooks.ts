"use client";

import useSWR from "swr";
import type { Profile } from "@/lib/data/profiles";

async function fetcher(url: string): Promise<Profile | null> {
  const res = await fetch(url);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

/** Client-side access to the signed-in user's profile via the /api/profile route. */
export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR<Profile | null>(
    "/api/profile",
    fetcher,
  );
  return { profile: data ?? null, isLoading, error, mutate };
}
