import type { WorkoutSession, WorkoutSessionExercise } from "./types";
import { parseDurationTarget, trackingModeFor } from "./set-tracking";

export type WorkoutTimeBudget = 20 | 30 | 45;

export interface TimeBudgetExercise {
  exerciseId: string;
  name: string;
  targetSets: number;
  restSeconds?: number;
  supersetId?: string;
  tracking?: "WEIGHT" | "DURATION" | "DISTANCE";
  targetSeconds?: number;
  targetReps?: string;
}

export interface TimeBudgetPlan<T extends TimeBudgetExercise = TimeBudgetExercise> {
  exercises: Array<T & { targetSets: number }>;
  omitted: T[];
  reduced: Array<{ exerciseId: string; name: string; position: number; from: number; to: number }>;
  originalMinutes: number;
  estimatedMinutes: number;
  targetMinutes: WorkoutTimeBudget;
}

const SESSION_OVERHEAD_SECONDS = 120;
const MOVEMENT_TRANSITION_SECONDS = 45;
const SET_EFFORT_SECONDS = 40;
const DEFAULT_REST_SECONDS = 90;

function normalised<T extends TimeBudgetExercise>(exercises: T[]): T[] {
  return exercises
    .filter((exercise) => Number.isFinite(exercise.targetSets) && exercise.targetSets >= 1)
    .map((exercise) => ({ ...exercise, targetSets: Math.floor(exercise.targetSets) }));
}

function effortSeconds(exercise: TimeBudgetExercise): number {
  const tracking = trackingModeFor(exercise, exercise.targetReps);
  if (tracking === "WEIGHT") return SET_EFFORT_SECONDS;
  const seconds = exercise.targetSeconds ?? parseDurationTarget(exercise.targetReps);
  return seconds != null && Number.isFinite(seconds) && seconds > 0 ? seconds : SET_EFFORT_SECONDS;
}

function groupsFor<T extends TimeBudgetExercise>(exercises: T[]): T[][] {
  const groups: T[][] = [];
  for (const exercise of exercises) {
    const last = groups.at(-1);
    if (exercise.supersetId && last?.[0]?.supersetId === exercise.supersetId) {
      last.push(exercise);
    } else {
      groups.push([exercise]);
    }
  }
  return groups;
}

/**
 * A conservative gym-floor estimate. Superset partners share one rest period
 * per round instead of being priced as two unrelated exercises.
 */
export function estimateWorkoutMinutes(exercises: TimeBudgetExercise[]): number {
  const clean = normalised(exercises);
  if (clean.length === 0) return 0;
  let seconds = SESSION_OVERHEAD_SECONDS;
  for (const group of groupsFor(clean)) {
    seconds += MOVEMENT_TRANSITION_SECONDS * group.length;
    const rounds = Math.max(...group.map((exercise) => Math.max(1, exercise.targetSets)));
    const work = group.reduce(
      (total, exercise) => total + exercise.targetSets * effortSeconds(exercise),
      0,
    );
    const rest = Math.max(
      ...group.map((exercise) =>
        exercise.restSeconds != null && Number.isFinite(exercise.restSeconds)
          ? Math.max(0, exercise.restSeconds)
          : DEFAULT_REST_SECONDS,
      ),
    );
    seconds += work + Math.max(0, rounds - 1) * rest;
  }
  return Math.max(1, Math.ceil(seconds / 60));
}

function cloneWithSets<T extends TimeBudgetExercise>(exercise: T, targetSets: number) {
  return { ...exercise, targetSets: Math.max(1, Math.min(exercise.targetSets, targetSets)) };
}

/**
 * Shortens a session without touching its saved programme. Exercises are kept
 * in their programmed order; linked supersets are selected or omitted as one
 * unit. Every retained movement starts with two useful working sets (or its
 * smaller original prescription), then spare time is filled back toward the
 * original plan in round-robin order.
 */
