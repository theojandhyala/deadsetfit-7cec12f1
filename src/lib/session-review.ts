import { completedWorkingSets } from "./workout-flow";
import { isWorkingSet } from "./set-tracking";
import type { CompletedSet, WorkoutSession } from "./types";

function workingRpes(sets: CompletedSet[]): number[] {
  return sets
    .filter(isWorkingSet)
    .flatMap((set) =>
      typeof set.rpe === "number" && Number.isFinite(set.rpe) && set.rpe >= 1 && set.rpe <= 10
        ? [set.rpe]
        : [],
    );
}

export type SessionReviewStatus = "HIT" | "ABOVE" | "SHORT" | "SKIPPED";

export interface SessionReviewRow {
  exerciseId: string;
  name: string;
  plannedSets: number;
  completedSets: number;
  status: SessionReviewStatus;
  averageRpe?: number;
}

export interface SessionPlanReview {
  rows: SessionReviewRow[];
  plannedSets: number;
  completedSets: number;
  adherencePercent: number;
  exercisesHit: number;
  exercisesPlanned: number;
  averageRpe?: number;
  extraSets: number;
}

export function buildSessionPlanReview(session: WorkoutSession): SessionPlanReview {
  const rows = session.exercises.map<SessionReviewRow>((exercise) => {
    const plannedSets = Number.isFinite(exercise.targetSets)
      ? Math.max(0, Math.floor(exercise.targetSets))
      : 0;
    const completedSets = completedWorkingSets(exercise.sets);
    const rpes = workingRpes(exercise.sets);
    const status: SessionReviewStatus =
      completedSets === 0
        ? "SKIPPED"
        : completedSets < plannedSets
          ? "SHORT"
          : completedSets > plannedSets
            ? "ABOVE"
            : "HIT";
    return {
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      plannedSets,
      completedSets,
      status,
      ...(rpes.length
        ? { averageRpe: rpes.reduce((sum, value) => sum + value, 0) / rpes.length }
        : {}),
    };
  });
  const plannedSets = rows.reduce((sum, row) => sum + row.plannedSets, 0);
  const completedSets = rows.reduce((sum, row) => sum + row.completedSets, 0);
  const fulfilledSets = rows.reduce(
    (sum, row) => sum + Math.min(row.completedSets, row.plannedSets),
    0,
  );
  const allRpes = session.exercises.flatMap((exercise) => workingRpes(exercise.sets));
  return {
    rows,
    plannedSets,
    completedSets,
    adherencePercent: plannedSets
      ? Math.min(100, Math.round((fulfilledSets / plannedSets) * 100))
      : 0,
    exercisesHit: rows.filter((row) => row.status === "HIT" || row.status === "ABOVE").length,
    exercisesPlanned: rows.length,
    ...(allRpes.length
      ? { averageRpe: allRpes.reduce((sum, value) => sum + value, 0) / allRpes.length }
      : {}),
    extraSets: rows.reduce((sum, row) => sum + Math.max(0, row.completedSets - row.plannedSets), 0),
  };
}
