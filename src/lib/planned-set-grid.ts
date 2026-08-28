import { defaultSchedule } from "./calc";
import { allExercises, getExercise } from "./exercises";
import { toMuscleGroup } from "./recovery";
import type { AppState, DayKey, Exercise, FocusMuscle } from "./types";

export const SET_GRID_DAYS: readonly DayKey[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

export const SET_GRID_MUSCLES: readonly FocusMuscle[] = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "ARMS",
  "LEGS",
  "CORE",
] as const;

export interface PlannedSetCell {
  day: DayKey;
  sets: number;
  exercises: number;
}

export interface PlannedSetRow {
  muscle: FocusMuscle;
  totalSets: number;
  trainingDays: number;
  cells: PlannedSetCell[];
}

export interface PlannedSetGrid {
  rows: PlannedSetRow[];
  totalSets: number;
  coveredMuscles: number;
  source: "PROGRAM" | "SCHEDULE";
}

function positiveSets(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(20, Math.round(parsed)) : fallback;
}

function broadMuscles(raw: readonly string[], fallback?: FocusMuscle): FocusMuscle[] {
  const resolved = new Set<FocusMuscle>();
  for (const label of raw) {
    const muscle = toMuscleGroup(label);
    if (muscle) resolved.add(muscle);
  }
  if (resolved.size === 0 && fallback) resolved.add(fallback);
  return [...resolved];
}

/**
 * Planned working sets by broad muscle and weekday.
 *
 * Active programmes take precedence because they are the source used by the
 * live workout route. A compound movement contributes its prescribed sets to
 * every distinct broad primary-muscle group, never twice to the same group.
 */
export function buildPlannedSetGrid(
  state: AppState,
  library: readonly Exercise[] = allExercises(state.savedExercises),
): PlannedSetGrid {
  const counts = new Map<FocusMuscle, Map<DayKey, { sets: number; exercises: number }>>();
  for (const muscle of SET_GRID_MUSCLES) {
    counts.set(muscle, new Map(SET_GRID_DAYS.map((day) => [day, { sets: 0, exercises: 0 }])));
  }

  const active = state.programs.find((program) => program.id === state.activeProgramId);
  if (active) {
    for (const day of SET_GRID_DAYS) {
      for (const exercise of active.days[day]?.items ?? []) {
        const muscles = broadMuscles(exercise.primary_muscles);
        const sets = positiveSets(exercise.sets, 3);
        for (const muscle of muscles) {
          const cell = counts.get(muscle)!.get(day)!;
          cell.sets += sets;
          cell.exercises += 1;
        }
      }
    }
  } else {
    const schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
    for (const day of SET_GRID_DAYS) {
      const plannedDay = schedule?.[day];
      if (!plannedDay) continue;
      for (const exerciseId of plannedDay.exerciseIds) {
        const exercise = getExercise(exerciseId, [...library]);
        if (!exercise) continue;
        const sets = positiveSets(
          plannedDay.exerciseConfig?.[exerciseId]?.sets ?? plannedDay.sets,
          positiveSets(exercise.sets, 3),
        );
        const muscles = broadMuscles(exercise.primaryMuscles ?? [], exercise.muscleGroup);
        for (const muscle of muscles) {
          const cell = counts.get(muscle)!.get(day)!;
          cell.sets += sets;
          cell.exercises += 1;
        }
      }
    }
  }

  const rows = SET_GRID_MUSCLES.map((muscle) => {
    const cells = SET_GRID_DAYS.map((day) => ({ day, ...counts.get(muscle)!.get(day)! }));
    return {
      muscle,
      cells,
      totalSets: cells.reduce((sum, cell) => sum + cell.sets, 0),
      trainingDays: cells.filter((cell) => cell.sets > 0).length,
    };
  });
  return {
    rows,
    totalSets: rows.reduce((sum, row) => sum + row.totalSets, 0),
    coveredMuscles: rows.filter((row) => row.totalSets > 0).length,
    source: active ? "PROGRAM" : "SCHEDULE",
  };
}
