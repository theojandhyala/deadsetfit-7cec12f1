import { estimate1RM } from "./calc";
import type { AppState, Exercise, MuscleGroup } from "./types";

/**
 * Strength grading.
 *
 * Every movement is scored against what people of the same bodyweight and sex
 * typically lift, then rolled up into a grade per muscle group. This is the
 * question a lifter actually wants answered — "am I strong?" — and a raw PR
 * list never answers it, because 100 kg means something completely different
 * at 60 kg bodyweight than at 110.
 *
 * The standards below are approximations of widely published strength tables.
 * They are deliberately rule-based and shipped in the binary: no model call, no
 * server, no per-user cost.
 */

export type StrengthTier =
  | "BEGINNER"
  | "NOVICE"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "ELITE"
  | "WORLD_CLASS";

export const TIERS: StrengthTier[] = [
  "BEGINNER",
  "NOVICE",
  "INTERMEDIATE",
  "ADVANCED",
  "ELITE",
  "WORLD_CLASS",
];

export const TIER_COLOR: Record<StrengthTier, string> = {
  BEGINNER: "#ef4444",
  NOVICE: "#f59e0b",
  INTERMEDIATE: "#45bd62",
  ADVANCED: "#3297e3",
  ELITE: "#a43ac2",
  WORLD_CLASS: "#ec3f83",
};

/** One line for each tier, so the grade means something without a legend. */
export const TIER_BLURB: Record<StrengthTier, string> = {
  BEGINNER: "Just started. Everything is about to go up fast.",
  NOVICE: "Stronger than someone who has never trained.",
  INTERMEDIATE: "Stronger than most people in a commercial gym.",
  ADVANCED: "Years of serious training. Top of most gyms.",
  ELITE: "Competitive strength. Very few people get here.",
  WORLD_CLASS: "Exceptional even among serious strength athletes.",
};

/**
 * How a movement is measured against the standards.
 * - RATIO: estimated 1RM as a multiple of bodyweight.
 * - REPS: best reps in a single set (bodyweight movements).
 * - SECONDS: longest hold.
 */
export type StrengthStandardKind = "RATIO" | "REPS" | "SECONDS";

interface ExerciseStandard {
  muscle: MuscleGroup;
  kind: StrengthStandardKind;
  /** Entry thresholds for NOVICE, INTERMEDIATE, ADVANCED, ELITE. */
  male: [number, number, number, number];
  female: [number, number, number, number];
}

const S = (
  muscle: MuscleGroup,
  kind: StrengthStandardKind,
  male: [number, number, number, number],
  female: [number, number, number, number],
): ExerciseStandard => ({ muscle, kind, male, female });

/** Conservative accessory-lift ratios for recognised loaded movements without a named standard. */
const GENERIC_STANDARD: Partial<Record<MuscleGroup, ExerciseStandard>> = {
  CHEST: S("CHEST", "RATIO", [0.3, 0.55, 0.8, 1.05], [0.2, 0.35, 0.55, 0.75]),
  BACK: S("BACK", "RATIO", [0.4, 0.7, 1.0, 1.3], [0.25, 0.5, 0.75, 1.0]),
  LEGS: S("LEGS", "RATIO", [0.6, 1.0, 1.5, 2.0], [0.45, 0.75, 1.15, 1.6]),
  SHOULDERS: S("SHOULDERS", "RATIO", [0.2, 0.35, 0.55, 0.75], [0.12, 0.25, 0.4, 0.6]),
  ARMS: S("ARMS", "RATIO", [0.15, 0.3, 0.45, 0.65], [0.1, 0.2, 0.32, 0.48]),
  CORE: S("CORE", "RATIO", [0.2, 0.4, 0.65, 0.9], [0.15, 0.3, 0.5, 0.7]),
};

