import { longestStreak } from "./lifetime-stats";

// Record chase — the current streak framed against the athlete's own best.
// Only appears mid-chase: a real record to beat, a real run underway.

export interface StreakChase {
  current: number;
  best: number;
  /** Days of training needed to BEAT (not just match) the record. */
  remaining: number;
  pct: number;
}

const MIN_BEST = 5;
const MIN_CURRENT = 2;
const DAY_MS = 86_400_000;

/** Streak ending today or yesterday (today may simply not be trained yet). */
export function currentStreakAsOf(completedDates: string[], todayIso: string): number {
  const trained = new Set(completedDates ?? []);
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(today)) return 0;
  let cursor = today;
  if (!trained.has(todayIso)) cursor -= DAY_MS; // today is still open, not a miss
  let streak = 0;
  while (trained.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

export function streakChase(completedDates: string[], todayIso: string): StreakChase | null {
  const best = longestStreak(completedDates ?? []);
  const current = currentStreakAsOf(completedDates, todayIso);
  if (best < MIN_BEST || current < MIN_CURRENT || current >= best) return null;
  return {
    current,
    best,
    remaining: best - current + 1,
    pct: Math.min(99, Math.round((current / best) * 100)),
  };
}
