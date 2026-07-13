import { isoDay } from "./calc";
import type { AppState, StreakArmor } from "./types";

export const SHIELDS_PER_MONTH = 3;

export const DEFAULT_ARMOR: StreakArmor = { shields: 0, lastRefillMonth: "", usedDates: [] };

export interface StreakArmorResult {
  next: AppState;
  /** ISO day that was saved by a shield this run, if any */
  consumedDate: string | null;
  /** true when the monthly refill topped shields up this run */
  refilled: boolean;
}

/**
 * Monthly refill + single-missed-day rescue for Pro users.
 *
 * A shield is consumed only when yesterday is missing but the day before
 * was completed — i.e. an active streak would otherwise break. The saved
 * day is appended to completedDates so every streak/grit/consistency
 * computation keeps working untouched; usedDates records the audit trail.
 *
 * Returns null when nothing changed.
 */
export function runStreakArmor(state: AppState, isPro: boolean): StreakArmorResult | null {
  if (!isPro) return null;

  const armor = state.streakArmor ?? DEFAULT_ARMOR;
  const month = isoDay().slice(0, 7);
  let shields = armor.shields;
  let lastRefillMonth = armor.lastRefillMonth;
  let refilled = false;

  if (lastRefillMonth !== month) {
    shields = SHIELDS_PER_MONTH;
    lastRefillMonth = month;
    refilled = true;
  }

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = isoDay(yesterdayDate);
  const dayBeforeDate = new Date();
  dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
  const dayBefore = isoDay(dayBeforeDate);

  const completed = new Set(state.completedDates);
  let completedDates = state.completedDates;
  let usedDates = armor.usedDates;
  let consumedDate: string | null = null;

  if (!completed.has(yesterday) && completed.has(dayBefore) && shields > 0) {
    completedDates = [...state.completedDates, yesterday];
    usedDates = [...usedDates, yesterday];
    shields -= 1;
    consumedDate = yesterday;
  }

  if (!refilled && !consumedDate) return null;

  return {
    next: {
      ...state,
      completedDates,
      streakArmor: { shields, lastRefillMonth, usedDates },
    },
    consumedDate,
    refilled,
  };
}