export const STANDARDS: Record<string, ExerciseStandard> = {
  // CHEST
  "bench-press": S("CHEST", "RATIO", [0.75, 1.25, 1.75, 2.0], [0.5, 0.75, 1.0, 1.25]),
  "incline-db-press": S("CHEST", "RATIO", [0.5, 0.8, 1.1, 1.4], [0.3, 0.5, 0.7, 0.9]),
  "cable-fly": S("CHEST", "RATIO", [0.3, 0.5, 0.7, 0.9], [0.2, 0.3, 0.45, 0.6]),
  dips: S("CHEST", "REPS", [1, 8, 18, 30], [1, 4, 10, 20]),
  "push-ups": S("CHEST", "REPS", [10, 25, 45, 70], [5, 15, 30, 50]),

  // BACK
  deadlift: S("BACK", "RATIO", [1.25, 1.75, 2.25, 2.75], [1.0, 1.25, 1.75, 2.25]),
  "pull-ups": S("BACK", "REPS", [1, 6, 14, 24], [1, 3, 8, 15]),
  "lat-pulldown": S("BACK", "RATIO", [0.75, 1.0, 1.3, 1.6], [0.5, 0.7, 0.9, 1.15]),
  "seated-row": S("BACK", "RATIO", [0.7, 1.0, 1.3, 1.6], [0.45, 0.65, 0.85, 1.1]),
  "face-pull": S("BACK", "RATIO", [0.3, 0.45, 0.6, 0.8], [0.2, 0.3, 0.4, 0.55]),
  "inverted-row": S("BACK", "REPS", [8, 18, 32, 50], [5, 12, 22, 38]),
  superman: S("BACK", "REPS", [15, 30, 50, 75], [15, 30, 50, 75]),

  // LEGS
  squat: S("LEGS", "RATIO", [1.0, 1.5, 2.0, 2.5], [0.75, 1.0, 1.5, 2.0]),
  rdl: S("LEGS", "RATIO", [0.9, 1.35, 1.8, 2.2], [0.7, 0.95, 1.3, 1.7]),
  "leg-press": S("LEGS", "RATIO", [1.75, 2.5, 3.5, 4.5], [1.25, 2.0, 2.75, 3.5]),
  "leg-curl": S("LEGS", "RATIO", [0.4, 0.6, 0.8, 1.0], [0.3, 0.45, 0.6, 0.8]),
  "goblet-squat": S("LEGS", "RATIO", [0.4, 0.6, 0.8, 1.0], [0.3, 0.45, 0.6, 0.8]),
  lunges: S("LEGS", "REPS", [12, 25, 45, 70], [12, 25, 45, 70]),
  "bodyweight-squat": S("LEGS", "REPS", [20, 40, 70, 100], [20, 40, 70, 100]),
  "split-squat": S("LEGS", "REPS", [8, 18, 32, 50], [8, 18, 32, 50]),
  "glute-bridge": S("LEGS", "REPS", [15, 30, 50, 75], [15, 30, 50, 75]),
  "calf-raise": S("LEGS", "REPS", [15, 30, 50, 75], [15, 30, 50, 75]),

  // SHOULDERS
  ohp: S("SHOULDERS", "RATIO", [0.5, 0.75, 1.0, 1.25], [0.35, 0.5, 0.65, 0.85]),
  "lateral-raise": S("SHOULDERS", "RATIO", [0.1, 0.18, 0.26, 0.35], [0.07, 0.12, 0.18, 0.25]),
  "front-raise": S("SHOULDERS", "RATIO", [0.1, 0.18, 0.26, 0.35], [0.07, 0.12, 0.18, 0.25]),
  "rear-delt-fly": S("SHOULDERS", "RATIO", [0.1, 0.18, 0.26, 0.35], [0.07, 0.12, 0.18, 0.25]),
  "pike-push-up": S("SHOULDERS", "REPS", [5, 12, 22, 35], [3, 8, 15, 25]),

  // ARMS
  "barbell-curl": S("ARMS", "RATIO", [0.35, 0.55, 0.75, 0.95], [0.2, 0.35, 0.5, 0.65]),
  "hammer-curl": S("ARMS", "RATIO", [0.15, 0.25, 0.35, 0.45], [0.1, 0.16, 0.24, 0.32]),
  "skull-crushers": S("ARMS", "RATIO", [0.3, 0.45, 0.65, 0.85], [0.2, 0.3, 0.42, 0.55]),
  "tricep-pushdown": S("ARMS", "RATIO", [0.35, 0.55, 0.75, 1.0], [0.25, 0.4, 0.55, 0.7]),
  "close-grip-push-up": S("ARMS", "REPS", [8, 20, 38, 60], [4, 12, 25, 42]),

  // CORE
  plank: S("CORE", "SECONDS", [30, 60, 120, 180], [30, 60, 120, 180]),
  "hanging-leg-raise": S("CORE", "REPS", [5, 12, 20, 30], [3, 8, 15, 25]),
  "cable-crunch": S("CORE", "RATIO", [0.3, 0.5, 0.7, 0.95], [0.2, 0.35, 0.5, 0.65]),
  "ab-wheel": S("CORE", "REPS", [3, 8, 15, 25], [2, 5, 12, 20]),
  "dead-bug": S("CORE", "REPS", [10, 20, 35, 50], [10, 20, 35, 50]),
  "bicycle-crunch": S("CORE", "REPS", [15, 30, 50, 80], [15, 30, 50, 80]),
};

