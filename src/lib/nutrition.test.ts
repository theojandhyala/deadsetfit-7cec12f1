import { describe, expect, it } from "vitest";
import { mealFor, recentMeal, suggestedMeal } from "./nutrition";
import type { FoodLogItem } from "./types";

const food = (date: string, meal?: FoodLogItem["meal"], name = "Food"): FoodLogItem => ({
  date,
  meal,
  name,
  calories: 100,
  protein: 10,
  carbs: 12,
  fats: 2,
});

describe("nutrition helpers", () => {
  it("suggests meals without ambiguous gaps", () => {
    expect(suggestedMeal(8)).toBe("BREAKFAST");
    expect(suggestedMeal(13)).toBe("LUNCH");
    expect(suggestedMeal(18)).toBe("DINNER");
    expect(suggestedMeal(23)).toBe("SNACK");
  });

  it("keeps old ungrouped food visible under snacks", () => {
    expect(mealFor(food("2026-07-26"))).toBe("SNACK");
  });

  it("finds the most recent matching meal", () => {
    const log = [
      food("2026-07-23", "BREAKFAST", "Oats"),
      food("2026-07-25", "DINNER", "Pasta"),
      food("2026-07-24", "DINNER", "Rice"),
    ];
    expect(recentMeal(log, "DINNER", "2026-07-26")?.items[0].name).toBe("Pasta");
    expect(recentMeal(log, "LUNCH", "2026-07-26")).toBeNull();
  });
});
