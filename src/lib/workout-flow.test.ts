import { describe, expect, it } from "vitest";

import { buildSupersetIds, completedWorkingSets, nextStepAfterWorkingSet } from "./workout-flow";
import type { CompletedSet, WorkoutSessionExercise } from "./types";

function exercise(
  supersetId: string | undefined,
  completed: number,
  targetSets = 3,
): WorkoutSessionExercise {
  return {
    exerciseId: crypto.randomUUID(),
    name: "Exercise",
    primary_muscles: [],
    targetSets,
    targetReps: "8-12",
    supersetId,
    sets: Array.from({ length: completed }, () => ({ weight: 20, reps: 10 })),
  };
}

describe("workout flow", () => {
  it("builds adjacent pairs and longer linked groups", () => {
    expect(
      buildSupersetIds(["a", "b", "c", "d"], {
        a: { supersetWithNext: true },
        b: { supersetWithNext: true },
      }),
    ).toEqual(["superset-1", "superset-1", "superset-1", undefined]);
  });

  it("does not leave a group on the final exercise", () => {
    expect(buildSupersetIds(["a"], { a: { supersetWithNext: true } })).toEqual([undefined]);
  });

  it("excludes warm-up and drop sets from planned set completion", () => {
    const sets: CompletedSet[] = [
      { weight: 20, reps: 10, kind: "warmup" },
      { weight: 50, reps: 10 },
      { weight: 40, reps: 10, kind: "drop" },
    ];
    expect(completedWorkingSets(sets)).toBe(1);
  });

  it("moves directly between superset exercises", () => {
    const exercises = [exercise("pair", 0), exercise("pair", 0), exercise(undefined, 0)];
    expect(nextStepAfterWorkingSet(exercises, 0)).toEqual({ nextIndex: 1, shouldRest: false });
  });

  it("rests after a superset round and returns to the first incomplete member", () => {
    const exercises = [exercise("pair", 1), exercise("pair", 0), exercise(undefined, 0)];
    expect(nextStepAfterWorkingSet(exercises, 1)).toEqual({ nextIndex: 0, shouldRest: true });
  });

  it("advances when a normal exercise reaches its planned sets", () => {
    const exercises = [exercise(undefined, 2), exercise(undefined, 0)];
    expect(nextStepAfterWorkingSet(exercises, 0)).toEqual({ nextIndex: 1, shouldRest: true });
  });
});
