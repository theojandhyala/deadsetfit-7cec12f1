import type { FoodLogItem } from "./types";
import { MEALS, mealFor, type MealType } from "./nutrition";

// Protein spread — daily totals can look perfect while every gram lands at
// dinner. Muscle protein synthesis responds per feeding, so this scores how
// many meals a day actually carry a meaningful dose.

export interface ProteinSpread {
  daysAnalyzed: number;
  /** Average meals per day at or above the threshold dose. */
  avgQualityMeals: number;
  targetMeals: number;
  thresholdG: number;
  /** Main meal (breakfast/lunch/dinner) that most often misses the dose. */
  weakestMeal: MealType | null;
  advice: string;
}

const TARGET_MEALS = 4;
const MIN_DAYS = 4;
const DAY_MS = 86_400_000;

const MEAL_NAME: Record<MealType, string> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  DINNER: "dinner",
  SNACK: "snacks",
};

/** ~0.4 g/kg per feeding, floored at 25 g and capped at 45 g. */
export function proteinDoseG(weightKg: number): number {
  return Math.min(45, Math.max(25, Math.round(weightKg * 0.4)));
}

export function proteinSpread(
  foodLog: FoodLogItem[],
  weightKg: number,
  todayIso: string,
  windowDays = 7,
): ProteinSpread | null {
  if (!weightKg || weightKg <= 0) return null;
  const threshold = proteinDoseG(weightKg);
  const since = new Date(`${todayIso}T00:00:00Z`).getTime() - windowDays * DAY_MS;

  // Protein per (day, meal-slot). Excludes today — it's still being logged.
  const byDayMeal = new Map<string, Map<MealType, number>>();
  for (const item of foodLog ?? []) {
    if (item.date >= todayIso) continue;
    const at = new Date(`${item.date}T00:00:00Z`).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    let meals = byDayMeal.get(item.date);
    if (!meals) byDayMeal.set(item.date, (meals = new Map()));
    const slot = mealFor(item);
    meals.set(slot, (meals.get(slot) ?? 0) + (item.protein || 0));
  }

  if (byDayMeal.size < MIN_DAYS) return null;

  let qualityTotal = 0;
  const missesBySlot = new Map<MealType, number>();
  for (const meals of byDayMeal.values()) {
    let quality = 0;
    for (const slot of MEALS) {
      const g = meals.get(slot) ?? 0;
      if (g >= threshold) quality += 1;
      else if (slot !== "SNACK") {
        // Snacks are optional; only the three main meals count as "missed".
        missesBySlot.set(slot, (missesBySlot.get(slot) ?? 0) + 1);
      }
    }
    qualityTotal += quality;
  }

  const avgQualityMeals = Math.round((qualityTotal / byDayMeal.size) * 10) / 10;

  let weakestMeal: MealType | null = null;
  let worst = 0;
  for (const [slot, misses] of missesBySlot) {
    if (misses > worst) {
      worst = misses;
      weakestMeal = slot;
    }
  }

  const advice =
    avgQualityMeals >= 3
      ? `Strong spread — ${avgQualityMeals} meals a day carry ${threshold} g+ of protein. That's how you keep muscle synthesis switched on.`
      : weakestMeal
        ? `Only ${avgQualityMeals} meals a day reach ${threshold} g of protein — ${MEAL_NAME[weakestMeal]} misses most often. Front-load a protein source there.`
        : `Only ${avgQualityMeals} meals a day reach ${threshold} g of protein. Spread it across ${TARGET_MEALS} feedings instead of banking it all at once.`;

  return {
    daysAnalyzed: byDayMeal.size,
    avgQualityMeals,
    targetMeals: TARGET_MEALS,
    thresholdG: threshold,
    weakestMeal,
    advice,
  };
}
