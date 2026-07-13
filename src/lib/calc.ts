import type { Profile, AppState, SetLog } from "./types";

export function calculateCalories(p: Profile): number {
  // Mifflin-St Jeor
  const s = p.gender === "MALE" ? 5 : p.gender === "FEMALE" ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + s;
  const activity = 1.375 + p.daysPerWeek * 0.05; // ~1.525–1.675
  const tdee = bmr * activity;
  switch (p.goal) {
    case "BULK":
      return Math.round(tdee + 350);
    case "CUT":
      return Math.round(tdee - 450);
    case "ATHLETIC":
      return Math.round(tdee + 150);
    default:
      return Math.round(tdee);
  }
}

export function calculateMacros(p: Profile, calories: number) {
  let proteinPerKg = 2.0;
  if (p.goal === "CUT") proteinPerKg = 2.4;
  if (p.goal === "BULK") proteinPerKg = 2.0;
  if (p.goal === "ATHLETIC") proteinPerKg = 2.2;
  const protein = Math.round(p.weightKg * proteinPerKg);
  const fats = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);
  return { protein, carbs: Math.max(carbs, 0), fats };
}

export function defaultSchedule(p: Profile) {
  const d = p.daysPerWeek;
  type Day = { label: string; ids: string[] };
  const REST: Day = { label: "REST", ids: [] };

  const equip = p.equipment;
  const has = (e: string) => equip === e || equip === "FULL_GYM";
  const pickPress = has("FULL_GYM")
    ? "bench-press"
    : has("HOME_GYM")
      ? "incline-db-press"
      : "push-ups";
  const pickPull = has("FULL_GYM") ? "lat-pulldown" : "pull-ups";
  const pickSquat = has("FULL_GYM") ? "squat" : has("HOME_GYM") ? "rdl" : "lunges";
  const pickHinge = has("FULL_GYM") ? "deadlift" : "rdl";

  const PUSH: Day = {
    label: "PUSH — CHEST / SHOULDERS / TRICEPS",
    ids: [pickPress, "incline-db-press", "ohp", "lateral-raise", "tricep-pushdown"].filter(uniq),
  };
  const PULL: Day = {
    label: "PULL — BACK / BICEPS",
    ids: [pickPull, "seated-row", "face-pull", "barbell-curl", "hammer-curl"],
  };
  const LEGS: Day = {
    label: "LEGS — QUADS / HAMS / GLUTES",
    ids: [pickSquat, pickHinge, "leg-press", "lunges", "leg-curl"].filter(uniq),
  };
  const UPPER: Day = {
    label: "UPPER — CHEST / BACK / ARMS",
    ids: [pickPress, pickPull, "ohp", "barbell-curl", "tricep-pushdown"],
  };
  const LOWER: Day = {
    label: "LOWER — LEGS / CORE",
    ids: [pickSquat, pickHinge, "lunges", "plank", "hanging-leg-raise"].filter(uniq),
  };
  const FULL: Day = { label: "FULL BODY", ids: [pickSquat, pickPress, pickPull, "plank"] };
  const ARMS: Day = {
    label: "ARMS — BI / TRI",
    ids: ["barbell-curl", "hammer-curl", "skull-crushers", "tricep-pushdown"],
  };
  const SHO: Day = {
    label: "SHOULDERS — DELTS",
    ids: ["ohp", "lateral-raise", "front-raise", "rear-delt-fly"],
  };
  const CORE: Day = {
    label: "CORE",
    ids: ["plank", "hanging-leg-raise", "cable-crunch", "ab-wheel"],
  };

  let plan: Day[];
  if (d === 3) plan = [FULL, REST, FULL, REST, FULL, REST, REST];
  else if (d === 4) plan = [UPPER, LOWER, REST, UPPER, LOWER, REST, REST];
  else if (d === 5) plan = [PUSH, PULL, LEGS, UPPER, LOWER, REST, REST];
  else plan = [PUSH, PULL, LEGS, SHO, ARMS, CORE, REST];

  const days: ("MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN")[] = [
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
    "SUN",
  ];
  const result: Record<string, { label: string; exerciseIds: string[] }> = {};
  days.forEach((d, i) => {
    result[d] = { label: plan[i].label, exerciseIds: plan[i].ids };
  });
  return result as import("./types").Schedule;
}

function uniq(v: string, i: number, a: string[]) {
  return a.indexOf(v) === i;
}

export function todayKey(): "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN" {
  const keys = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  return keys[new Date().getDay()];
}

