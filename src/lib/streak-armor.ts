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

/** Longest recent gap the armor will bridge (misses Sat+Sun, opens Monday). */
const MAX_BRIDGE_DAYS = 2;

/**
 * Monthly refill + missed-day rescue for Pro users.
 *
 * Shields bridge the gap between today/yesterday and the most recent
 * completed day, up to MAX_BRIDGE_DAYS and only while shields last — so the
 * most common miss (skip Saturday, rest Sunday, open the app Monday) is
 * rescued with two shields instead of silently resetting a 40-day streak
 * while three shields sit unused. Rescued days are appended to
 * completedDates so every streak/grit computation keeps working untouched;
 * usedDates records the audit trail.
 *
 * Returns null when nothing changed.
 */
export function runStreakArmor(
  state: AppState,
  isPro: boolean,
  now = new Date(),
): StreakArmorResult | null {
  if (!isPro) return null;

  const armor = state.streakArmor ?? DEFAULT_ARMOR;
  const month = isoDay(now).slice(0, 7);
  let shields = armor.shields;
  let lastRefillMonth = armor.lastRefillMonth;
  let refilled = false;

  if (lastRefillMonth !== month) {
    shields = SHIELDS_PER_MONTH;
    lastRefillMonth = month;
    refilled = true;
  }

  const dayAt = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return isoDay(d);
  };

  const completed = new Set(state.completedDates);
  let completedDates = state.completedDates;
  let usedDates = armor.usedDates;
  let consumedDate: string | null = null;

  // Find the gap: walk back from yesterday over missing days (bounded), and
  // rescue only if a completed day sits just beyond it — i.e. there is an
  // actual streak to save, and enough shields to bridge the whole gap.
  const gap: string[] = [];
  let offset = 1;
  while (gap.length < MAX_BRIDGE_DAYS && !completed.has(dayAt(offset))) {
    gap.push(dayAt(offset));
    offset += 1;
  }
  const anchored = gap.length > 0 && completed.has(dayAt(offset));
  if (anchored && shields >= gap.length) {
    completedDates = [...state.completedDates, ...gap];
    usedDates = [...usedDates, ...gap];
    shields -= gap.length;
    // Most recent rescued day headlines the toast.
    consumedDate = gap[0];
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
