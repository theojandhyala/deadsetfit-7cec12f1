import type { WorkoutSession, WorkoutSessionExercise } from "./types";

export type WorkoutTimeBudget = 20 | 30 | 45;

export interface TimeBudgetExercise {
  exerciseId: string;
  name: string;
  targetSets: number;
  restSeconds?: number;
  supersetId?: string;
}

export interface TimeBudgetPlan<T extends TimeBudgetExercise = TimeBudgetExercise> {
  exercises: Array<T & { targetSets: number }>;
  omitted: T[];
  reduced: Array<{ exerciseId: string; name: string; from: number; to: number }>;
  originalMinutes: number;
  estimatedMinutes: number;
  targetMinutes: WorkoutTimeBudget;
}

const SESSION_OVERHEAD_SECONDS = 120;
const MOVEMENT_TRANSITION_SECONDS = 45;
const SET_EFFORT_SECONDS = 40;
const DEFAULT_REST_SECONDS = 90;

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
  if (exercises.length === 0) return 0;
  let seconds = SESSION_OVERHEAD_SECONDS;
  for (const group of groupsFor(exercises)) {
    seconds += MOVEMENT_TRANSITION_SECONDS * group.length;
    const rounds = Math.max(...group.map((exercise) => Math.max(1, exercise.targetSets)));
    const work = group.reduce(
      (total, exercise) => total + Math.max(1, exercise.targetSets) * SET_EFFORT_SECONDS,
      0,
    );
    const rest = Math.max(
      ...group.map((exercise) => Math.max(0, exercise.restSeconds ?? DEFAULT_REST_SECONDS)),
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
): TimeBudgetPlan<T> {
  const clean = exercises.filter((exercise) => exercise.targetSets > 0);
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
  const omitted: T[] = [];
  const groups = groupsFor(clean);

  for (const group of groups) {
    const minimum = group.map((exercise) =>
      cloneWithSets(exercise, Math.min(2, exercise.targetSets)),
    );
    const candidate = [...selected, ...minimum];
    if (selected.length === 0 || estimateWorkoutMinutes(candidate) <= targetMinutes) {
      selected.push(...minimum);
    } else {
      omitted.push(...group);
    }
  }

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
      const original = clean.find((item) => item.exerciseId === exercise.exerciseId);
      if (!original || exercise.targetSets >= original.targetSets) continue;
      const candidate = selected.map((item) =>
        item.exerciseId === exercise.exerciseId
          ? { ...item, targetSets: item.targetSets + 1 }
          : item,
      );
      if (estimateWorkoutMinutes(candidate) <= targetMinutes) {
        exercise.targetSets += 1;
        added = true;
      }
    }
  }

  const reduced = selected.flatMap((exercise) => {
    const original = clean.find((item) => item.exerciseId === exercise.exerciseId);
    return original && original.targetSets > exercise.targetSets
      ? [
          {
            exerciseId: exercise.exerciseId,
            name: exercise.name,
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
): WorkoutSession {
  if (!targetMinutes) return session;
  const originalExercises = session.exercises;
  const plan = buildTimeBudgetPlan(originalExercises, targetMinutes);
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
