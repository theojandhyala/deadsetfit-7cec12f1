import type { Profile, AppState, SetLog } from "./types";

export function calculateCalories(p: Profile): number {
  // Mifflin-St Jeor
  const s = p.gender === "MALE" ? 5 : p.gender === "FEMALE" ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + s;
  const activity = 1.375 + p.daysPerWeek * 0.05; // ~1.525–1.675
  const tdee = bmr * activity;
  switch (p.goal) {
    case "BULK": return Math.round(tdee + 350);
    case "CUT": return Math.round(tdee - 450);
    case "ATHLETIC": return Math.round(tdee + 150);
    default: return Math.round(tdee);
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
  const pickPress = has("FULL_GYM") ? "bench-press" : has("HOME_GYM") ? "incline-db-press" : "push-ups";
  const pickPull = has("FULL_GYM") ? "lat-pulldown" : "pull-ups";
  const pickSquat = has("FULL_GYM") ? "squat" : has("HOME_GYM") ? "rdl" : "lunges";
  const pickHinge = has("FULL_GYM") ? "deadlift" : "rdl";

  const PUSH: Day = { label: "PUSH — CHEST / SHOULDERS / TRICEPS", ids: [pickPress, "incline-db-press", "ohp", "lateral-raise", "tricep-pushdown"].filter(uniq) };
  const PULL: Day = { label: "PULL — BACK / BICEPS", ids: [pickPull, "seated-row", "face-pull", "barbell-curl", "hammer-curl"] };
  const LEGS: Day = { label: "LEGS — QUADS / HAMS / GLUTES", ids: [pickSquat, pickHinge, "leg-press", "lunges", "leg-curl"].filter(uniq) };
  const UPPER: Day = { label: "UPPER — CHEST / BACK / ARMS", ids: [pickPress, pickPull, "ohp", "barbell-curl", "tricep-pushdown"] };
  const LOWER: Day = { label: "LOWER — LEGS / CORE", ids: [pickSquat, pickHinge, "lunges", "plank", "hanging-leg-raise"].filter(uniq) };
  const FULL: Day = { label: "FULL BODY", ids: [pickSquat, pickPress, pickPull, "plank"] };
  const ARMS: Day = { label: "ARMS — BI / TRI", ids: ["barbell-curl", "hammer-curl", "skull-crushers", "tricep-pushdown"] };
  const SHO: Day = { label: "SHOULDERS — DELTS", ids: ["ohp", "lateral-raise", "front-raise", "rear-delt-fly"] };
  const CORE: Day = { label: "CORE", ids: ["plank", "hanging-leg-raise", "cable-crunch", "ab-wheel"] };

  let plan: Day[];
  if (d === 3) plan = [FULL, REST, FULL, REST, FULL, REST, REST];
  else if (d === 4) plan = [UPPER, LOWER, REST, UPPER, LOWER, REST, REST];
  else if (d === 5) plan = [PUSH, PULL, LEGS, UPPER, LOWER, REST, REST];
  else plan = [PUSH, PULL, LEGS, SHO, ARMS, CORE, REST];

  const days: ("MON"|"TUE"|"WED"|"THU"|"FRI"|"SAT"|"SUN")[] = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
  const result: Record<string, { label: string; exerciseIds: string[] }> = {};
  days.forEach((d, i) => { result[d] = { label: plan[i].label, exerciseIds: plan[i].ids }; });
  return result as import("./types").Schedule;
}

function uniq(v: string, i: number, a: string[]) { return a.indexOf(v) === i; }

export function todayKey(): "MON"|"TUE"|"WED"|"THU"|"FRI"|"SAT"|"SUN" {
  const keys = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;
  return keys[new Date().getDay()];
}

export function isoDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function calculateStreak(completedDates: string[]) {
  if (completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  let streak = 0;
  const d = new Date();
  while (set.has(isoDay(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// === GRIT Level tiers (by grit_points) ===
export type GritLevel = "BEGINNER" | "ROOKIE" | "CONTENDER" | "WARRIOR" | "CHAMPION" | "LEGEND";
export function gritLevel(points: number): GritLevel {
  if (points >= 2500) return "LEGEND";
  if (points >= 1000) return "CHAMPION";
  if (points >= 500) return "WARRIOR";
  if (points >= 250) return "CONTENDER";
  if (points >= 100) return "ROOKIE";
  return "BEGINNER";
}
