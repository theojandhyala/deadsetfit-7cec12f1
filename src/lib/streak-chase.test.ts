import { describe, it, expect } from "vitest";

import { currentStreakAsOf, streakChase } from "./streak-chase";

const TODAY = "2026-07-31";

function run(start: string, days: number): string[] {
  const out: string[] = [];
  const t0 = new Date(`${start}T00:00:00Z`).getTime();
  for (let i = 0; i < days; i++) {
    out.push(new Date(t0 + i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

describe("currentStreakAsOf", () => {
  it("counts a run ending yesterday without punishing an open today", () => {
    expect(currentStreakAsOf(run("2026-07-28", 3), TODAY)).toBe(3); // 28,29,30
    expect(currentStreakAsOf(run("2026-07-28", 4), TODAY)).toBe(4); // includes today
    expect(currentStreakAsOf(run("2026-07-20", 3), TODAY)).toBe(0); // broken
  });
});

describe("streakChase", () => {
  it("only appears mid-chase against a real record", () => {
    // Best 7 (old run), current 3.
    const dates = [...run("2026-06-01", 7), ...run("2026-07-28", 3)];
    const chase = streakChase(dates, TODAY)!;
    expect(chase).toMatchObject({ current: 3, best: 7, remaining: 5 });
    expect(chase.pct).toBe(43);
  });

  it("stays silent with no record, a fresh start, or a record already beaten", () => {
    expect(streakChase(run("2026-07-28", 3), TODAY)).toBeNull(); // best == current
    expect(streakChase([...run("2026-06-01", 7), "2026-07-30"], TODAY)).toBeNull(); // current 1
    expect(streakChase([...run("2026-06-01", 4), ...run("2026-07-28", 2)], TODAY)).toBeNull(); // best < 5
  });
});
