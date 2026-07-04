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