export const GRADED_MUSCLES = [
  "CHEST",
  "BACK",
  "LEGS",
  "SHOULDERS",
  "ARMS",
  "CORE",
] as const satisfies readonly MuscleGroup[];

/** How a planned movement can contribute to the Strength Map. */
export function strengthStandardKind(
  exerciseId: string,
  fallbackMuscle?: MuscleGroup,
): StrengthStandardKind | null {
  return (
    (STANDARDS[exerciseId] ?? (fallbackMuscle ? GENERIC_STANDARD[fallbackMuscle] : undefined))
      ?.kind ?? null
  );
}

export interface ExerciseGrade {
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  kind: StrengthStandardKind;
  tier: StrengthTier;
  /** 0-100 across the whole ladder, so a bar can be drawn from one number. */
  score: number;
  /** Progress from this tier's floor to the next tier's, 0-1. */
  progress: number;
  /** What was measured: a 1RM in kg, a rep count, or seconds. */
  value: number;
  /** What reaching the next tier takes, in the same unit. Null at WORLD CLASS. */
  nextAt: number | null;
  nextTier: StrengthTier | null;
}

export interface MuscleGrade {
  muscle: MuscleGroup;
  tier: StrengthTier;
  score: number;
  /** Movements with enough history to grade. */
  exercises: ExerciseGrade[];
  /** The one to push to move this muscle's grade fastest. */
  weakest: ExerciseGrade | null;
}

export interface StrengthReport {
  muscles: MuscleGrade[];
  /** Overall tier across every graded muscle. */
  tier: StrengthTier;
  score: number;
  /** Muscles with no gradable history yet. */
  ungraded: MuscleGroup[];
  /** How many movements contributed. */
  gradedCount: number;
}

/** Where a value sits on the standards ladder, as tier index + progress. */
function placeOnLadder(
  value: number,
  thresholds: readonly number[],
): { index: number; progress: number } {
  if (value <= 0) return { index: 0, progress: 0 };
  let index = 0;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (value >= thresholds[i]!) index = i + 1;
  }
  if (index >= thresholds.length) return { index: thresholds.length, progress: 1 };
  const floor = index === 0 ? 0 : thresholds[index - 1]!;
  const ceiling = thresholds[index]!;
  const span = Math.max(ceiling - floor, 1e-9);
  return { index, progress: Math.max(0, Math.min(1, (value - floor) / span)) };
}

/**
 * The standards table has four widely recognisable published checkpoints.
 * DEADSET adds a real sixth rung above elite without pretending that elite and
 * world-class are the same thing: one more full advanced-to-elite interval,
 * with a 20% minimum increase so closely packed tables still demand a leap.
 */
function thresholdsWithWorldClass(standard: ExerciseStandard, gender: string | null | undefined) {
  if (gender !== "MALE" && gender !== "FEMALE") return null;
  const published = gender === "FEMALE" ? standard.female : standard.male;
  const elite = published[3];
  const advanced = published[2];
  const worldClass = elite + Math.max(elite - advanced, elite * 0.2);
  return [...published, worldClass] as const;
}

