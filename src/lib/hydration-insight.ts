import type { DayKey, WaterEntry } from "./types";

// Hydration insight — the water log finally gets a brain: hit rate against
// the target, the weekday that always runs dry, and one concrete nudge.

export interface HydrationInsight {
  daysTracked: number;
  /** Share of tracked days that met the target, 0–1. */
  hitRate: number;
  avgMl: number;
  driestDay: DayKey | null;
  advice: string;
}

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAME: Record<DayKey, string> = {
  MON: "Mondays",
  TUE: "Tuesdays",
  WED: "Wednesdays",
  THU: "Thursdays",
  FRI: "Fridays",
  SAT: "Saturdays",
  SUN: "Sundays",
};
const DAY_MS = 86_400_000;
const MIN_DAYS = 5;

export function hydrationInsight(
  water: WaterEntry[],
  targetMl: number,
  todayIso: string,
  windowDays = 14,
): HydrationInsight | null {
  if (!targetMl || targetMl <= 0) return null;
  const since = new Date(`${todayIso}T00:00:00Z`).getTime() - windowDays * DAY_MS;

  // Total ml per day, excluding today (still being logged).
  const byDay = new Map<string, number>();
  for (const w of water ?? []) {
    if (w.date >= todayIso) continue;
    const at = new Date(`${w.date}T00:00:00Z`).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    byDay.set(w.date, (byDay.get(w.date) ?? 0) + (w.ml || 0));
  }
  if (byDay.size < MIN_DAYS) return null;

  let total = 0;
  let hits = 0;
  const weekdayTotals = new Map<DayKey, { ml: number; days: number }>();
  for (const [date, ml] of byDay) {
    total += ml;
    if (ml >= targetMl) hits += 1;
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const key = DAY_KEYS[(dow + 6) % 7];
    const cur = weekdayTotals.get(key) ?? { ml: 0, days: 0 };
    weekdayTotals.set(key, { ml: cur.ml + ml, days: cur.days + 1 });
  }

  const avgMl = Math.round(total / byDay.size);
  const hitRate = hits / byDay.size;

  // Driest weekday: needs 2+ samples and must sit clearly under the average.
  let driestDay: DayKey | null = null;
  let driestAvg = Infinity;
  for (const [day, t] of weekdayTotals) {
    if (t.days < 2) continue;
    const avg = t.ml / t.days;
    if (avg < driestAvg) {
      driestAvg = avg;
      driestDay = day;
    }
  }
  if (driestDay && driestAvg >= avgMl * 0.75) driestDay = null;

  const pct = Math.round(hitRate * 100);
  const advice =
    hitRate >= 0.8
      ? `Target hit on ${pct}% of tracked days — hydration is handled.`
      : driestDay
        ? `Target hit on ${pct}% of days, and ${DAY_NAME[driestDay]} run driest. Fill a bottle the night before.`
        : `Target hit on ${pct}% of days — averaging ${avgMl.toLocaleString()} ml against ${targetMl.toLocaleString()}. Front-load the first litre before noon.`;

  return { daysTracked: byDay.size, hitRate, avgMl, driestDay, advice };
}
