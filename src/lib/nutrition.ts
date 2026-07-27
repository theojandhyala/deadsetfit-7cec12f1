import type { FoodLogItem } from "./types";

export const MEALS = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
export type MealType = (typeof MEALS)[number];

export function suggestedMeal(hour = new Date().getHours()): MealType {
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 21) return "DINNER";
  return "SNACK";
}

export function mealFor(item: FoodLogItem): MealType {
  return item.meal && MEALS.includes(item.meal) ? item.meal : "SNACK";
}

export function recentMeal(
  foodLog: FoodLogItem[],
  meal: MealType,
  beforeDate: string,
): { date: string; items: FoodLogItem[] } | null {
  const dates = [
    ...new Set(
      foodLog
        .filter((item) => item.date < beforeDate && mealFor(item) === meal)
        .map((item) => item.date),
    ),
  ]
    .sort()
    .reverse();
  const date = dates[0];
  if (!date) return null;
  return { date, items: foodLog.filter((item) => item.date === date && mealFor(item) === meal) };
}