/** Personal bests per exercise, from sessions and legacy logs together. */
export interface Bests {
  e1rmKg: number;
  reps: number;
  seconds: number;
}

export function personalBests(state: AppState): Map<string, Bests> {
  const bests = new Map<string, Bests>();
  const touch = (id: string): Bests => {
    let entry = bests.get(id);
    if (!entry) bests.set(id, (entry = { e1rmKg: 0, reps: 0, seconds: 0 }));
    return entry;
  };

  for (const session of state.sessions ?? []) {
    if (!session.endedAt) continue;
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        // Warm-ups and drop sets are not genuine attempts at the load, so they
        // must not set a grade any more than they set a PR.
        if (set.kind === "warmup" || set.kind === "drop") continue;
        const entry = touch(exercise.exerciseId);
        if (set.mode === "duration") {
          entry.seconds = Math.max(entry.seconds, set.seconds ?? 0);
          continue;
        }
        if (set.mode === "distance") continue;
        if (set.weight > 0 && set.reps > 0) {
          entry.e1rmKg = Math.max(entry.e1rmKg, estimate1RM(set.weight, set.reps));
        } else if (set.reps > 0) {
          entry.reps = Math.max(entry.reps, set.reps);
        }
      }
    }
  }

  for (const log of state.logs ?? []) {
    const entry = touch(log.exerciseId);
    if (log.weight > 0 && log.reps > 0) {
      entry.e1rmKg = Math.max(entry.e1rmKg, estimate1RM(log.weight, log.reps));
    } else if (log.reps > 0) {
      entry.reps = Math.max(entry.reps, log.reps);
    }
  }

  // Setup and weekly check-ins are dated, athlete-confirmed references. They
  // must feed the same map as logged sets or the app can accept an answer and
  // still stay grey. The raw load + reps are retained so the same e1RM formula
  // is used everywhere rather than storing a precomputed score.
  for (const [exerciseId, record] of Object.entries(state.manualPRs ?? {})) {
    if (!record || !Number.isFinite(record.value) || record.value <= 0) continue;
    const entry = touch(exerciseId);
    const kind = strengthStandardKind(exerciseId);
    if (kind === "SECONDS") {
      entry.seconds = Math.max(entry.seconds, record.value);
    } else if (kind === "REPS") {
      entry.reps = Math.max(entry.reps, record.value);
    } else {
      entry.e1rmKg = Math.max(entry.e1rmKg, estimate1RM(record.value, record.reps ?? 1));
    }
  }

  return bests;
}

/** Grade one movement, or null when there is nothing to grade it on. */
export function gradeExercise(
  exerciseId: string,
  name: string,
  best: Bests,
  bodyweightKg: number,
  gender: string | null | undefined,
  fallbackMuscle?: MuscleGroup,
): ExerciseGrade | null {
  const standard =
    STANDARDS[exerciseId] ?? (fallbackMuscle ? GENERIC_STANDARD[fallbackMuscle] : undefined);
  if (!standard) return null;
  const thresholds = thresholdsWithWorldClass(standard, gender);
  if (!thresholds) return null;

  let value: number;
  if (standard.kind === "RATIO") {
    // Without a bodyweight there is no ratio, and inventing one would grade
    // everybody wrong rather than admitting the data is missing.
    if (!bodyweightKg || bodyweightKg <= 0 || best.e1rmKg <= 0) return null;
    value = best.e1rmKg / bodyweightKg;
  } else if (standard.kind === "REPS") {
    if (best.reps <= 0) return null;
    value = best.reps;
  } else {
    if (best.seconds <= 0) return null;
    value = best.seconds;
  }

  const { index, progress } = placeOnLadder(value, thresholds);
  const tier = TIERS[index] ?? "WORLD_CLASS";
  const nextTier = index < thresholds.length ? (TIERS[index + 1] ?? null) : null;
  const nextThreshold = index < thresholds.length ? thresholds[index]! : null;

  return {
    exerciseId,
    name,
    muscle: standard.muscle,
    kind: standard.kind,
    tier,
    score: Math.round(((index + progress) / TIERS.length) * 100),
    progress,
    // A ratio is only meaningful back in kilograms.
    value: standard.kind === "RATIO" ? Math.round(best.e1rmKg * 10) / 10 : value,
    nextAt:
      nextThreshold === null
        ? null
        : standard.kind === "RATIO"
          ? Math.ceil((nextThreshold * bodyweightKg) / 2.5) * 2.5
          : Math.ceil(nextThreshold),
    nextTier,
  };
}

