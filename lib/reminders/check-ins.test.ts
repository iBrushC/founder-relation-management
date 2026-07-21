/**
 * Tests for the pure check-in reminder logic. Run with `node --import tsx
 * --test lib/reminders/check-ins.test.ts` (or `npm test`).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  addDaysIso,
  acknowledgeCheckIn,
  computeCheckInDue,
  cycleAnchorFor,
  daysBetween,
  intervalDays,
  isCheckInDue,
  onInteractionLogged,
  type CheckInSetting,
} from "./check-ins";

const setting = (overrides: Partial<CheckInSetting> = {}): CheckInSetting => ({
  enabled: true,
  value: 21,
  unit: "days",
  ...overrides,
});

test("intervalDays — converts weeks and months to days", () => {
  assert.equal(intervalDays(setting({ value: 1, unit: "days" })), 1);
  assert.equal(intervalDays(setting({ value: 3, unit: "weeks" })), 21);
  assert.equal(intervalDays(setting({ value: 2, unit: "months" })), 60);
});

test("intervalDays — clamps to a minimum of 1", () => {
  assert.equal(intervalDays(setting({ value: 0, unit: "days" })), 1);
  assert.equal(intervalDays(setting({ value: -5, unit: "days" })), 1);
});

test("addDaysIso — handles month boundaries", () => {
  assert.equal(addDaysIso("2026-01-30", 3), "2026-02-02");
  assert.equal(addDaysIso("2026-02-28", 1), "2026-03-01");
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
});

test("daysBetween — whole calendar days, sign-correct", () => {
  assert.equal(daysBetween("2026-01-01", "2026-01-08"), 7);
  assert.equal(daysBetween("2026-01-08", "2026-01-01"), -7);
  assert.equal(daysBetween("2026-01-01", "2026-01-01"), 0);
});

test("computeCheckInDue — fires 21 days after the last interaction", () => {
  const due = computeCheckInDue(
    { lastInteractionDate: "2026-01-01", lastNotifiedAt: null },
    setting(),
  );
  assert.deepEqual(due, { dueAt: "2026-01-22", cycleAnchor: "2026-01-01" });
});

test("computeCheckInDue — cyclic: fires every 21 days if never interacted again", () => {
  // Day 0: last interaction.
  let state = {
    lastInteractionDate: "2026-01-01" as string | null,
    lastNotifiedAt: null as string | null,
  };

  // Day 21: first reminder.
  let due = computeCheckInDue(state, setting());
  assert.equal(due?.dueAt, "2026-01-22");
  state = acknowledgeCheckIn(state, setting());

  // Day 42: second reminder — anchor is the previous due date (cycle rolls).
  due = computeCheckInDue(state, setting());
  assert.equal(due?.dueAt, "2026-02-12");
  state = acknowledgeCheckIn(state, setting());

  // Day 63: third reminder.
  due = computeCheckInDue(state, setting());
  assert.equal(due?.dueAt, "2026-03-05");
});

test("computeCheckInDue — interaction resets the cycle anchor", () => {
  // Acknowledged at day 21, anchor = 01-22.
  let state = {
    lastInteractionDate: null as string | null,
    lastNotifiedAt: "2026-01-22" as string | null,
  };

  // User logs a fresh interaction on day 25 — anchor should now be 01-26,
  // and the next reminder falls on 01-26 + 21 = 02-16.
  state = onInteractionLogged(state, "2026-01-26");
  const due = computeCheckInDue(state, setting());
  assert.equal(due?.dueAt, "2026-02-16");
  assert.equal(due?.cycleAnchor, "2026-01-26");
});

test("computeCheckInDue — interaction within the cycle restarts the cycle", () => {
  // Last interaction 01-01, anchor for cycle 1 = 01-01. Acknowledged on day 21
  // means lastNotifiedAt = 01-22. Now interaction on day 25 (after the first
  // reminder fired) — anchor must become the interaction, not the previous
  // due date.
  let state = {
    lastInteractionDate: "2026-01-01" as string | null,
    lastNotifiedAt: "2026-01-22" as string | null,
  };
  state = onInteractionLogged(state, "2026-01-26");
  const due = computeCheckInDue(state, setting());
  assert.equal(due?.cycleAnchor, "2026-01-26");
});

test("computeCheckInDue — disabled setting never fires", () => {
  const due = computeCheckInDue(
    { lastInteractionDate: "2026-01-01", lastNotifiedAt: null },
    setting({ enabled: false }),
  );
  assert.equal(due, null);
});

test("computeCheckInDue — no anchor returns null (no reminder for a never-touched contact)", () => {
  const due = computeCheckInDue({ lastInteractionDate: null, lastNotifiedAt: null }, setting());
  assert.equal(due, null);
});

test("isCheckInDue — due today and any earlier date; not yet on a later date", () => {
  // Today: exactly on the due date → due.
  assert.equal(isCheckInDue("2026-01-22", "2026-01-22"), true);
  // The due date has already passed → still due (the user hasn't acked yet).
  assert.equal(isCheckInDue("2026-01-22", "2026-01-23"), true);
  // Future due date → not yet due.
  assert.equal(isCheckInDue("2026-01-23", "2026-01-22"), false);
});

test("cycleAnchorFor — picks the more recent of interaction and previous reminder", () => {
  assert.equal(
    cycleAnchorFor({
      lastInteractionDate: "2026-01-01",
      lastNotifiedAt: "2026-01-22",
    }),
    "2026-01-22",
  );
  assert.equal(
    cycleAnchorFor({
      lastInteractionDate: "2026-01-26",
      lastNotifiedAt: "2026-01-22",
    }),
    "2026-01-26",
  );
  assert.equal(
    cycleAnchorFor({
      lastInteractionDate: "2026-01-01",
      lastNotifiedAt: null,
    }),
    "2026-01-01",
  );
  assert.equal(
    cycleAnchorFor({
      lastInteractionDate: null,
      lastNotifiedAt: "2026-01-22",
    }),
    "2026-01-22",
  );
  assert.equal(
    cycleAnchorFor({ lastInteractionDate: null, lastNotifiedAt: null }),
    null,
  );
});

test("acknowledgeCheckIn — advances lastNotifiedAt to the due date", () => {
  const next = acknowledgeCheckIn({ lastInteractionDate: "2026-01-01", lastNotifiedAt: null }, setting());
  assert.equal(next.lastNotifiedAt, "2026-01-22");
});

test("onInteractionLogged — out-of-order interaction keeps the most recent", () => {
  const next = onInteractionLogged(
    { lastInteractionDate: "2026-02-01", lastNotifiedAt: null },
    "2026-01-15",
  );
  assert.equal(next.lastInteractionDate, "2026-02-01");
  assert.equal(next.lastNotifiedAt, null);
});

test("onInteractionLogged — clears lastNotifiedAt so the cycle restarts", () => {
  const next = onInteractionLogged(
    { lastInteractionDate: "2026-01-01", lastNotifiedAt: "2026-01-22" },
    "2026-01-25",
  );
  assert.equal(next.lastNotifiedAt, null);
  assert.equal(next.lastInteractionDate, "2026-01-25");
});