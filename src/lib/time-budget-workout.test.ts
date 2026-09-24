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
  const crowded = Array.from({ length: 9 }, (_, index) => ({
    exerciseId: `move-${index}`,
    name: `Movement ${index + 1}`,
    targetSets: 4,
    restSeconds: 120,
  }));

  it("reserves a late must-keep movement without changing programme order or source", () => {
    const before = JSON.stringify(crowded);
    expect(
      buildTimeBudgetPlan(crowded, 20).omitted.some((item) => item.exerciseId === "move-8"),
    ).toBe(true);
    const plan = buildTimeBudgetPlan(crowded, 20, "move-8");
    expect(plan.exercises.some((item) => item.exerciseId === "move-8")).toBe(true);
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(20);
    const ids = plan.exercises.map((item) => item.exerciseId);
    expect(ids).toEqual(
      crowded.filter((item) => ids.includes(item.exerciseId)).map((item) => item.exerciseId),
    );
    expect(JSON.stringify(crowded)).toBe(before);
  });

  it("keeps every repeat and the selected movement's superset partner", () => {
    const input = [
      ...crowded,
      { exerciseId: "priority", name: "Priority heavy", targetSets: 3, supersetId: "pair" },
      { exerciseId: "partner", name: "Partner", targetSets: 3, supersetId: "pair" },
      { exerciseId: "priority", name: "Priority backoff", targetSets: 2 },
    ];
    const plan = buildTimeBudgetPlan(input, 20, "priority");
    expect(plan.exercises.filter((item) => item.exerciseId === "priority")).toHaveLength(2);
    expect(plan.exercises.some((item) => item.exerciseId === "partner")).toBe(true);
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(20);
    expect(plan.omitted.some((item) => ["priority", "partner"].includes(item.exerciseId))).toBe(
      false,
    );
  });

  it("falls back to programme order for a removed or unknown priority", () => {
    expect(buildTimeBudgetPlan(crowded, 20, "deleted")).toEqual(buildTimeBudgetPlan(crowded, 20));
  });

  it("honestly reports a must-keep effort that cannot fit", () => {
    const input = [
      ...crowded,
      {
        exerciseId: "hold",
        name: "Long hold",
        targetSets: 1,
        tracking: "DURATION" as const,
        targetSeconds: 1800,
      },
    ];
    const plan = buildTimeBudgetPlan(input, 20, "hold");
    expect(plan.exercises).toHaveLength(1);
    expect(plan.exercises[0]).toMatchObject({ targetSeconds: 1800 });
    expect(plan.estimatedMinutes).toBeGreaterThan(20);
  });

  it("bounds every feasible priority and partitions the input exactly once", () => {
    for (const budget of [20, 30, 45] as const) {
      for (const priority of crowded) {
        const plan = buildTimeBudgetPlan(crowded, budget, priority.exerciseId);
        expect(plan.estimatedMinutes).toBeLessThanOrEqual(budget);
        expect(plan.exercises.some((item) => item.exerciseId === priority.exerciseId)).toBe(true);
        expect([...plan.exercises, ...plan.omitted].map((item) => item.exerciseId).sort()).toEqual(
          crowded.map((item) => item.exerciseId).sort(),
        );
        expect(plan.exercises.every((item) => item.targetSets >= 1 && item.targetSets <= 4)).toBe(
          true,
        );
      }
    }
  });
  it("counts prescribed duration instead of treating long holds as forty seconds", () => {
    const holds = [
      { exerciseId: "hold", name: "Plank", targetSets: 3, targetReps: "5 min", restSeconds: 60 },
    ];
    expect(estimateWorkoutMinutes(holds)).toBe(20);
    expect(estimateWorkoutMinutes([{ ...holds[0]!, targetSeconds: 600 }])).toBe(35);
  });

  it("rejects non-finite set counts and falls back from invalid rest intervals", () => {
    const invalid = [NaN, Infinity, -1, 0].map((targetSets) => ({
      exerciseId: "invalid",
      name: "Invalid",
      targetSets,
    }));
    expect(buildTimeBudgetPlan(invalid, 20).exercises).toEqual([]);
    const plan = buildTimeBudgetPlan([{ ...exercises[0]!, restSeconds: NaN }, ...exercises], 20);
    expect(Number.isFinite(plan.estimatedMinutes)).toBe(true);
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(20);
  });

  it("keeps repeat occurrences tied to their own original prescription", () => {
    const repeated = [
      { exerciseId: "bench", name: "Bench heavy", targetSets: 2, restSeconds: 120 },
      { exerciseId: "bench", name: "Bench backoff", targetSets: 8, restSeconds: 60 },
      ...exercises,
    ];
    const plan = buildTimeBudgetPlan(repeated, 20);
    for (const row of plan.reduced) {
      const original = repeated.find((exercise) => exercise.name === row.name)!;
      expect(row.from).toBe(original.targetSets);
      expect(row.to).toBe(plan.exercises[row.position]!.targetSets);
    }
    expect(plan.exercises[0]!.targetSets).toBeLessThanOrEqual(2);
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(20);
  });

  it("reports an impossible budget honestly rather than shortening the timed effort", () => {
    const plan = buildTimeBudgetPlan(
      [
        {
          exerciseId: "bike",
          name: "Bike",
          targetSets: 1,
          tracking: "DISTANCE",
          targetSeconds: 3600,
        },
      ],
      20,
    );
    expect(plan.estimatedMinutes).toBeGreaterThan(20);
    expect(plan.exercises[0]!.targetSeconds).toBe(3600);
  });
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
    const fitted = fitSessionToTimeBudget(session, 20, "calf");
    expect(fitted).not.toBe(session);
    expect(fitted.timeBudgetMinutes).toBe(20);
    expect(fitted.originalExerciseCount).toBe(5);
    expect(fitted.label).toBe("LOWER");
    expect(session.exercises).toHaveLength(5);
    expect(session.label).toBe("LOWER");
    expect(fitted.exercises.some((item) => item.exerciseId === "calf")).toBe(true);
    expect(
      fitSessionToTimeBudget({ ...session, endedAt: "2026-09-23T13:00:00Z" }, 20, "calf")
        .timeBudgetMinutes,
    ).toBeUndefined();
    const started = {
      ...session,
      exercises: session.exercises.map((item, index) => ({
        ...item,
        sets: index === 0 ? [{ weight: 20, reps: 8, at: "2026-09-23T12:01:00Z" }] : [],
      })),
    };
    expect(fitSessionToTimeBudget(started, 20, "calf")).toBe(started);
  });
});