/**
 * Grade every muscle group from an athlete's history.
 *
 * A muscle's score is the mean of its graded movements rather than its best:
 * being elite at one lift and untrained at the rest is not a strong chest, and
 * a grade that says otherwise is flattery rather than information.
 */
export function strengthReport(
  state: AppState,
  library: Array<Pick<Exercise, "id" | "name"> & Partial<Pick<Exercise, "muscleGroup">>>,
): StrengthReport {
  const bodyweightKg = state.profile?.weightKg ?? 0;
  const gender = state.profile?.gender;

  // All six areas remain discoverable as grey, but no lift is graded until
  // both calibration inputs exist. This avoids silently treating an
  // unspecified reference as male or grading only bodyweight movements.
  if (bodyweightKg <= 0 || (gender !== "MALE" && gender !== "FEMALE")) {
    return {
      muscles: [],
      tier: TIERS[0],
      score: 0,
      ungraded: [...GRADED_MUSCLES],
      gradedCount: 0,
    };
  }

  const bests = personalBests(state);
  const names = new Map(library.map((exercise) => [exercise.id, exercise.name]));
  const muscles = new Map(library.map((exercise) => [exercise.id, exercise.muscleGroup]));

  const byMuscle = new Map<MuscleGroup, ExerciseGrade[]>();
  for (const [exerciseId, best] of bests) {
    const grade = gradeExercise(
      exerciseId,
      names.get(exerciseId) ?? exerciseId,
      best,
      bodyweightKg,
      gender,
      muscles.get(exerciseId),
    );
    if (!grade) continue;
    const bucket = byMuscle.get(grade.muscle) ?? [];
    bucket.push(grade);
    byMuscle.set(grade.muscle, bucket);
  }

  const muscleGrades: MuscleGrade[] = [];
  const ungraded: MuscleGroup[] = [];
  for (const muscle of GRADED_MUSCLES) {
    const grades = (byMuscle.get(muscle) ?? []).sort((a, b) => b.score - a.score);
    if (grades.length === 0) {
      ungraded.push(muscle);
      continue;
    }
    const score = Math.round(grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length);
    muscleGrades.push({
      muscle,
      score,
      tier: tierForScore(score),
      exercises: grades,
      weakest: grades[grades.length - 1] ?? null,
    });
  }

  const score =
    muscleGrades.length === 0
      ? 0
      : Math.round(
          muscleGrades.reduce((sum, muscle) => sum + muscle.score, 0) / muscleGrades.length,
        );

  return {
    muscles: muscleGrades,
    tier: tierForScore(score),
    score,
    ungraded,
    gradedCount: muscleGrades.reduce((sum, muscle) => sum + muscle.exercises.length, 0),
  };
}

/** Strength report using only history available on or before a calendar day. */
export function strengthReportAsOf(
  state: AppState,
  library: Array<Pick<Exercise, "id" | "name"> & Partial<Pick<Exercise, "muscleGroup">>>,
  cutoffIso: string,
): StrengthReport {
  return strengthReport(
    {
      ...state,
      sessions: state.sessions.filter((session) => session.date.slice(0, 10) <= cutoffIso),
      logs: (state.logs ?? []).filter((log) => log.date.slice(0, 10) <= cutoffIso),
      manualPRs: Object.fromEntries(
        Object.entries(state.manualPRs ?? {}).filter(
          ([, record]) => record.date.slice(0, 10) <= cutoffIso,
        ),
      ),
    },
    library,
  );
}

