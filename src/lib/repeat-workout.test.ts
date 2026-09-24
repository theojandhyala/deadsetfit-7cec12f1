import { describe, expect, it } from "vitest";
import { repeatWorkout } from "./repeat-workout";
import type { WorkoutSession } from "./types";

const source: WorkoutSession = {
  id: "old",
  date: "2026-09-20",
  startedAt: "2026-09-20T10:00:00Z",
  endedAt: "2026-09-20T11:00:00Z",
  dayKey: "SUN",
  programId: "plan",
  label: "Mixed session",
  totalVolume: 240,
  prCount: 1,
  timeBudgetMinutes: 20,
  returnRampGapDays: 14,
  exercises: [
    {
      exerciseId: "hold",
      name: "Weighted plank",
      primary_muscles: ["CORE"],
      targetSets: 3,
      targetReps: "60s",
      tracking: "DURATION",
      targetSeconds: 60,
      plannedWeightKg: 5,
      sets: [{ weight: 5, reps: 0, mode: "duration", seconds: 60, isPR: true }],
    },
    {
      exerciseId: "rower",
      name: "Rower",
      primary_muscles: ["BACK"],
      targetSets: 1,
      targetReps: "500m",
      tracking: "DISTANCE",
      sets: [{ weight: 0, reps: 0, mode: "distance", meters: 500 }],
    },
    {
      exerciseId: "press",
      name: "Press",
      primary_muscles: ["SHOULDERS"],
      targetSets: 3,
      targetReps: "8",
      tracking: "WEIGHT",
      barKg: 15,
      plannedWeightKg: 30,
      restSeconds: 120,
      supersetId: "pair",
      targetRir: 2,
      note: "Controlled",
      sets: [
        { weight: 15, reps: 8, kind: "warmup" },
        { weight: 30, reps: 8 },
        { weight: 20, reps: 8, kind: "drop" },
      ],
    },
  ],
};
const start = { id: "fresh", date: "2026-09-24", startedAt: "2026-09-24T10:00:00Z" };

describe("repeat workout", () => {
  it("preserves timed, distance and equipment prescriptions", () => {
    const next = repeatWorkout(source, start);
    expect(next.exercises[0]).toMatchObject({
      tracking: "DURATION",
      targetSeconds: 60,
      plannedWeightKg: 5,
    });
    expect(next.exercises[1]).toMatchObject({ tracking: "DISTANCE", targetReps: "500m" });
    expect(next.exercises[2]).toMatchObject({
      barKg: 15,
      restSeconds: 120,
      supersetId: "pair",
      note: "Controlled",
      targetRir: 2,
    });
  });
  it("starts fresh without historical totals, completion or adaptation badges", () => {
    const next = repeatWorkout(source, start);
    expect(next).toMatchObject({ ...start, totalVolume: 0, prCount: 0 });
    expect(next.endedAt).toBeUndefined();
    expect(next.timeBudgetMinutes).toBeUndefined();
    expect(next.returnRampGapDays).toBeUndefined();
    expect(next.exercises.every((exercise) => exercise.sets.length === 0)).toBe(true);
  });
  it("counts working sets only and leaves history untouched", () => {
    const before = JSON.stringify(source);
    const next = repeatWorkout(source, start);
    expect(next.exercises[2]!.targetSets).toBe(1);
    next.exercises[0]!.primary_muscles.push("BACK");
    expect(JSON.stringify(source)).toBe(before);
  });
  it("keeps the target for a skipped exercise", () => {
    const next = repeatWorkout(
      { ...source, exercises: [{ ...source.exercises[0]!, sets: [] }] },
      start,
    );
    expect(next.exercises[0]!.targetSets).toBe(3);
  });
});
