/**
 * Adaptive TDEE: your real maintenance calories, computed from what you
 * actually logged — average intake corrected by how your bodyweight moved.
 * The formula-based estimate guesses from age and height; this measures.
 * Pure arithmetic over local logs, so it costs nothing to run at scale.
 */

const KCAL_PER_KG = 7700;
const WINDOW_DAYS = 21;
/** Fewer logged days than this and the average is noise, not signal. */
const MIN_FOOD_DAYS = 8;
const MIN_WEIGHINS = 4;
const MIN_WEIGHIN_SPAN_DAYS = 10;

export interface AdaptiveTdee {
  /** Estimated true maintenance, rounded to 10 kcal. */
  tdee: number;
  avgIntake: number;
  /** Positive = gaining. */
  trendKgPerWeek: number;
  /** How many days of food logs the estimate is built on. */
  foodDays: number;
}

function dayMs(iso: string) {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

export function adaptiveTdee(
  foodLog: { date: string; calories: number }[],
  weights: { date: string; weight: number }[],
  todayIso: string,
): AdaptiveTdee | null {
  const end = dayMs(todayIso);
  const start = end - WINDOW_DAYS * 86400000;
  const inWindow = (iso: string) => {
    const t = dayMs(iso);
    // Exclude today: a half-logged day drags the average down.
    return t >= start && t < end;
  };

  // Daily intake totals across the window.
  const byDay = new Map<string, number>();
  for (const f of foodLog) {
    if (!inWindow(f.date)) continue;
    byDay.set(f.date, (byDay.get(f.date) ?? 0) + f.calories);
  }
  const foodDays = byDay.size;
  if (foodDays < MIN_FOOD_DAYS) return null;
  const avgIntake = [...byDay.values()].reduce((a, b) => a + b, 0) / foodDays;

  // Weight trend via least squares over the window's weigh-ins. One weigh-in
  // per day: if the scale was logged twice, the later entry wins.
  const wByDay = new Map<string, number>();
  for (const w of weights) if (inWindow(w.date)) wByDay.set(w.date, w.weight);
  const points = [...wByDay.entries()]
    .map(([date, kg]) => ({ t: dayMs(date) / 86400000, kg }))
    .sort((a, b) => a.t - b.t);
  if (points.length < MIN_WEIGHINS) return null;
  if (points[points.length - 1].t - points[0].t < MIN_WEIGHIN_SPAN_DAYS) return null;

  const n = points.length;
  const meanT = points.reduce((a, p) => a + p.t, 0) / n;
  const meanKg = points.reduce((a, p) => a + p.kg, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - meanT) * (p.kg - meanKg);
    den += (p.t - meanT) ** 2;
  }
  if (den === 0) return null;
  const slopePerDay = num / den;

  const tdee = Math.round((avgIntake - slopePerDay * KCAL_PER_KG) / 10) * 10;
  // A result outside human range means the logs are junk (crash-logged food,
  // scale in lb, etc). Returning null beats returning confident nonsense.
  if (tdee < 1200 || tdee > 6000) return null;

  return {
    tdee,
    avgIntake: Math.round(avgIntake),
    trendKgPerWeek: Math.round(slopePerDay * 7 * 100) / 100,
    foodDays,
  };
}
