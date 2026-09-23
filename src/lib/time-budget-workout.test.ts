import { describe, expect, it } from "vitest";

import {
  buildTimeBudgetPlan,
  estimateWorkoutMinutes,
  fitSessionToTimeBudget,
} from "./time-budget-workout";
import type { WorkoutSession } from "./types";

const exercises = [
  { exerciseId: "squat", name: "Back Squat", targetSets: 5, restSeconds: 120 },
  { exerciseId: "rdl", name: "Romanian Deadlift", targetSets: 4, restSeconds: 90 },
  { exerciseId: "split", name: "Split Squat", targetSets: 3, restSeconds: 75 },
  { exerciseId: "curl", name: "Leg Curl", targetSets: 3, restSeconds: 60 },
  { exerciseId: "calf", name: "Calf Raise", targetSets: 4, restSeconds: 45 },
];

describe("time-budget workout", () => {
  it("returns the unchanged plan when it already fits", () => {
    const short = exercises.slice(0, 1).map((exercise) => ({ ...exercise, targetSets: 2 }));
    const plan = buildTimeBudgetPlan(short, 45);
    expect(plan.exercises).toEqual(short);
    expect(plan.omitted).toEqual([]);
    expect(plan.reduced).toEqual([]);
  });

  it("keeps plan order and produces an honest bounded express session", () => {
    const plan = buildTimeBudgetPlan(exercises, 20);
    expect(plan.exercises[0]?.exerciseId).toBe("squat");
    expect(plan.exercises.map((exercise) => exercise.exerciseId)).toEqual(
      exercises.slice(0, plan.exercises.length).map((exercise) => exercise.exerciseId),
    );
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(20);
    expect(plan.omitted.length + plan.exercises.length).toBe(exercises.length);
    expect(plan.reduced.length).toBeGreaterThan(0);
  });

  it("never separates linked superset partners", () => {
    const linked = [
      { exerciseId: "bench", name: "Bench", targetSets: 4, supersetId: "a" },
      { exerciseId: "row", name: "Row", targetSets: 4, supersetId: "a" },
      ...exercises,
    ];
    const plan = buildTimeBudgetPlan(linked, 20);
    const kept = plan.exercises.map((exercise) => exercise.exerciseId);
    expect(kept.includes("bench")).toBe(kept.includes("row"));
  });

  it("prices a superset below the same movements performed separately", () => {
    const separate = exercises.slice(0, 2);
    const linked = separate.map((exercise) => ({ ...exercise, supersetId: "pair" }));
    expect(estimateWorkoutMinutes(linked)).toBeLessThan(estimateWorkoutMinutes(separate));
  });

  it("fits a cloned live session without mutating the saved source", () => {
    const session: WorkoutSession = {
      id: "session",
      date: "2026-09-23",
      dayKey: "TUE",
      label: "LOWER",
      programId: null,
      startedAt: "2026-09-23T12:00:00.000Z",
      totalVolume: 0,
      prCount: 0,
      exercises: exercises.map((exercise) => ({
        ...exercise,
        primary_muscles: ["LEGS"],
        targetReps: "8-10",
        sets: [],
      })),
    };
    const fitted = fitSessionToTimeBudget(session, 20);
    expect(fitted).not.toBe(session);
    expect(fitted.timeBudgetMinutes).toBe(20);
    expect(fitted.originalExerciseCount).toBe(5);
    expect(fitted.label).toBe("LOWER");
    expect(session.exercises).toHaveLength(5);
    expect(session.label).toBe("LOWER");
  });
});
