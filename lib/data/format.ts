/**
 * Pure date/label formatters that turn stored values (ISO dates, timestamps)
 * into the human strings the UI display types expect (`"Jul 12"`, `"in 3 days"`,
 * `"2h ago"`). Kept dependency-free so both the read mappers and the sample-data
 * seeder can share them.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Parse a `YYYY-MM-DD` string into its numeric parts (no timezone shifting). */
function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** `"2026-03-22"` → `"Mar 22"`. */
export function formatMonthDay(iso: string): string {
  const { m, d } = parts(iso);
  return `${MONTHS[m - 1]} ${d}`;
}

/** Whole days from today to an ISO date (negative = past), calendar-based. */
function daysUntil(iso: string): number {
  const { y, m, d } = parts(iso);
  const now = new Date();
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** Is this ISO date today or later? Drives the `upcoming` flag on events. */
export function isUpcoming(iso: string): boolean {
  return daysUntil(iso) >= 0;
}

/**
 * A friendly "when" label: relative for the coming week, otherwise a month/day.
 * `"Today"`, `"Tomorrow"`, `"in 4 days"`, `"Yesterday"`, else `"Jul 12"`.
 */
export function formatWhen(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 1 && n <= 7) return `in ${n} days`;
  if (n === -1) return "Yesterday";
  return formatMonthDay(iso);
}

export type DayBucket = "today" | "tomorrow" | "yesterday" | "other";

/**
 * Which of the three tracked day-windows an ISO date falls in, else `"other"` —
 * the homepage Updates feed groups on this (today, then tomorrow, then yesterday).
 */
export function dayBucket(iso: string): DayBucket {
  switch (daysUntil(iso)) {
    case 0:
      return "today";
    case 1:
      return "tomorrow";
    case -1:
      return "yesterday";
    default:
      return "other";
  }
}

/** An arbitrary `Date` as an ISO `YYYY-MM-DD` string (local time). */
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Today as an ISO `YYYY-MM-DD` string (local time). */
export function todayIso(): string {
  return toIso(new Date());
}

const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

/** `ref` shifted by `delta` whole days (local), as a fresh `Date`. */
function addDays(ref: Date, delta: number): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + delta);
}

export type DateMatch = {
  /** Recognized date as ISO `YYYY-MM-DD`. */
  iso: string;
  /**
   * Half-open `[start, end)` range in the source text that produced the date —
   * includes a leading connector ("on"/"at"/"@") — so the caller can highlight
   * it in-field and remove the phrase from the saved note.
   */
  start: number;
  end: number;
};

/**
 * Best-effort natural-language date recognition inside free text, so a logged
 * note like "coffee yesterday" or "call Jun 3" can auto-date itself. Scans for
 * the first phrase it understands (checked in priority order) and returns the
 * date (relative to `ref`, default today) together with the text range that
 * expressed it; returns null when nothing date-like is found.
 *
 * Understands: an explicit ISO date; numeric `M/D/Y` ("3/12/2029", "3-12-29",
 * month-first); today/yesterday/tomorrow; "N days/weeks ago"; "last week";
 * "last/this/next/on <weekday>" and a bare "<weekday>" (the most recent past
 * occurrence); and a month name with a day ("Jun 3", "June 3rd", "3 June") —
 * assumed to be the most recent such date, so a month/day still ahead of today
 * rolls back to last year.
 */
