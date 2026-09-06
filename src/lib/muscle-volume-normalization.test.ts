import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import { weeklyVolume } from "./pro-intelligence";
import { toMuscleGroup } from "./recovery";
import type { AppState, WorkoutSession } from "./types";

describe("muscle normalization", () => {
  it.each([
    ["erectors", "BACK"],
    ["hip-flexors", "LEGS"],
    ["adductors", "LEGS"],
    ["abductors", "LEGS"],
    ["rear delts", "SHOULDERS"],
  ] as const)("maps %s to %s", (raw, expected) => {
    expect(toMuscleGroup(raw)).toBe(expected);
  });
});

describe("weeklyVolume", () => {
  it("counts valid duration work even though timed sets store reps zero", () => {
    const now = new Date("2026-08-27T12:00:00.000Z").getTime();
    const session: WorkoutSession = {
      id: "session-1",
      date: "2026-08-27",
      dayKey: "THU",
      label: "CORE",
      programId: null,
      startedAt: "2026-08-27T10:00:00.000Z",
      endedAt: "2026-08-27T10:20:00.000Z",
      totalVolume: 0,
      prCount: 0,
      exercises: [
        {
          exerciseId: "plank",
          name: "Plank",
          primary_muscles: ["core"],
          targetSets: 3,
          targetReps: "30-45s",
          tracking: "DURATION",
          sets: [
            { mode: "duration", seconds: 45, weight: 0, reps: 0 },
            { mode: "duration", seconds: 40, weight: 0, reps: 0, kind: "warmup" },
            { mode: "duration", seconds: 30, weight: 0, reps: 0, kind: "drop" },
          ],
        },
      ],
    };
    const state = { ...DEFAULT_STATE, sessions: [session] } as AppState;

    expect(weeklyVolume(state, now).find((item) => item.muscle === "CORE")?.sets).toBe(1);
  });
});
