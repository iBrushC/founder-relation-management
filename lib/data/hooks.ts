"use client";

import useSWR from "swr";
import type { Profile } from "@/lib/data/profiles";
import type { SearchItem } from "@/lib/data/search";

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

async function searchFetcher(url: string): Promise<SearchItem[]> {
  const res = await fetch(url);
  if (res.status === 401) return [];
  if (!res.ok) throw new Error("Failed to load search index");
  return res.json();
}

/**
 * The global search index for the top-bar palette. Lazily loaded — pass
 * `enabled: false` to hold the request until the user actually opens search —
 * and cached/deduped by SWR so repeat opens are instant.
 */
export function useSearch(enabled = true) {
  const { data, error, isLoading } = useSWR<SearchItem[]>(
    enabled ? "/api/search" : null,
    searchFetcher,
    { revalidateOnFocus: false },
  );
  return { items: data ?? [], isLoading, error };
}
