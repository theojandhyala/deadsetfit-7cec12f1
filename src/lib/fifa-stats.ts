import type { AppState, SetLog } from "./types";
import { bestSetFor, maxRepsFor, calculateStreak, calculateGritScore } from "./calc";

// === PR Catalog — used for the "Personal Records" editor + FIFA stat math ===
export type PRKind = "1RM" | "REPS" | "TIME";
export interface PRDef {
  id: string;
  label: string;
  kind: PRKind;
  category: "PUSH" | "PULL" | "LEGS" | "OLY" | "BODY" | "CARDIO" | "CORE";
  /** Used as weight category in FIFA strength math (1RM lifts only). */
  weightWeight?: number; // contribution weight (default 1)
}

export const PR_CATALOG: PRDef[] = [
  // Big 4
  { id: "bench-press",      label: "Bench Press",        kind: "1RM",  category: "PUSH",   weightWeight: 1.2 },
  { id: "squat",            label: "Back Squat",         kind: "1RM",  category: "LEGS",   weightWeight: 1.5 },
  { id: "deadlift",         label: "Deadlift",           kind: "1RM",  category: "PULL",   weightWeight: 1.7 },
  { id: "ohp",              label: "Overhead Press",     kind: "1RM",  category: "PUSH",   weightWeight: 1.0 },
  // Push variations
  { id: "incline-bench",    label: "Incline Bench",      kind: "1RM",  category: "PUSH",   weightWeight: 1.0 },
  { id: "db-bench",         label: "DB Bench (per hand)",kind: "1RM",  category: "PUSH",   weightWeight: 0.8 },
  { id: "weighted-dip",     label: "Weighted Dip",       kind: "1RM",  category: "PUSH",   weightWeight: 0.8 },
  // Pull variations
  { id: "weighted-pullup",  label: "Weighted Pull-Up",   kind: "1RM",  category: "PULL",   weightWeight: 1.1 },
  { id: "barbell-row",      label: "Barbell Row",        kind: "1RM",  category: "PULL",   weightWeight: 1.0 },
  { id: "pendlay-row",      label: "Pendlay Row",        kind: "1RM",  category: "PULL",   weightWeight: 1.0 },
  // Legs
  { id: "front-squat",      label: "Front Squat",        kind: "1RM",  category: "LEGS",   weightWeight: 1.2 },
  { id: "rdl",              label: "Romanian Deadlift",  kind: "1RM",  category: "LEGS",   weightWeight: 1.3 },
  { id: "hip-thrust",       label: "Hip Thrust",         kind: "1RM",  category: "LEGS",   weightWeight: 1.2 },
  { id: "leg-press",        label: "Leg Press",          kind: "1RM",  category: "LEGS",   weightWeight: 0.7 },
  // Olympic
  { id: "power-clean",      label: "Power Clean",        kind: "1RM",  category: "OLY",    weightWeight: 1.3 },
  { id: "clean-jerk",       label: "Clean & Jerk",       kind: "1RM",  category: "OLY",    weightWeight: 1.4 },
  { id: "snatch",           label: "Snatch",             kind: "1RM",  category: "OLY",    weightWeight: 1.4 },
  // Bodyweight reps
  { id: "pull-ups",         label: "Pull-Ups (max reps)",kind: "REPS", category: "BODY" },
  { id: "push-ups",         label: "Push-Ups (max reps)",kind: "REPS", category: "BODY" },
  { id: "dips",             label: "Dips (max reps)",    kind: "REPS", category: "BODY" },
  { id: "muscle-up",        label: "Muscle-Ups",         kind: "REPS", category: "BODY" },
  // Core
  { id: "plank",            label: "Plank Hold (sec)",   kind: "TIME", category: "CORE" },
  { id: "hanging-leg-raise",label: "Hanging Leg Raise",  kind: "REPS", category: "CORE" },
  // Cardio
  { id: "mile-run",         label: "1 Mile Run (sec)",   kind: "TIME", category: "CARDIO" },
  { id: "5k-run",           label: "5K Run (sec)",       kind: "TIME", category: "CARDIO" },
  { id: "row-2k",           label: "2K Row (sec)",       kind: "TIME", category: "CARDIO" },
];

export interface ManualPR {
  /** kg for 1RM, reps for REPS, seconds for TIME */
  value: number;
  /** reps achieved at that weight (for 1RM PRs entered as e.g. "100kg × 5") */
  reps?: number;
  date: string;
}

