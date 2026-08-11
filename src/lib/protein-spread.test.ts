import { describe, it, expect } from "vitest";

import { proteinDoseG, proteinSpread } from "./protein-spread";
import type { FoodLogItem } from "./types";

const TODAY = "2026-07-31";
const DAYS = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"];

function meal(date: string, mealSlot: FoodLogItem["meal"], protein: number): FoodLogItem {
  return { date, name: "food", calories: 400, protein, carbs: 30, fats: 10, meal: mealSlot };
}

describe("proteinDoseG", () => {
  it("scales with bodyweight inside the floor/cap", () => {
    expect(proteinDoseG(50)).toBe(25);
    expect(proteinDoseG(80)).toBe(32);
    expect(proteinDoseG(150)).toBe(45);
  });
});

describe("proteinSpread", () => {
  it("returns null with thin data or no bodyweight", () => {
    expect(proteinSpread([], 80, TODAY)).toBeNull();
    expect(proteinSpread([meal(DAYS[0], "LUNCH", 40)], 80, TODAY)).toBeNull();
    expect(proteinSpread([meal(DAYS[0], "LUNCH", 40)], 0, TODAY)).toBeNull();
  });

  it("counts meals hitting the dose and finds the weakest slot", () => {
    // 80 kg → 32 g dose. Breakfast never hits; lunch and dinner always do.
    const log = DAYS.flatMap((d) => [
      meal(d, "BREAKFAST", 10),
      meal(d, "LUNCH", 40),
      meal(d, "DINNER", 45),
    ]);
    const r = proteinSpread(log, 80, TODAY)!;
    expect(r.daysAnalyzed).toBe(4);
    expect(r.avgQualityMeals).toBe(2);
    expect(r.weakestMeal).toBe("BREAKFAST");
    expect(r.advice).toContain("breakfast");
  });

  it("sums multiple items within one meal slot", () => {
    const log = DAYS.flatMap((d) => [
      meal(d, "BREAKFAST", 20),
      meal(d, "BREAKFAST", 20), // together they clear 32 g
      meal(d, "LUNCH", 40),
      meal(d, "DINNER", 40),
    ]);
    const r = proteinSpread(log, 80, TODAY)!;
    expect(r.avgQualityMeals).toBe(3);
    expect(r.advice).toContain("Strong spread");
  });

  it("excludes today's half-logged meals", () => {
    const log = [
      ...DAYS.flatMap((d) => [meal(d, "LUNCH", 40), meal(d, "DINNER", 40)]),
      meal(TODAY, "BREAKFAST", 5),
    ];
    const r = proteinSpread(log, 80, TODAY)!;
    expect(r.daysAnalyzed).toBe(4);
  });
});