export function buildTimeBudgetPlan<T extends TimeBudgetExercise>(
  exercises: T[],
  targetMinutes: WorkoutTimeBudget,
  priorityExerciseId?: string,
): TimeBudgetPlan<T> {
  const clean = normalised(exercises);
  const originalMinutes = estimateWorkoutMinutes(clean);
  if (clean.length === 0 || originalMinutes <= targetMinutes) {
    return {
      exercises: clean.map((exercise) => cloneWithSets(exercise, exercise.targetSets)),
      omitted: [],
      reduced: [],
      originalMinutes,
      estimatedMinutes: originalMinutes,
      targetMinutes,
    };
  }

  const selected: Array<T & { targetSets: number }> = [];
  const originals = new Map<T, T>();
  const omitted: T[] = [];
  const groups = groupsFor(clean);
  const priorityGroups = new Set(
    groups.filter((group) => group.some((exercise) => exercise.exerciseId === priorityExerciseId)),
  );

  // Reserve the chosen movement (including every repeat and its superset
  // partners) before filling spare time. Restore programme order below.
  for (const group of [...priorityGroups, ...groups.filter((item) => !priorityGroups.has(item))]) {
    const minimum = group.map((exercise) =>
      cloneWithSets(exercise, Math.min(2, exercise.targetSets)),
    );
    const candidate = [...selected, ...minimum];
    if (
      priorityGroups.has(group) ||
      selected.length === 0 ||
      estimateWorkoutMinutes(candidate) <= targetMinutes
    ) {
      minimum.forEach((exercise, index) => originals.set(exercise, group[index]!));
      selected.push(...minimum);
    } else {
      omitted.push(...group);
    }
  }
  const positionByOriginal = new Map(clean.map((exercise, position) => [exercise, position]));
  selected.sort(
    (a, b) =>
      positionByOriginal.get(originals.get(a)!)! - positionByOriginal.get(originals.get(b)!)!,
  );

  // Extremely short budgets still keep the first movement actionable.
  while (selected.length && estimateWorkoutMinutes(selected) > targetMinutes) {
    const reducible = [...selected].reverse().find((exercise) => exercise.targetSets > 1);
    if (!reducible) break;
    reducible.targetSets -= 1;
  }

  let added = true;
  while (added) {
    added = false;
    for (const exercise of selected) {
      const original = originals.get(exercise);
      if (!original || exercise.targetSets >= original.targetSets) continue;
      const candidate = selected.map((item) =>
        item === exercise ? { ...item, targetSets: item.targetSets + 1 } : item,
      );
      if (estimateWorkoutMinutes(candidate) <= targetMinutes) {
        exercise.targetSets += 1;
        added = true;
      }
    }
  }

  const reduced = selected.flatMap((exercise, position) => {
    const original = originals.get(exercise);
    return original && original.targetSets > exercise.targetSets
      ? [
          {
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            position,
            from: original.targetSets,
            to: exercise.targetSets,
          },
        ]
      : [];
  });

  return {
    exercises: selected,
    omitted,
    reduced,
    originalMinutes,
    estimatedMinutes: estimateWorkoutMinutes(selected),
    targetMinutes,
  };
}

export function fitSessionToTimeBudget(
  session: WorkoutSession,
  targetMinutes?: WorkoutTimeBudget,
  priorityExerciseId?: string,
): WorkoutSession {
  if (
    !targetMinutes ||
    session.endedAt ||
    session.exercises.some((exercise) => exercise.sets.length > 0)
  )
    return session;
  const originalExercises = session.exercises;
  const plan = buildTimeBudgetPlan(originalExercises, targetMinutes, priorityExerciseId);
  return {
    ...session,
    exercises: plan.exercises as WorkoutSessionExercise[],
    timeBudgetMinutes: targetMinutes,
    originalExerciseCount: originalExercises.length,
    originalPlannedSets: originalExercises.reduce(
      (total, exercise) => total + exercise.targetSets,
      0,
    ),
  };
}