export type ManualPRMap = Record<string, ManualPR>;

/** Convert (weight × reps) → estimated 1RM (Epley). Falls back to weight if no reps. */
function as1RM(pr: ManualPR): number {
  if (!pr.value) return 0;
  if (pr.reps && pr.reps > 1) return Math.round(pr.value * (1 + pr.reps / 30));
  return pr.value;
}

/** Effective 1RM for a lift: best of manual PR vs. logged best set. */
function effective1RM(state: AppState, def: PRDef): number {
  let best = 0;
  const manual = state.manualPRs?.[def.id];
  if (manual) best = Math.max(best, as1RM(manual));
  if (def.kind === "1RM") {
    const log = bestSetFor(state.logs, def.id);
    if (log) best = Math.max(best, log.oneRm);
  }
  return best;
}

function effectiveReps(state: AppState, def: PRDef): number {
  let best = 0;
  const manual = state.manualPRs?.[def.id];
  if (manual?.value) best = Math.max(best, manual.value);
  best = Math.max(best, maxRepsFor(state.logs, def.id));
  return best;
}

function effectiveTime(state: AppState, def: PRDef): number {
  const manual = state.manualPRs?.[def.id];
  return manual?.value ?? 0;
}

export function getPRValue(state: AppState, def: PRDef): number {
  if (def.kind === "1RM") return effective1RM(state, def);
  if (def.kind === "REPS") return effectiveReps(state, def);
  return effectiveTime(state, def);
}

/** Wilks-ish bodyweight benchmark — caps each lift to a 0–99 rating. */
function strengthRating(oneRm: number, bw: number, def: PRDef): number {
  if (!oneRm || !bw) return 0;
  // bench 1.5× = 80, squat 2× = 80, deadlift 2.5× = 80 — calibrated via weightWeight target
  // target ratio that earns "80":
  const target80: Record<string, number> = {
    "bench-press": 1.5, "squat": 2.0, "deadlift": 2.5, "ohp": 1.0,
    "incline-bench": 1.3, "db-bench": 0.6, "weighted-dip": 1.0,
    "weighted-pullup": 0.8, "barbell-row": 1.4, "pendlay-row": 1.3,
    "front-squat": 1.6, "rdl": 1.8, "hip-thrust": 2.5, "leg-press": 3.5,
    "power-clean": 1.4, "clean-jerk": 1.6, "snatch": 1.2,
  };
  const t = target80[def.id] ?? 1.0;
  const ratio = oneRm / bw;
  // ratio==t → 80, ratio==t*1.5 → 99
  const r = (ratio / t) * 80;
  return Math.max(0, Math.min(99, Math.round(r)));
}

function repsRating(reps: number, def: PRDef): number {
  if (!reps) return 0;
  const target80: Record<string, number> = {
    "pull-ups": 20, "push-ups": 60, "dips": 25, "muscle-up": 5, "hanging-leg-raise": 20,
  };
  const t = target80[def.id] ?? 20;
  return Math.max(0, Math.min(99, Math.round((reps / t) * 80)));
}

function timeRating(seconds: number, def: PRDef): number {
  if (!seconds) return 0;
  // Lower is better for runs/rows; higher is better for plank.
  if (def.id === "plank") {
    return Math.max(0, Math.min(99, Math.round((seconds / 180) * 80))); // 3min = 80
  }
  // run/row: target80 seconds for an "80"
  const target80: Record<string, number> = {
    "mile-run": 7 * 60, "5k-run": 24 * 60, "row-2k": 7 * 60 + 30,
  };
  const t = target80[def.id] ?? 600;
  // 1.5× slower than target → 30 ; target → 80 ; 0.7× target → 99
  const ratio = t / seconds; // >1 = faster
  return Math.max(0, Math.min(99, Math.round(ratio * 80)));
}

export interface FifaStats {
  STR: number; // raw strength (big 3)
  PWR: number; // explosive (oly + jumps)
  END: number; // endurance (cardio + bodyweight reps)
  HYP: number; // size — derived from total training volume + measurements
  CON: number; // consistency — streak + completed days
  DIE: number; // diet discipline — calorie + protein hits
  overall: number;
}

function avg(arr: number[]) {
  const nz = arr.filter(n => n > 0);
  if (!nz.length) return 0;
  return Math.round(nz.reduce((a, b) => a + b, 0) / nz.length);
}