/** A 0-100 score back to the tier it sits in. */
export function tierForScore(score: number): StrengthTier {
  const clamped = Math.max(0, Math.min(100, score));
  for (let index = TIERS.length - 1; index >= 0; index -= 1) {
    const floor = Math.round((index / TIERS.length) * 100);
    if (clamped >= floor) return TIERS[index]!;
  }
  return TIERS[0]!;
}

/** Points still needed to reach the next tier. Null at the top. */
export function pointsToNextTier(score: number): { tier: StrengthTier; points: number } | null {
  const index = TIERS.indexOf(tierForScore(score));
  if (index >= TIERS.length - 1) return null;
  const nextFloor = Math.round(((index + 1) / TIERS.length) * 100);
  return { tier: TIERS[index + 1]!, points: Math.max(1, nextFloor - Math.round(score)) };
}

export interface StrengthDelta {
  muscle: MuscleGroup;
  now: number;
  then: number;
  /** Positive means stronger than the comparison date. */
  change: number;
}

export interface StrengthTrend {
  overall: number;
  overallChange: number;
  /** Muscles that moved, biggest gain first. Unmoved muscles are omitted. */
  movers: StrengthDelta[];
  /** The comparison date, so the UI can say what "since" means. */
  since: string;
}

/**
 * How much stronger this athlete got over a window.
 *
 * This is the number that makes a grade worth checking again. A static "you
 * are Intermediate" is read once; "chest went 42 to 47 this week" is a reason
 * to come back.
 */
export function strengthTrend(
  state: AppState,
  library: Pick<Exercise, "id" | "name">[],
  days = 7,
  now = new Date(),
): StrengthTrend {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const current = strengthReport(state, library);
  const previous = strengthReportAsOf(state, library, since);

  const before = new Map(previous.muscles.map((muscle) => [muscle.muscle, muscle.score]));
  const movers: StrengthDelta[] = [];
  for (const muscle of current.muscles) {
    const then = before.get(muscle.muscle) ?? 0;
    if (muscle.score === then) continue;
    movers.push({ muscle: muscle.muscle, now: muscle.score, then, change: muscle.score - then });
  }
  movers.sort((a, b) => b.change - a.change);

  return {
    overall: current.score,
    overallChange: current.score - previous.score,
    movers,
    since,
  };
}

export interface StrengthJourney {
  start: StrengthReport;
  now: StrengthReport;
  /** ISO day the "start" snapshot is taken from. */
  startedOn: string;
  /** Muscle groups that climbed at least one tier since then. */
  climbed: MuscleGroup[];
  /** True once there is enough history for the comparison to mean anything. */
  meaningful: boolean;
}

/**
 * Then versus now.
 *
 * The comparison window is bounded by the athlete's own first session rather
 * than a fixed twelve months: someone eight weeks in should see their eight
 * weeks, not eleven months of empty body next to a full one. A comparison that
 * flatters by choosing a favourable start date is worth nothing.
 */
export function strengthJourney(
  state: AppState,
  library: Pick<Exercise, "id" | "name">[],
  days = 365,
  now = new Date(),
): StrengthJourney {
  const finished = (state.sessions ?? []).filter((session) => session.endedAt);
  const firstDate = finished.map((session) => session.date).sort((a, b) => a.localeCompare(b))[0];

  const windowStart = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  // The later of "a year ago" and "the day before they started".
  const startedOn = firstDate && firstDate > windowStart ? firstDate : windowStart;

  const start = strengthReportAsOf(state, library, startedOn);
  const current = strengthReport(state, library);

  const before = new Map(start.muscles.map((muscle) => [muscle.muscle, muscle.tier]));
  const climbed = current.muscles
    .filter((muscle) => {
      const then = before.get(muscle.muscle);
      const thenIndex = then ? TIERS.indexOf(then) : -1;
      return TIERS.indexOf(muscle.tier) > thenIndex;
    })
    .map((muscle) => muscle.muscle);

  return {
    start,
    now: current,
    startedOn,
    climbed,
    // One session compared against itself is not a journey.
    meaningful: current.gradedCount > 0 && finished.length >= 2,
  };
}
