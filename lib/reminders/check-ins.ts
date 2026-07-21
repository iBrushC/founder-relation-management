/**
 * "Check-in" reminders — pure logic for recurring "nudge me to reach out every N
 * days" reminders. Kept dependency-free (no DB, no React) so the read/write
 * paths and the unit tests can all import the same arithmetic.
 *
 * Mental model:
 *  - A cycle starts on the date of the user's last interaction with a person.
 *  - The reminder becomes "due" N days after the cycle starts, where N is the
 *    user's configured interval.
 *  - Once shown (or the user dismisses it), we advance `lastNotifiedAt` to the
 *    due date. The next due date is then `lastNotifiedAt + N days`, which is
 *    what makes the reminder *cyclic* — without interaction, a 21-day interval
 *    fires at day 21, day 42, day 63, …
 *  - Logging a new interaction resets the cycle: `lastNotifiedAt` is cleared
 *    and the next due is computed from the new interaction date.
 *
 * This module never reads or writes the DB itself — it only computes values
 * given inputs.
 */

export type CheckInIntervalUnit = "days" | "weeks" | "months";

/** The user's check-in preference: a switch, a value, and the unit it applies to. */
export type CheckInSetting = {
  enabled: boolean;
  value: number;
  unit: CheckInIntervalUnit;
};

/** The state of one connection's recurring reminder. */
export type CheckInState = {
  /** ISO date the user last interacted with this person, or null if never. */
  lastInteractionDate: string | null;
  /** ISO date the reminder was last shown/acknowledged, or null if never. */
  lastNotifiedAt: string | null;
  /**
   * Anchor for the current cycle. The reminder becomes due `intervalDays`
   * after this date. Equal to `max(lastInteractionDate, lastNotifiedAt)`
   * (see {@link cycleAnchorFor}).
   */
};

/** Convert a CheckInSetting's (value, unit) into a whole-day count. */
export function intervalDays(setting: CheckInSetting): number {
  const v = Math.max(1, Math.floor(setting.value));
  switch (setting.unit) {
    case "days":
      return v;
    case "weeks":
      return v * 7;
    case "months":
      // Calendar months don't translate to a fixed day count, but the user's
      // setting is expressed in months so we honor it: anchor + 30 * N days
      // gives a steady, predictable cadence without depending on the anchor
      // month's length.
      return v * 30;
  }
}

/**
 * The start of the cycle a reminder is currently being measured against.
 * If the user logged a fresh interaction after the last reminder fired, the
 * interaction date wins; otherwise the previous due date anchors the next one
 * (which is what makes it cyclic). When both are null, there is no anchor and
 * the caller decides what to do (e.g. suppress until first interaction).
 */
export function cycleAnchorFor(state: CheckInState): string | null {
  const { lastInteractionDate, lastNotifiedAt } = state;
  if (lastInteractionDate && lastNotifiedAt) {
    return lastInteractionDate > lastNotifiedAt
      ? lastInteractionDate
      : lastNotifiedAt;
  }
  return lastInteractionDate ?? lastNotifiedAt;
}

/** Add `days` whole days to an ISO date, returning ISO. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1);
  const b = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1);
  return Math.round((b - a) / 86_400_000);
}

export type CheckInDue = {
  /** ISO date this reminder is currently due on. */
  dueAt: string;
  /**
   * The anchor the due date is measured against (last interaction, or the
   * previous due date if the cycle is rolling forward). Useful for the UI.
   */
  cycleAnchor: string;
};

/**
 * The next reminder due date for a connection, given its state and the user's
 * setting. Returns null when there's no anchor (no interactions yet, no prior
 * reminder) — those connections are silent until the user logs their first
 * touchpoint. Per the requirement, connections with no interactions do receive
 * a reminder, so callers that want to nudge brand-new contacts should pass a
 * synthetic anchor (e.g. the connection's createdAt) rather than null.
 */
export function computeCheckInDue(
  state: CheckInState,
  setting: CheckInSetting,
): CheckInDue | null {
  if (!setting.enabled) return null;
  const anchor = cycleAnchorFor(state);
  if (!anchor) return null;
  const dueAt = addDaysIso(anchor, intervalDays(setting));
  return { dueAt, cycleAnchor: anchor };
}

/** True iff `dueAt` falls on or before `today` (i.e. it should surface now). */
export function isCheckInDue(dueAt: string, today: string): boolean {
  return daysBetween(dueAt, today) >= 0;
}

/**
 * Compute the new state after a user "acknowledges" a reminder (e.g. clicks
 * "Mark done" or it gets shown in the feed). The cycle rolls forward: the
 * previous due date becomes the anchor for the next interval.
 */
export function acknowledgeCheckIn(
  state: CheckInState,
  setting: CheckInSetting,
): CheckInState {
  const due = computeCheckInDue(state, setting);
  if (!due) return state;
  return { ...state, lastNotifiedAt: due.dueAt };
}

/**
 * Compute the new state after an interaction is logged. The interaction date
 * becomes the new anchor; any prior "last notified" date is cleared so the
 * cycle restarts from the interaction date (the user just talked to them —
 * the previous "I meant to talk to them" no longer matters).
 */
export function onInteractionLogged(
  state: CheckInState,
  interactionDate: string,
): CheckInState {
  return {
    lastInteractionDate:
      !state.lastInteractionDate ||
      interactionDate > state.lastInteractionDate
        ? interactionDate
        : state.lastInteractionDate,
    lastNotifiedAt: null,
  };
}