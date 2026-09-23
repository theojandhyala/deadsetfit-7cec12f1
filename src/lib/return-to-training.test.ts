import { describe, expect, it } from "vitest";

import { applyReturnRamp, eligibleReturnGap, trainingGapDays } from "./return-to-training";
import type { WorkoutSession } from "./types";
import { toKg } from "./units";

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
    const source = session("2026-09-01", false);
    source.exercises[0]!.sets = [];
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

  it("never raises light loads, removes their weight or goes below a configured bar", () => {
    for (const weight of [0.5, 1, 1.5, 2, 2.5, 3, 5, 10, 20]) {
      const source = session("2026-09-01", false);
      source.exercises[0]!.sets = [];
      source.exercises[0]!.plannedWeightKg = weight;
      const result = applyReturnRamp(source, 22).exercises[0]!.plannedWeightKg!;
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(weight);
    }
    const source = session("2026-09-01", false);
    source.exercises[0] = { ...source.exercises[0]!, sets: [], plannedWeightKg: 20, barKg: 20 };
    expect(applyReturnRamp(source, 22).exercises[0]!.plannedWeightKg).toBe(20);
  });

  it("uses pound equipment increments while continuing to store kilograms", () => {
    const source = session("2026-09-01", false);
    source.exercises[0] = { ...source.exercises[0]!, sets: [], plannedWeightKg: toKg(100, "lb") };
    expect(applyReturnRamp(source, 22, "lb").exercises[0]!.plannedWeightKg).toBe(toKg(90, "lb"));
  });

  it("never rewrites a started or finished session", () => {
    const finished = session("2026-09-01");
    const started = session("2026-09-01", false);
    expect(applyReturnRamp(finished, 22)).toBe(finished);
    expect(applyReturnRamp(started, 22)).toBe(started);
  });

  it("ignores invalid calendar dates and warmup-only sessions but counts timed work", () => {
    const warmup = session("2026-09-22");
    warmup.exercises[0]!.sets[0]!.kind = "warmup";
    const timed = session("2026-09-01");
    timed.exercises[0]!.sets = [{ weight: 0, reps: 0, mode: "duration", seconds: 45 }];
    expect(trainingGapDays([warmup, session("2026-02-31"), timed], new Date(2026, 8, 23))).toBe(22);
    expect(trainingGapDays([session("2026-02-31")], new Date(2026, 8, 23))).toBeNull();
  });
});
