import { completedWorkingSets } from "./workout-flow";
import type { WorkoutSession } from "./types";

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
    const completedSets = completedWorkingSets(exercise.sets);
    const rpes = exercise.sets
      .filter((set) => set.kind !== "warmup" && set.kind !== "drop" && set.rpe != null)
      .map((set) => set.rpe as number);
    const status: SessionReviewStatus =
      completedSets === 0
        ? "SKIPPED"
        : completedSets < exercise.targetSets
          ? "SHORT"
          : completedSets > exercise.targetSets
            ? "ABOVE"
            : "HIT";
    return {
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      plannedSets: exercise.targetSets,
      completedSets,
      status,
      ...(rpes.length
        ? { averageRpe: rpes.reduce((sum, value) => sum + value, 0) / rpes.length }
        : {}),
    };
  });
  const plannedSets = rows.reduce((sum, row) => sum + row.plannedSets, 0);
  const completedSets = rows.reduce((sum, row) => sum + row.completedSets, 0);
  const allRpes = session.exercises.flatMap((exercise) =>
    exercise.sets
      .filter((set) => set.kind !== "warmup" && set.kind !== "drop" && set.rpe != null)
      .map((set) => set.rpe as number),
  );
  return {
    rows,
    plannedSets,
    completedSets,
    adherencePercent: plannedSets
      ? Math.min(100, Math.round((completedSets / plannedSets) * 100))
      : 0,
    exercisesHit: rows.filter((row) => row.status === "HIT" || row.status === "ABOVE").length,
    exercisesPlanned: rows.length,
    ...(allRpes.length
      ? { averageRpe: allRpes.reduce((sum, value) => sum + value, 0) / allRpes.length }
      : {}),
    extraSets: rows.reduce((sum, row) => sum + Math.max(0, row.completedSets - row.plannedSets), 0),
  };
}
