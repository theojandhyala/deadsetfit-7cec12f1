import { describe, it, expect } from "vitest";

import { hydrationInsight } from "./hydration-insight";
import type { WaterEntry } from "./types";

const TODAY = "2026-07-31";

function entry(date: string, ml: number): WaterEntry {
  return { date, ml, at: `${date}T12:00:00Z` };
}

describe("hydrationInsight", () => {
  it("returns null with no target or thin data", () => {
    const days = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"];
    expect(hydrationInsight(days.map((d) => entry(d, 3000)), 0, TODAY)).toBeNull();
    expect(hydrationInsight(days.map((d) => entry(d, 3000)), 3000, TODAY)).toBeNull(); // 4 < 5
  });

  it("computes hit rate and sums split entries within a day", () => {
    const water = [
      entry("2026-07-25", 1500),
      entry("2026-07-25", 1600), // together they clear 3000
      entry("2026-07-26", 3200),
      entry("2026-07-27", 2000),
      entry("2026-07-28", 3100),
      entry("2026-07-29", 3000),
      entry("2026-07-31", 9000), // today — excluded
    ];
    const r = hydrationInsight(water, 3000, TODAY)!;
    expect(r.daysTracked).toBe(5);
    expect(r.hitRate).toBe(0.8);
    expect(r.advice).toContain("80%");
  });

  it("finds the weekday that always runs dry", () => {
    // Mondays consistently low across two weeks; other days fine.
    const water = [
      entry("2026-07-20", 1000), // Monday
      entry("2026-07-27", 1100), // Monday
      entry("2026-07-21", 3200),
      entry("2026-07-28", 3300),
      entry("2026-07-22", 3100),
      entry("2026-07-29", 3050),
    ];
    const r = hydrationInsight(water, 3000, TODAY)!;
    expect(r.driestDay).toBe("MON");
    expect(r.advice).toContain("Mondays");
  });
});
