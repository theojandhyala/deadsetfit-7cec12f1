import { describe, expect, it } from "vitest";

import { buildSessionPlanReview } from "./session-review";
import type { WorkoutSession } from "./types";

function session(): WorkoutSession {
  return {
    id: "review",
    date: "2026-09-23",
    dayKey: "WED",
    label: "PUSH",
    programId: null,
    startedAt: "2026-09-23T12:00:00Z",
    endedAt: "2026-09-23T13:00:00Z",
    totalVolume: 0,
    prCount: 0,
    exercises: [
      {
        exerciseId: "bench",
        name: "Bench Press",
        primary_muscles: ["CHEST"],
        targetSets: 3,
        targetReps: "8",
        sets: [
          { weight: 40, reps: 10, kind: "warmup" },
          { weight: 80, reps: 8, rpe: 8 },
          { weight: 80, reps: 8, rpe: 9 },
          { weight: 80, reps: 7, kind: "drop" },
          { weight: 80, reps: 8, rpe: 9 },
        ],
      },
      {
        exerciseId: "press",
        name: "Shoulder Press",
        primary_muscles: ["SHOULDERS"],
        targetSets: 3,
        targetReps: "10",
        sets: [{ weight: 30, reps: 10 }],
      },
      {
        exerciseId: "raise",
        name: "Lateral Raise",
        primary_muscles: ["SHOULDERS"],
        targetSets: 2,
        targetReps: "12",
        sets: [],
      },
    ],
  };
}

describe("session plan review", () => {
  it("keeps receipt percentages finite for malformed historical targets", () => {
    const value = session();
    value.exercises = [NaN, Infinity, -3, 2.9].map((targetSets) => ({
      ...value.exercises[0]!,
      targetSets,
    }));
    const result = buildSessionPlanReview(value);
    expect(result.plannedSets).toBe(2);
    expect(result.adherencePercent).toBe(100);
    expect(result.rows.map((row) => row.plannedSets)).toEqual([0, 0, 0, 2]);
  });
  it("does not let extra sets hide a missed exercise", () => {
    const value = session();
    value.exercises = [
      {
        ...value.exercises[0]!,
        targetSets: 2,
        sets: Array.from({ length: 4 }, () => ({ weight: 80, reps: 8 })),
      },
      { ...value.exercises[1]!, targetSets: 2, sets: [] },
    ];
    expect(buildSessionPlanReview(value)).toMatchObject({
      adherencePercent: 50,
      completedSets: 4,
      extraSets: 2,
    });
  });

  it("excludes invalid effort ratings from averages", () => {
    const value = session();
    value.exercises = [
      {
        ...value.exercises[0]!,
        sets: [8, NaN, Infinity, 0, 11].map((rpe) => ({ weight: 80, reps: 8, rpe })),
      },
    ];
    const review = buildSessionPlanReview(value);
    expect(review.averageRpe).toBe(8);
    expect(review.rows[0]!.averageRpe).toBe(8);
  });
  it("compares genuine working sets without counting warmups or drops", () => {
    const review = buildSessionPlanReview(session());
    expect(review.plannedSets).toBe(8);
    expect(review.completedSets).toBe(4);
    expect(review.adherencePercent).toBe(50);
    expect(review.rows.map((row) => row.status)).toEqual(["HIT", "SHORT", "SKIPPED"]);
    expect(review.rows[0]?.averageRpe).toBeCloseTo(8.67, 1);
  });

  it("caps adherence at 100 while reporting deliberate extra work", () => {
    const value = session();
    value.exercises = [
      {
        ...value.exercises[0]!,
        targetSets: 1,
        sets: [
          { weight: 80, reps: 8 },
          { weight: 80, reps: 8 },
        ],
      },
    ];
    const review = buildSessionPlanReview(value);
    expect(review.adherencePercent).toBe(100);
    expect(review.extraSets).toBe(1);
    expect(review.rows[0]?.status).toBe("ABOVE");
  });
});