export function isoDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function calculateStreak(completedDates: string[]) {
  if (completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  const d = new Date();
  // A streak survives until the current day is over — if today isn't logged
  // yet, count back from yesterday instead of zeroing out every morning.
  if (!set.has(isoDay(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(isoDay(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// === DEADSET Badge tiers (by DEADSET Score 0–1000) ===
export type GritBadge = "RAW" | "ROOKIE" | "GRINDER" | "BEAST" | "ELITE" | "DEADSET GOD";
export function gritBadge(score: number): GritBadge {
  if (score >= 1000) return "DEADSET GOD";
  if (score >= 750) return "ELITE";
  if (score >= 500) return "BEAST";
  if (score >= 250) return "GRINDER";
  if (score >= 100) return "ROOKIE";
  return "RAW";
}
// Legacy alias used by social feed/leaderboard.
export const gritLevel = gritBadge;
export type GritLevel = GritBadge;

export function badgeColor(b: GritBadge): string {
  switch (b) {
    case "DEADSET GOD":
      return "#E10600";
    case "ELITE":
      return "#a78bfa";
    case "BEAST":
      return "#fbbf24";
    case "GRINDER":
      return "#22c55e";
    case "ROOKIE":
      return "#60a5fa";
    default:
      return "#8a8a8a";
  }
}

// Epley 1RM estimate
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export function bestSetFor(logs: SetLog[], exerciseId: string) {
  const filtered = logs.filter((l) => l.exerciseId === exerciseId);
  if (!filtered.length) return null;
  let best = { weight: 0, reps: 0, oneRm: 0, date: "" };
  for (const l of filtered) {
    const orm = estimate1RM(l.weight, l.reps);
    if (orm > best.oneRm) best = { weight: l.weight, reps: l.reps, oneRm: orm, date: l.date };
  }
  return best;
}

export function maxRepsFor(logs: SetLog[], exerciseId: string) {
  const filtered = logs.filter((l) => l.exerciseId === exerciseId);
  if (!filtered.length) return 0;
  return filtered.reduce((m, l) => Math.max(m, l.reps), 0);
}

// === DEADSET Score ===
// 0–1000 composite. Computed from local logs.
//   • Workout streak × 15
//   • PRs this week × 25
//   • Calorie target hit × 10/day (this week)
//   • Protein target hit × 10/day (this week)
//   • Weekly photo check-in × 50
//   • Measurements logged this week × 20
// Decays 100 if no activity in last 48h.
export interface GritScoreBreakdown {
  streak: number;
  prs: number;
  caloriesHit: number;
  proteinHit: number;
  checkIns: number;
  measurements: number;
  decay: number;
  total: number;
}
export function calculateGritScore(state: AppState): GritScoreBreakdown {
  const p = state.profile;
  if (!p)
    return {
      streak: 0,
      prs: 0,
      caloriesHit: 0,
      proteinHit: 0,
      checkIns: 0,
      measurements: 0,
      decay: 0,
      total: 0,
    };

  const streak = calculateStreak(state.completedDates);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoISO = weekAgo.toISOString().slice(0, 10);

  // PRs this week (from session.prCount)
  const prs = (state.sessions || [])
    .filter((s) => s.date >= weekAgoISO)
    .reduce((sum, s) => sum + (s.prCount || 0), 0);

  // Calorie + protein target hits per day this week
  const cal = calculateCalories(p);
  const macros = calculateMacros(p, cal);
  const byDay = new Map<string, { cal: number; pro: number }>();
  for (const f of state.foodLog || []) {
    if (f.date < weekAgoISO) continue;
    const d = byDay.get(f.date) ?? { cal: 0, pro: 0 };
    d.cal += f.calories;
    d.pro += f.protein;
    byDay.set(f.date, d);
  }
  let caloriesHit = 0,
    proteinHit = 0;
  for (const [, totals] of byDay) {
    if (Math.abs(totals.cal - cal) / cal <= 0.1) caloriesHit++;
    if (totals.pro >= macros.protein * 0.9) proteinHit++;
  }

  const checkIns = (state.checkIns || []).filter((c) => c.date >= weekAgoISO).length;
  const measurements = (state.measurements || []).filter((m) => m.date >= weekAgoISO).length;

  // Decay: any activity in last 48h?
  const lastActivity = Math.max(
    ...(state.completedDates || []).map((d) => new Date(d).getTime()),
    ...(state.sessions || []).map((s) => new Date(s.date).getTime()),
    ...(state.foodLog || []).map((f) => new Date(f.date).getTime()),
    0,
  );
  const decay = Date.now() - lastActivity > 48 * 3600_000 ? 100 : 0;

  const raw =
    streak * 15 +
    prs * 25 +
    caloriesHit * 10 +
    proteinHit * 10 +
    checkIns * 50 +
    measurements * 20 -
    decay;

  return {
    streak,
    prs,
    caloriesHit,
    proteinHit,
    checkIns,
    measurements,
    decay,
    total: Math.max(0, Math.min(1000, raw)),
  };
}

// === Plate math ===
export const BAR_KG = 20;
export const PLATE_SIZES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateBreakdown {
  /** Plates per side, heaviest first */
  perSide: number[];
  /** Weight that couldn't be loaded with standard plates */
  remainderKg: number;
  barKg: number;
}

export function plateBreakdown(totalKg: number, barKg = BAR_KG): PlateBreakdown | null {
  if (!Number.isFinite(totalKg) || totalKg < barKg) return null;
  let remaining = (totalKg - barKg) / 2;
  const perSide: number[] = [];
  for (const plate of PLATE_SIZES_KG) {
    while (remaining >= plate - 1e-9) {
      perSide.push(plate);
      remaining -= plate;
    }
  }
  return { perSide, remainderKg: Math.round(remaining * 2 * 100) / 100, barKg };
}

// === Warm-up ramp ===
export interface WarmupSet {
  weight: number;
  reps: number;
  pct: number;
}

/** Suggested warm-up sets leading into a working weight (kg). */
export function warmupRamp(workingKg: number): WarmupSet[] {
  if (!Number.isFinite(workingKg) || workingKg <= BAR_KG) return [];
  const round = (n: number) => Math.max(BAR_KG, Math.round(n / 2.5) * 2.5);
  const steps = [
    { pct: 0.4, reps: 10 },
    { pct: 0.6, reps: 6 },
    { pct: 0.8, reps: 3 },
  ];
  const out: WarmupSet[] = [];
  for (const s of steps) {
    const weight = round(workingKg * s.pct);
    if (weight >= workingKg) continue;
    if (out.some((o) => o.weight === weight)) continue;
    out.push({ weight, reps: s.reps, pct: s.pct });
  }
  return out;
}
