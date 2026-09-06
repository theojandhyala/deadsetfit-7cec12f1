import { describe, expect, it } from "vitest";

import { buildStreakAlertDrafts, DEFAULT_STREAK_ALERT_HOUR } from "./streak-notifications";
import { isoDay } from "./calc";

/** Local ISO day `offset` days before `from`. */
function dayBefore(from: Date, offset: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() - offset);
  return isoDay(d);
}

/** A fixed local morning, so "tonight's slot" is always still ahead. */
const MORNING = new Date(2026, 7, 26, 9, 0, 0);
/** After the default alert hour, so today's slot has passed. */
const LATE = new Date(2026, 7, 26, 22, 30, 0);

/** A streak of `n` days ending yesterday — today is unlogged and at risk. */
function streakEndingYesterday(n: number, now = MORNING): string[] {
  return Array.from({ length: n }, (_, i) => dayBefore(now, i + 1));
}

describe("buildStreakAlertDrafts", () => {
  it("warns tonight when an unlogged day would end a real streak", () => {
    const drafts = buildStreakAlertDrafts({ completedDates: streakEndingYesterday(12) }, MORNING);
    const tonight = drafts[0]!;
    expect(tonight.title).toContain("12-day streak");
    expect((tonight.schedule as { at: Date }).at.getHours()).toBe(DEFAULT_STREAK_ALERT_HOUR);
  });

  it("says nothing when there is no streak to lose", () => {
    expect(buildStreakAlertDrafts({ completedDates: [] }, MORNING)).toEqual([]);
    expect(buildStreakAlertDrafts({ completedDates: streakEndingYesterday(1) }, MORNING)).toEqual(
      [],
    );
  });

  it("drops tonight's warning once today is logged", () => {
    const completed = [...streakEndingYesterday(12), isoDay(MORNING)];
    const drafts = buildStreakAlertDrafts({ completedDates: completed }, MORNING);
    // Tomorrow's safety net survives; tonight's does not.
    expect(drafts.every((d) => !d.title!.includes("tonight"))).toBe(true);
  });

  it("never schedules a time that has already passed", () => {
    const drafts = buildStreakAlertDrafts(
      { completedDates: streakEndingYesterday(12, LATE) },
      LATE,
    );
    for (const draft of drafts) {
      expect((draft.schedule as { at: Date }).at.getTime()).toBeGreaterThan(LATE.getTime());
    }
  });

  it("only names the streak length on today's warning", () => {
    // Tomorrow's count depends on whether today gets logged, and a
    // notification claiming the wrong number reads as a bug.
    const drafts = buildStreakAlertDrafts({ completedDates: streakEndingYesterday(12) }, MORNING);
    const future = drafts.filter((d) => !d.title!.includes("12-day"));
    expect(future.every((d) => !/\d+-day/.test(d.title!))).toBe(true);
  });

  it("respects a custom alert hour", () => {
    const drafts = buildStreakAlertDrafts(
      { completedDates: streakEndingYesterday(5), streakAlertHour: 21 },
      MORNING,
    );
    expect((drafts[0]!.schedule as { at: Date }).at.getHours()).toBe(21);
  });

  it("goes silent when the athlete turns it off", () => {
    expect(
      buildStreakAlertDrafts(
        { completedDates: streakEndingYesterday(30), streakAlertsEnabled: false },
        MORNING,
      ),
    ).toEqual([]);
  });

  it("is on by default — an unset preference is not a disabled one", () => {
    expect(
      buildStreakAlertDrafts({ completedDates: streakEndingYesterday(5) }, MORNING).length,
    ).toBeGreaterThan(0);
  });

  it("uses distinct ids so one warning cannot overwrite another", () => {
    const drafts = buildStreakAlertDrafts({ completedDates: streakEndingYesterday(5) }, MORNING);
    expect(new Set(drafts.map((d) => d.id)).size).toBe(drafts.length);
  });

  it("routes a tap into training, not the app's front door", () => {
    const drafts = buildStreakAlertDrafts({ completedDates: streakEndingYesterday(5) }, MORNING);
    expect(drafts.every((d) => d.extra?.path === "/train")).toBe(true);
  });

  it("raises the stakes in the copy for a long streak", () => {
    const long = buildStreakAlertDrafts({ completedDates: streakEndingYesterday(40) }, MORNING);
    expect(long[0]!.body).toContain("40 days");
  });
});
