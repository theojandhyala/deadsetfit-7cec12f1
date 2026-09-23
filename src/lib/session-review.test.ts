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
