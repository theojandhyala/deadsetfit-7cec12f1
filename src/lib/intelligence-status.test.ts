import { describe, it, expect } from "vitest";

import { intelligenceStatus } from "./intelligence-status";
import type { AppState, WorkoutSession } from "./types";

const TODAY = "2026-07-31";

function session(date: string): WorkoutSession {
  return {
    id: date,
    date,
    dayKey: "MON",
    label: "Day",
    programId: null,
    startedAt: `${date}T10:00:00Z`,
    endedAt: `${date}T11:00:00Z`,
    totalVolume: 0,
    prCount: 0,
    exercises: [
      {
        exerciseId: "e1",
        name: "Lift",
        primary_muscles: ["chest"],
        targetSets: 3,
        targetReps: "8",
        sets: [
          { weight: 80, reps: 8 },
          { weight: 80, reps: 8 },
          { weight: 80, reps: 8 },
        ],
      },
    ],
  } as WorkoutSession;
}

function emptyState(): AppState {
  return {
    profile: {
      goal: "BULK",
      experience: "BEGINNER",
      age: 25,
      weightKg: 80,
      heightCm: 180,
      gender: "MALE",
      daysPerWeek: 3,
      trainingDays: ["MON", "WED", "FRI"],
      equipment: "FULL_GYM",
    },
    sessions: [],
    completedDates: [],
    foodLog: [],
    weights: [],
    water: [],
    waterTargetMl: 3000,
  } as unknown as AppState;
}

describe("intelligenceStatus", () => {
  it("reports everything locked on a fresh account, with unlock hints", () => {
    const r = intelligenceStatus(emptyState(), TODAY);
    expect(r.active).toBe(0);
    expect(r.total).toBe(12);
    const records = r.engines.find((e) => e.key === "records")!;
    expect(records.active).toBe(false);
    expect(records.need).toContain("first workout");
  });

  it("flips engines on exactly when their real gate opens", () => {
    const s = emptyState();
    s.sessions = [session("2026-07-28")];
    s.completedDates = ["2026-07-28"];
    const r = intelligenceStatus(s, TODAY);
    expect(r.engines.find((e) => e.key === "records")!.active).toBe(true);
    expect(r.engines.find((e) => e.key === "story")!.active).toBe(true);
    // One session isn't enough for the rhythm engine.
    expect(r.engines.find((e) => e.key === "rhythm")!.active).toBe(false);
    expect(r.active).toBe(2);
  });

  it("calorie cycling activates with a target and a mixed week", () => {
    const withGoal = intelligenceStatus(emptyState(), TODAY, 2600);
    expect(withGoal.engines.find((e) => e.key === "cycling")!.active).toBe(true);
    const noGoal = intelligenceStatus(emptyState(), TODAY, 0);
    expect(noGoal.engines.find((e) => e.key === "cycling")!.active).toBe(false);
  });
});
