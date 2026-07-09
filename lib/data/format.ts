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

/**
 * Best-effort natural-language date recognition inside free text, so a logged
 * note like "coffee yesterday" or "call Jun 3" can auto-date itself. Scans for
 * the first phrase it understands (checked in priority order) and returns its
 * ISO date relative to `ref` (default today); returns null when nothing
 * date-like is found.
 *
 * Understands: an explicit ISO date; today/yesterday/tomorrow; "N days/weeks
 * ago"; "last week"; "last/this/next/on <weekday>" and a bare "<weekday>" (the
 * most recent past occurrence); and a month name with a day ("Jun 3",
 * "June 3rd", "3 June") — assumed to be the most recent such date, so a
 * month/day still ahead of today rolls back to last year.
 */
export function recognizeDateInText(
  text: string,
  ref: Date = new Date(),
): string | null {
  const t = text.toLowerCase();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());

  // Explicit ISO date — trust it verbatim.
  const isoMatch = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, , mm, dd] = isoMatch;
    if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) return isoMatch[0];
  }

  if (/\btoday\b|\btonight\b/.test(t)) return toIso(today);
  if (/\byesterday\b/.test(t)) return toIso(addDays(today, -1));
  if (/\btomorrow\b/.test(t)) return toIso(addDays(today, 1));

  // "3 days ago", "2 weeks ago".
  const ago = t.match(/\b(\d{1,3})\s+(day|days|week|weeks)\s+ago\b/);
  if (ago) {
    const n = Number(ago[1]) * (ago[2].startsWith("week") ? 7 : 1);
    return toIso(addDays(today, -n));
  }
  if (/\blast\s+week\b/.test(t)) return toIso(addDays(today, -7));

  // "last Tuesday", "next Fri", "on monday", or a bare weekday name.
  const wd = t.match(
    /\b(last|this|next|on\s+)?\s*(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?\b/,
  );
  if (wd) {
    const stem = wd[2];
    const target = WEEKDAYS.findIndex((d) => d.startsWith(stem.slice(0, 3)));
    if (target >= 0) {
      const dow = today.getDay();
      const kind = (wd[1] ?? "").trim();
      let delta: number;
      if (kind === "next") {
        delta = (target - dow + 7) % 7 || 7; // upcoming
      } else if (kind === "last") {
        delta = -(((dow - target + 7) % 7) || 7); // strictly prior week
      } else {
        delta = -((dow - target + 7) % 7); // most recent (today if same day)
      }
      return toIso(addDays(today, delta));
    }
  }

  // "Jun 3", "June 3rd", "3 Jun" — pick the most recent matching date. The month
  // is a full name or a known abbreviation only (longest first), so ordinary
  // words that merely start with those letters ("market", "decided") don't match.
  const monthRe =
    "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?";
  const dayRe = "(\\d{1,2})(?:st|nd|rd|th)?";
  const md =
    t.match(new RegExp(`\\b${monthRe}\\.?\\s+${dayRe}\\b`)) ??
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
      return toIso(candidate);
    }
  }

  return null;
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
