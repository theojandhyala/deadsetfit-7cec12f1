import type { AppState, SetLog } from "./types";
import { bestSetFor, maxRepsFor, calculateStreak, calculateGritScore } from "./calc";
import { getWeeklyCompetitionStats, type WeeklyCompetitionStats } from "./competition";
import { achievements } from "./achievements";

// === PR Catalog — used for the "Personal Records" editor + FIFA stat math ===
export type PRKind = "1RM" | "REPS" | "TIME";
export interface PRDef {
  id: string;
  label: string;
  kind: PRKind;
  category: "PUSH" | "PULL" | "LEGS" | "OLY" | "BODY" | "CARDIO" | "CORE";
  /** Used as weight category in FIFA strength math (1RM lifts only). */
  weightWeight?: number; // contribution weight (default 1)
  /** Plain-English description of the lift so users know what it is. */
  desc: string;
}

export const PR_CATALOG: PRDef[] = [
  {
    id: "bench-press",
    label: "Bench Press",
    kind: "1RM",
    category: "PUSH",
    weightWeight: 1.2,
    desc: "Flat barbell bench press. Bar to mid-chest, drive straight up.",
  },
  {
    id: "squat",
    label: "Back Squat",
    kind: "1RM",
    category: "LEGS",
    weightWeight: 1.5,
    desc: "Barbell on upper back. Break at hips & knees, depth at parallel.",
  },
  {
    id: "deadlift",
    label: "Deadlift",
    kind: "1RM",
    category: "PULL",
    weightWeight: 1.7,
    desc: "Conventional barbell deadlift from the floor. Lock out hips at top.",
  },
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

/** Effective 1RM for a lift, and whether it was measured or calculated.
 *
 *  The card used to show this number bare while the PR list showed the raw entry
 *  — so a 100kg x 5 appeared as "117" in one place and "100kg x 5" in the other,
 *  same lift, two numbers, no explanation. The value is right (a comparable 1RM
 *  is what the leaderboard needs); it just has to say when it is an estimate. */
type OneRMDetail = { value: number; estimated: boolean };

function effective1RMDetail(state: AppState, def: PRDef): OneRMDetail {
  let best: OneRMDetail = { value: 0, estimated: false };
  const manual = state.manualPRs?.[def.id];
  if (manual?.value) {
    const value = as1RM(manual);
    // A PR entered as a single is measured; more than one rep has been through
    // the Epley formula.
    if (value > best.value) best = { value, estimated: (manual.reps ?? 1) > 1 };
  }
  if (def.kind === "1RM") {
    const log = bestSetFor(state.logs, def.id);
    if (log && log.oneRm > best.value) best = { value: log.oneRm, estimated: log.reps > 1 };
  }
  return best;
}

/** Effective 1RM for a lift: best of manual PR vs. logged best set. */
function effective1RM(state: AppState, def: PRDef): number {
  return effective1RMDetail(state, def).value;
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
    "bench-press": 1.5,
    squat: 2.0,
    deadlift: 2.5,
    ohp: 1.0,
    "incline-bench": 1.3,
    "db-bench": 0.6,
    "weighted-dip": 1.0,
    "weighted-pullup": 0.8,
    "barbell-row": 1.4,
    "pendlay-row": 1.3,
    "front-squat": 1.6,
    rdl: 1.8,
    "hip-thrust": 2.5,
    "leg-press": 3.5,
    "power-clean": 1.4,
    "clean-jerk": 1.6,
    snatch: 1.2,
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
    "pull-ups": 20,
    "push-ups": 60,
    dips: 25,
    "muscle-up": 5,
    "hanging-leg-raise": 20,
  };
  const t = target80[def.id] ?? 20;
  return Math.max(0, Math.min(99, Math.round((reps / t) * 80)));
}

function timeRating(seconds: number, def: PRDef): number {
  if (!seconds) return 0;
  // Higher is better for plank-style timed records.
  if (def.id === "plank") {
    return Math.max(0, Math.min(99, Math.round((seconds / 180) * 80))); // 3min = 80
  }
  return 0;
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
  const nz = arr.filter((n) => n > 0);
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

  const bigThreeRatings = ["bench-press", "squat", "deadlift"].map((id) => ratings[id]);
  const STR = avg(bigThreeRatings);
  // PWR — your peak lift (best single rating) vs STR's average of all three.
  const PWR = Math.max(0, ...bigThreeRatings.filter((n) => Number.isFinite(n)));
  // END — rep endurance from real logged sets: average reps per working set.
  let repTotal = 0;
  let setCount = 0;
  for (const session of state.sessions || []) {
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        // Cap a single set's contribution so one mis-logged 60-"rep" hold
        // can't peg the whole stat.
        repTotal += Math.min(s.reps, 20);
        setCount += 1;
      }
    }
  }
  const END = setCount === 0 ? 0 : Math.max(0, Math.min(99, Math.round((repTotal / setCount) * 5)));

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

  const filled = [STR, PWR, END, HYP, CON, DIE].filter((n) => n > 0);
  const overall = filled.length ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length) : 0;

  return { STR, PWR, END, HYP, CON, DIE, overall };
}