export function computeFifaStats(state: AppState): FifaStats {
  const bw = state.profile?.weightKg ?? 0;
  const ratings: Record<string, number> = {};
  for (const def of PR_CATALOG) {
    if (def.kind === "1RM") {
      ratings[def.id] = strengthRating(effective1RM(state, def), bw, def);
    } else if (def.kind === "REPS") {
      ratings[def.id] = repsRating(effectiveReps(state, def), def);
    } else {
      ratings[def.id] = timeRating(effectiveTime(state, def), def);
    }
  }

  const STR = avg(["bench-press", "squat", "deadlift", "ohp", "incline-bench", "barbell-row"].map(id => ratings[id]));
  const PWR = avg(["power-clean", "clean-jerk", "snatch", "weighted-pullup", "weighted-dip"].map(id => ratings[id]));
  const END = avg(["mile-run", "5k-run", "row-2k", "push-ups", "pull-ups", "dips"].map(id => ratings[id]));

  // HYP — total session volume rating
  const volume = (state.sessions || []).reduce((sum, s) => sum + (s.totalVolume || 0), 0);
  const HYP = Math.max(0, Math.min(99, Math.round((volume / 50000) * 80)));

  // CON — streak/completed days
  const streak = calculateStreak(state.completedDates);
  const totalDays = (state.completedDates || []).length;
  const CON = Math.max(0, Math.min(99, Math.round(streak * 4 + Math.min(totalDays, 60))));

  // DIE — diet discipline (from grit breakdown)
  const grit = calculateGritScore(state);
  const dietHits = grit.caloriesHit + grit.proteinHit;
  const DIE = Math.max(0, Math.min(99, Math.round((dietHits / 14) * 80)));

  const filled = [STR, PWR, END, HYP, CON, DIE].filter(n => n > 0);
  const overall = filled.length ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length) : 0;

  return { STR, PWR, END, HYP, CON, DIE, overall };
}

/** The 6 headline lifts shown on the FIFA card. */
export const HEADLINE_PRS: Array<{ id: string; short: string; unit: string }> = [
  { id: "bench-press", short: "BENCH", unit: "kg" },
  { id: "squat",       short: "SQUAT", unit: "kg" },
  { id: "deadlift",    short: "DEAD",  unit: "kg" },
  { id: "ohp",         short: "OHP",   unit: "kg" },
  { id: "pull-ups",    short: "PULL",  unit: "reps" },
  { id: "push-ups",    short: "PUSH",  unit: "reps" },
];

export interface HeadlinePR { id: string; label: string; value: number; unit: string }

export function buildHeadlinePRs(state: AppState): HeadlinePR[] {
  return HEADLINE_PRS.map(({ id, short, unit }) => {
    const def = PR_CATALOG.find(d => d.id === id)!;
    return { id, label: short, value: getPRValue(state, def), unit };
  });
}

/** A compact, shareable payload to write to profiles.public_stats. */
export interface PublicStats {
  overall: number;
  STR: number; PWR: number; END: number; HYP: number; CON: number; DIE: number;
  topPRs: HeadlinePR[];
  goal?: string;
  experience?: string;
  weightKg?: number;
  heightCm?: number;
}

export function buildPublicStats(state: AppState): PublicStats {
  const stats = computeFifaStats(state);
  return {
    overall: stats.overall,
    STR: stats.STR, PWR: stats.PWR, END: stats.END, HYP: stats.HYP, CON: stats.CON, DIE: stats.DIE,
    topPRs: buildHeadlinePRs(state),
    goal: state.profile?.goal,
    experience: state.profile?.experience,
    weightKg: state.profile?.weightKg,
    heightCm: state.profile?.heightCm,
  };
}

/** Helper used by the PR editor to show the current value as a readable string. */
export function formatPRValue(def: PRDef, pr?: ManualPR, logs?: SetLog[]): string {
  if (def.kind === "1RM") {
    if (pr?.value) return pr.reps ? `${pr.value}kg × ${pr.reps}` : `${pr.value}kg`;
    if (logs) {
      const best = bestSetFor(logs, def.id);
      if (best) return `${best.weight}kg × ${best.reps}`;
    }
    return "—";
  }
  if (def.kind === "REPS") {
    if (pr?.value) return `${pr.value} reps`;
    if (logs) {
      const r = maxRepsFor(logs, def.id);
      if (r) return `${r} reps`;
    }
    return "—";
  }
  if (pr?.value) {
    const s = pr.value;
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60); const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  return "—";
}
