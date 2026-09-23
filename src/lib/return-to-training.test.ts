import { describe, expect, it } from "vitest";

import { applyReturnRamp, eligibleReturnGap, trainingGapDays } from "./return-to-training";
import type { WorkoutSession } from "./types";

function session(date: string, ended = true): WorkoutSession {
  return {
    id: date,
    date,
    dayKey: "MON",
    label: "UPPER",
    programId: null,
    startedAt: `${date}T12:00:00Z`,
    ...(ended ? { endedAt: `${date}T13:00:00Z` } : {}),
    totalVolume: 0,
    prCount: 0,
    exercises: [
      {
        exerciseId: "bench",
        name: "Bench Press",
        primary_muscles: ["CHEST"],
        targetSets: 4,
        targetReps: "8",
        plannedWeightKg: 83,
        targetRir: 1,
        sets: [{ weight: 80, reps: 8 }],
      },
    ],
  };
}

describe("return to training", () => {
  it("measures from the latest genuinely completed training day", () => {
    const sessions = [session("2026-09-01"), session("2026-09-20", false), session("2030-01-01")];
    expect(trainingGapDays(sessions, new Date(2026, 8, 23, 20))).toBe(22);
    expect(eligibleReturnGap(sessions, new Date(2026, 8, 23, 20))).toBe(22);
  });

  it("does not treat new athletes or a normal training rhythm as a comeback", () => {
    expect(eligibleReturnGap([], new Date(2026, 8, 23))).toBeNull();
    expect(eligibleReturnGap([session("2026-09-18")], new Date(2026, 8, 23))).toBeNull();
  });

  it("reduces only the cloned session and keeps bodyweight loads untouched", () => {
    const source = session("2026-09-01");
    source.exercises.push({
      exerciseId: "pullup",
      name: "Pull-up",
      primary_muscles: ["BACK"],
      targetSets: 2,
      targetReps: "AMRAP",
      plannedWeightKg: 0,
      sets: [],
    });
    const ramp = applyReturnRamp(source, 22);
    expect(ramp).not.toBe(source);
    expect(ramp.returnRampGapDays).toBe(22);
    expect(ramp.exercises[0]).toMatchObject({ targetSets: 3, plannedWeightKg: 75, targetRir: 3 });
    expect(ramp.exercises[1]).toMatchObject({ targetSets: 2, plannedWeightKg: 0, targetRir: 3 });
    expect(source.exercises[0]).toMatchObject({ targetSets: 4, plannedWeightKg: 83, targetRir: 1 });
  });
});
