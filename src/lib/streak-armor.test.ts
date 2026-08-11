import { describe, it, expect } from "vitest";

import { runStreakArmor } from "./streak-armor";
import { isoDay } from "./calc";
import type { AppState } from "./types";

const NOW = new Date("2026-07-27T12:00:00"); // a Monday, local time

function dayAt(offset: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - offset);
  return isoDay(d);
}

function stateWith(completedOffsets: number[], shields: number): AppState {
  return {
    profile: { goal: "BULK" },
    completedDates: completedOffsets.map(dayAt),
    streakArmor: { shields, lastRefillMonth: isoDay(NOW).slice(0, 7), usedDates: [] },
  } as unknown as AppState;
}

describe("runStreakArmor", () => {
  it("does nothing for free users or unbroken streaks", () => {
    expect(runStreakArmor(stateWith([1, 2, 3], 3), false, NOW)).toBeNull();
    expect(runStreakArmor(stateWith([1, 2, 3], 3), true, NOW)).toBeNull();
  });

  it("rescues a single missed day with one shield", () => {
    const r = runStreakArmor(stateWith([2, 3, 4], 3), true, NOW)!;
    expect(r.consumedDate).toBe(dayAt(1));
    expect(r.next.streakArmor!.shields).toBe(2);
    expect(r.next.completedDates).toContain(dayAt(1));
  });

  it("bridges a two-day weekend gap with two shields", () => {
    // Trained through Friday (offset 3), missed Sat+Sun, opened Monday.
    const r = runStreakArmor(stateWith([3, 4, 5], 3), true, NOW)!;
    expect(r.next.streakArmor!.shields).toBe(1);
    expect(r.next.completedDates).toContain(dayAt(1));
    expect(r.next.completedDates).toContain(dayAt(2));
  });

  it("never spends shields without a streak to anchor to", () => {
    // Nothing completed in the last 5 days — there is no streak to save.
    expect(runStreakArmor(stateWith([5, 6], 3), true, NOW)).toBeNull();
  });

  it("never bridges a gap it can't fully afford", () => {
    // Two-day gap but only one shield: spending it would still break the streak.
    const r = runStreakArmor(stateWith([3, 4, 5], 1), true, NOW);
    expect(r).toBeNull();
  });
});
