import { describe, it, expect } from "vitest";

import { adaptiveTdee } from "./adaptive-tdee";

const TODAY = "2026-07-31";
const day = (offset: number) =>
  new Date(Date.UTC(2026, 6, 31) - offset * 86400000).toISOString().slice(0, 10);

function logs(kcal: number, days: number) {
  return Array.from({ length: days }, (_, i) => ({ date: day(i + 1), calories: kcal }));
}

describe("adaptiveTdee", () => {
  it("returns intake as TDEE when weight is flat", () => {
    const weights = [14, 10, 6, 2].map((o) => ({ date: day(o), weight: 80 }));
    const r = adaptiveTdee(logs(2500, 14), weights, TODAY);
    expect(r).not.toBeNull();
    expect(r!.tdee).toBe(2500);
    expect(r!.trendKgPerWeek).toBe(0);
  });

  it("raises TDEE above intake when weight is dropping", () => {
    // ~0.5 kg/week loss on 2500 in ≈ true burn near 2500 + 550.
    const weights = [
      { date: day(15), weight: 81 },
      { date: day(11), weight: 80.79 },
      { date: day(8), weight: 80.5 },
      { date: day(1), weight: 80 },
    ];
    const r = adaptiveTdee(logs(2500, 14), weights, TODAY);
    expect(r).not.toBeNull();
    expect(r!.tdee).toBeGreaterThan(2900);
    expect(r!.tdee).toBeLessThan(3200);
    expect(r!.trendKgPerWeek).toBeLessThan(0);
  });

  it("refuses to estimate from thin data", () => {
    const weights = [14, 10, 6, 2].map((o) => ({ date: day(o), weight: 80 }));
    expect(adaptiveTdee(logs(2500, 5), weights, TODAY)).toBeNull();
    expect(adaptiveTdee(logs(2500, 14), weights.slice(0, 2), TODAY)).toBeNull();
  });

  it("refuses when the answer is outside human range", () => {
    // Scale logged in lb by mistake → absurd slope → null, not confident nonsense.
    const weights = [
      { date: day(14), weight: 176 },
      { date: day(10), weight: 120 },
      { date: day(6), weight: 90 },
      { date: day(2), weight: 80 },
    ];
    expect(adaptiveTdee(logs(2500, 14), weights, TODAY)).toBeNull();
  });

  it("ignores today's half-logged food", () => {
    const weights = [14, 10, 6, 2].map((o) => ({ date: day(o), weight: 80 }));
    const withToday = [...logs(2500, 14), { date: TODAY, calories: 300 }];
    expect(adaptiveTdee(withToday, weights, TODAY)!.tdee).toBe(2500);
  });
});
