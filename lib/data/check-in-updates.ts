import "server-only";

import { desc } from "drizzle-orm";

import { connections, emailThreads } from "@/drizzle/schema";
import type { Update } from "@/lib/data";
import { withUserRLS } from "@/lib/db/rls";
import { notificationSettings, profileExtras } from "@/lib/data/profile-shared";
import { getProfile } from "@/lib/data/profiles";
import { todayInZone } from "@/lib/data/format";
import { computeCheckInDue, isCheckInDue } from "@/lib/reminders/check-ins";
import type { IconKey } from "@/lib/icons";

/**
 * Build the per-connection check-in rows that surface in the Updates feed.
 *
 * The cadence comes from the user's persisted notification setting (under
 * `profiles.settings.notifications.checkins`), so each row only appears when
 * the configured interval has elapsed since the connection's last contact —
 * either the most recent logged interaction or the most recent email thread,
 * whichever is newer (per the user's "Gmail counts" decision). The reminder
 * then recurs every N days until a new interaction resets the cycle.
 *
 * "Today" is computed in the user's stored timezone so a user on the West
 * Coast doesn't see yesterday's reminder at 11 PM Pacific.
 */
export async function listCheckInUpdates(): Promise<Update[]> {
  const profile = await getProfile();
  const setting = notificationSettings(profile).checkins;
  if (!setting.enabled) return [];

  const today = todayInZone(profileExtras(profile).timezone).iso;

  return withUserRLS(async (tx) => {
    // Load everything we need: connections, their hand-written timeline, and
    // the latest email-thread date per connection (one row each). We don't
    // need the full email body — just the most recent message date.
    const [connRows, threadRows] = await Promise.all([
      tx.select().from(connections).orderBy(desc(connections.createdAt)),
      tx
        .select({
          connectionId: emailThreads.connectionId,
          lastMessageAt: emailThreads.lastMessageAt,
        })
        .from(emailThreads),
    ]);

    // For each connection, find the most recent date across timeline +
    // synced Gmail threads. The timeline entries already carry ISO dates
    // (the panel stamps them at log time).
    const latestThreadDateByConnection = new Map<string, string>();
    for (const t of threadRows) {
      const d = toIsoDate(t.lastMessageAt);
      const prev = latestThreadDateByConnection.get(t.connectionId);
      if (!prev || d > prev) latestThreadDateByConnection.set(t.connectionId, d);
    }

    const out: Update[] = [];
    for (const c of connRows) {
      const lastInteractionDate = mostRecentDate(
        c.interactions,
        latestThreadDateByConnection.get(c.id) ?? null,
      );
      // Per the requirement: people with no interactions still receive a
      // reminder on a cycle starting the day they were added. The
      // connection's createdAt is the only stable anchor available.
      const anchor = lastInteractionDate ?? toIsoDate(c.createdAt);

      const due = computeCheckInDue(
        {
          lastInteractionDate: anchor,
          // The "last notified" anchor is persisted on the row, so the cycle
          // rolls forward correctly between server reads.
          lastNotifiedAt: c.lastCheckInNotifiedAt ?? null,
        },
        setting,
      );
      if (!due) continue;
      if (!isCheckInDue(due.dueAt, today)) continue;

      // The Updates panel groups by day bucket (today / tomorrow / yesterday);
      // overdue reminders have a `dueAt` in the past and would otherwise fall
      // outside all three groups. Clamp the date to "today" so they surface in
      // the Today bucket — the "X days overdue" label still tells the user how
      // late they are.
      const displayDate = due.dueAt < today ? today : due.dueAt;

      out.push({
        id: `check_in:${c.id}`,
        icon: "coffee" as IconKey,
        title: `Check in with ${c.name}`,
        kind: "Check-in",
        tone: "blue",
        date: displayDate,
        when: relativeDayLabel(due.dueAt, today),
        detail:
          lastInteractionDate === null
            ? `It's been a while — reach out to ${c.name} for the first time.`
            : `It's been a while since you last connected with ${c.name}. Time to reach out.`,
        connectionIds: [c.id],
        projectIds: [],
      });
    }
    return out;
  });
}

/** The later of the timeline's top entry, the latest Gmail thread, or null. */
function mostRecentDate(
  interactions: ReadonlyArray<{ date?: string }>,
  threadDate: string | null,
): string | null {
  const top = interactions[0]?.date ?? null;
  if (top && threadDate) return top > threadDate ? top : threadDate;
  return top ?? threadDate;
}

/** YYYY-MM-DD for a timestamptz, computed in server-local time. */
function toIsoDate(ts: Date | string): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A short "due today" / "1 day overdue" / "in N days" label. */
function relativeDayLabel(dueAt: string, today: string): string {
  const d = Math.round(
    (Date.UTC(
      +dueAt.slice(0, 4),
      +dueAt.slice(5, 7) - 1,
      +dueAt.slice(8, 10),
    ) -
      Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))) /
      86_400_000,
  );
  if (d === 0) return "Today";
  if (d < 0) return `${-d} day${-d === 1 ? "" : "s"} overdue`;
  return `in ${d} day${d === 1 ? "" : "s"}`;
}