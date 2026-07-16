import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A `cmdk` filter that matches all whitespace-separated terms against an item's
 * `keywords`, so "sam alder" finds "Sam Whitfield · Alder Ventures". The item's
 * `value` is ignored on purpose: it carries an id for identity, and letting the
 * fuzzy default score it would match stray characters inside the uuid.
 */
export function matchAllTerms(
  _value: string,
  search: string,
  keywords?: string[],
): number {
  const haystack = (keywords ?? []).join(" ").toLowerCase()
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return 1
  return terms.every((t) => haystack.includes(t)) ? 1 : 0
}