/** The headline lifts shown on the athlete card. */
export const HEADLINE_PRS: Array<{ id: string; short: string; unit: string }> = [
  { id: "bench-press", short: "BENCH", unit: "kg" },
  { id: "squat", short: "SQUAT", unit: "kg" },
  { id: "deadlift", short: "DEAD", unit: "kg" },
];

export interface HeadlinePR {
  id: string;
  label: string;
  value: number;
  unit: string;
  /** True when the number came out of the Epley formula rather than a measured
   *  single, so the UI can mark it as an estimate instead of contradicting the
   *  PR list. */
  estimated?: boolean;
}

export function buildHeadlinePRs(state: AppState): HeadlinePR[] {
  return HEADLINE_PRS.map(({ id, short, unit }) => {
    const def = PR_CATALOG.find((d) => d.id === id)!;
    if (def.kind === "1RM") {
      const detail = effective1RMDetail(state, def);
      return { id, label: short, value: detail.value, unit, estimated: detail.estimated };
    }
    return { id, label: short, value: getPRValue(state, def), unit, estimated: false };
  });
}

/** A compact, shareable payload to write to profiles.public_stats. */
export interface PublicStats {
  overall: number;
  STR: number;
  PWR: number;
  END: number;
  HYP: number;
  CON: number;
  DIE: number;
  /** Current consecutive-day training streak (for the streak leaderboard) */
  streak: number;
  topPRs: HeadlinePR[];
  weekly: WeeklyCompetitionStats;
  /** Big Three total divided by body weight. */
  strengthToWeight: number;
  /** Badge wall summary, so an athlete's card can show what they've earned. */
  badges?: {
    earned: number;
    total: number;
    /** The rarest few, for display on a card. */
    top: { id: string; label: string; icon: string; rarity: string }[];
  };
  goal?: string;
  experience?: string;
  weightKg?: number;
  heightCm?: number;
  /** Blob-only profile preferences mirrored so fresh-device restores keep them */
  prefs?: {
    focusMuscles?: string[];
    sessionMinutes?: number;
    exercisesPerSession?: number;
    targetWeightKg?: number;
  };
}

const RARITY_RANK: Record<string, number> = {
  LEGENDARY: 4,
  EPIC: 3,
  RARE: 2,
  COMMON: 1,
};

export function buildPublicStats(state: AppState): PublicStats {
  const stats = computeFifaStats(state);
  const allBadges = achievements(state);
  const earned = allBadges.filter((b) => b.unlocked);
  // Rarest first — a card has room for a handful, and they should be the ones
  // worth bragging about.
  const topBadges = [...earned]
    .sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0))
    .slice(0, 6)
    .map((b) => ({ id: b.id, label: b.label, icon: b.icon, rarity: b.rarity }));
  const topPRs = buildHeadlinePRs(state);
  const total = topPRs.reduce((sum, lift) => sum + lift.value, 0);
  const bodyWeight = state.profile?.weightKg ?? 0;
  return {
    overall: stats.overall,
    STR: stats.STR,
    PWR: stats.PWR,
    END: stats.END,
    HYP: stats.HYP,
    CON: stats.CON,
    DIE: stats.DIE,
    streak: calculateStreak(state.completedDates),
    topPRs,
    weekly: getWeeklyCompetitionStats(state),
    strengthToWeight: bodyWeight > 0 ? Math.round((total / bodyWeight) * 100) / 100 : 0,
    badges: { earned: earned.length, total: allBadges.length, top: topBadges },
    goal: state.profile?.goal,
    experience: state.profile?.experience,
    weightKg: state.profile?.weightKg,
    heightCm: state.profile?.heightCm,
    // Blob-only preferences mirrored to the account row so a fresh-device
    // restore via the profile row can't erase them.
    prefs: {
      focusMuscles: state.profile?.focusMuscles,
      sessionMinutes: state.profile?.sessionMinutes,
      exercisesPerSession: state.profile?.exercisesPerSession,
      targetWeightKg: state.profile?.targetWeightKg,
    },
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
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  return "—";
}
