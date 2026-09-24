import type { WorkoutSession } from "./types";
import { completedWorkingSets } from "./workout-flow";

/** Repeat the prescription, never the old records, rest clock or completion. */
export function repeatWorkout(
  source: WorkoutSession,
  start: Pick<WorkoutSession, "id" | "date" | "startedAt">,
): WorkoutSession {
  return {
    ...start,
    dayKey: source.dayKey,
    programId: source.programId ?? null,
    label: source.label,
    totalVolume: 0,
    prCount: 0,
    exercises: source.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      primary_muscles: [...exercise.primary_muscles],
      targetSets: Math.max(1, completedWorkingSets(exercise.sets) || exercise.targetSets),
      targetReps: exercise.targetReps,
      plannedWeightKg: exercise.plannedWeightKg,
      restSeconds: exercise.restSeconds,
      targetRir: exercise.targetRir,
      progression: exercise.progression,
      tempo: exercise.tempo,
      note: exercise.note,
      supersetId: exercise.supersetId,
      tracking: exercise.tracking,
      targetSeconds: exercise.targetSeconds,
      barKg: exercise.barKg,
      sets: [],
    })),
  };
}