export function recognizeDate(
  text: string,
  ref: Date = new Date(),
): DateMatch | null {
  const t = text.toLowerCase();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());

  // Absorb a connector immediately before the date ("... on March 12") into the
  // removed range, then package the hit.
  const hit = (start: number, end: number, iso: string): DateMatch => {
    const lead = text.slice(0, start).match(/(^|\s)(on|at|@)\s*$/i);
    if (lead) start = (lead.index ?? 0) + lead[1].length;
    return { iso, start, end };
  };
  const spanOf = (m: RegExpMatchArray): [number, number] => {
    const s = m.index ?? 0;
    return [s, s + m[0].length];
  };

  // Explicit ISO date — trust it verbatim.
  const isoM = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoM && +isoM[2] >= 1 && +isoM[2] <= 12 && +isoM[3] >= 1 && +isoM[3] <= 31) {
    return hit(...spanOf(isoM), isoM[0]);
  }

  // Numeric month-first date: "3/12/2029", "3-12-29".
  const num = t.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (num) {
    const mon = +num[1];
    const day = +num[2];
    const year = num[3].length <= 2 ? 2000 + +num[3] : +num[3];
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return hit(...spanOf(num), toIso(new Date(year, mon - 1, day)));
    }
  }

  // Relative keywords.
  for (const [re, delta] of [
    [/\b(today|tonight)\b/, 0],
    [/\byesterday\b/, -1],
    [/\btomorrow\b/, 1],
    [/\blast\s+week\b/, -7],
  ] as const) {
    const m = t.match(re);
    if (m) return hit(...spanOf(m), toIso(addDays(today, delta)));
  }

  // "3 days ago", "2 weeks ago".
  const ago = t.match(/\b(\d{1,3})\s+(day|days|week|weeks)\s+ago\b/);
  if (ago) {
    const n = Number(ago[1]) * (ago[2].startsWith("week") ? 7 : 1);
    return hit(...spanOf(ago), toIso(addDays(today, -n)));
  }

  // "last Tuesday", "next Fri", "on monday", or a bare weekday name.
  const wd = t.match(
    /\b(last|this|next|on\s+)?\s*(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?\b/,
  );
  if (wd) {
    const target = WEEKDAYS.findIndex((d) => d.startsWith(wd[2].slice(0, 3)));
    if (target >= 0) {
      const dow = today.getDay();
      const kind = (wd[1] ?? "").trim();
      const delta =
        kind === "next"
          ? (target - dow + 7) % 7 || 7 // upcoming
          : kind === "last"
            ? -(((dow - target + 7) % 7) || 7) // strictly prior week
            : -((dow - target + 7) % 7); // most recent (today if same day)
      return hit(...spanOf(wd), toIso(addDays(today, delta)));
    }
  }

  // "Jun 3", "June 3rd", "3 Jun" — pick the most recent matching date. The month
  // is a full name or a known abbreviation only (longest first), so ordinary
  // words that merely start with those letters ("market", "decided") don't match.
  const monthRe =
    "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?";
  const dayRe = "(\\d{1,2})(?:st|nd|rd|th)?";
  const md =
    t.match(new RegExp(`\\b${monthRe}\\s+${dayRe}\\b`)) ??
    t.match(new RegExp(`\\b${dayRe}\\s+${monthRe}\\b`));
  if (md) {
    // Group order differs between the two shapes; find the numeric + month parts.
    const nums = md.slice(1).filter((g) => g && /^\d+$/.test(g));
    const monStr = md.slice(1).find((g) => g && /^[a-z]/.test(g));
    const day = nums.length ? Number(nums[0]) : NaN;
    const month = monStr
      ? MONTHS.findIndex((m) => m.toLowerCase() === monStr.slice(0, 3))
      : -1;
    if (month >= 0 && day >= 1 && day <= 31) {
      let year = today.getFullYear();
      let candidate = new Date(year, month, day);
      if (candidate > today) candidate = new Date(--year, month, day); // most recent past
      return hit(...spanOf(md), toIso(candidate));
    }
  }

  return null;
}

/**
 * Remove a recognized date range from a note and tidy the seam — collapse the
 * doubled space left behind, pull punctuation back against the preceding word,
 * and trim stray separators from the ends. `"Coffee on March 12"` → `"Coffee"`.
 */
export function stripDateRange(
  text: string,
  start: number,
  end: number,
): string {
  return (text.slice(0, start) + text.slice(end))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "")
    .trim();
}

/**
 * The display "when" for a logged interaction, derived from its occurrence date
 * so it *ages* (a log stamped today reads "Today", then "Yesterday" tomorrow,
 * then the month/day). A multi-day span shows both ends. Returns null when the
 * entry has no date (a legacy free-text entry that only carries a frozen label).
 */
export function formatInteractionWhen(
  date?: string,
  until?: string,
): string | null {
  if (!date) return null;
  if (until && until > date) {
    return `${formatMonthDay(date)} – ${formatMonthDay(until)}`;
  }
  return formatWhen(date);
}

/**
 * Best-effort ISO date for a *legacy* interaction that predates stored dates,
 * recovered from its frozen `when` label so it can still sort and age. Handles
 * absolute month/day labels ("Jun 24") and spans ("Jun 24 – Jun 28" → the
 * start). Returns null for relative labels ("Just now", "5 days ago") whose true
 * date was never recorded and can't be known.
 */
export function legacyWhenToIso(
  when: string,
  year = new Date().getFullYear(),
): string | null {
  const start = when.split(/[–-]/)[0].trim(); // a span → its start date
  return monthDayToIso(start, year);
}

/**
 * Order a connection's interactions most-recent first by occurrence date.
 * The sort is stable, so entries sharing a date keep their insertion order
 * (newest-added first); undated legacy entries sink to the bottom.
 */
export function sortInteractions<T extends { date?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Coarse "time ago" label from a timestamp, for a connection's last-contact. */
export function relativeSince(ts: string | Date): string {
  const then = new Date(ts).getTime();
  const mins = (Date.now() - then) / 60_000;
  if (mins < 1) return "Just now";
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.floor(hrs)}h ago`;
  const days = hrs / 24;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * Reverse of `formatMonthDay`: `"Mar 22"` → an ISO date in `year`. Returns null
 * for placeholders like `"—"`. Used by the seeder to store demo birthdays/dues.
 */
export function monthDayToIso(label: string, year: number): string | null {
  const m = label.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!m) return null;
  const month = MONTHS.findIndex((mo) => mo.toLowerCase() === m[1].toLowerCase());
  if (month < 0) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}
