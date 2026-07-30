import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import {
  beatsGhost,
  ghostSets,
  minTargetReps,
  suggestNextWeight,
  topSetHistory,
} from "./progression";
import type { AppState, CompletedSet, WorkoutSession } from "./types";

function session(id: string, date: string, sets: CompletedSet[], ended = true): WorkoutSession {
  return {
    id,
    date,
    dayKey: "MON",
    label: "Push",
    programId: null,
    startedAt: `${date}T10:00:00.000Z`,
    endedAt: ended ? `${date}T11:00:00.000Z` : undefined,
    exercises: [
      {
        exerciseId: "bench-press",
        name: "Bench Press",
        primary_muscles: ["chest"],
        targetSets: sets.length,
        targetReps: "8-10",
        sets,
      },
    ],
    totalVolume: 0,
    prCount: 0,
  };
}

function state(sessions: WorkoutSession[]): AppState {
  return { ...structuredClone(DEFAULT_STATE), sessions };
}

describe("progression", () => {
  it("progresses when every set hits target with reps in reserve", () => {
    const result = suggestNextWeight(
      state([
        session("one", "2026-07-20", [
          { weight: 80, reps: 8, rpe: 8 },
          { weight: 80, reps: 9, rpe: 8 },
        ]),
      ]),
      "bench-press",
      "8-10",
    );
    expect(result).toMatchObject({ weightKg: 82.5, kind: "up", ready: true });
  });

  it("holds weight when target reps are missed or effort is maximal", () => {
    const missed = suggestNextWeight(
      state([session("one", "2026-07-20", [{ weight: 80, reps: 7, rpe: 8 }])]),
      "bench-press",
      "8-10",
    );
    const grinding = suggestNextWeight(
      state([session("two", "2026-07-21", [{ weight: 80, reps: 8, rpe: 9.5 }])]),
      "bench-press",
      "8-10",
    );
    expect(missed).toMatchObject({ weightKg: 80, kind: "hold" });
    expect(grinding).toMatchObject({ weightKg: 80, kind: "hold" });
  });

  it("ignores unfinished workouts and returns the latest completed ghost", () => {
    const app = state([
      session("finished", "2026-07-20", [{ weight: 75, reps: 10 }]),
      session("active", "2026-07-21", [{ weight: 80, reps: 8 }], false),
    ]);
    expect(topSetHistory(app, "bench-press")).toEqual([
      { date: "2026-07-20", weight: 75, reps: 10 },
    ]);
    expect(ghostSets(app, "bench-press", "new")).toEqual([{ weight: 75, reps: 10 }]);
  });

  it("requires a strict improvement to beat a ghost", () => {
    expect(beatsGhost({ weight: 80, reps: 8 }, { weight: 80, reps: 8 })).toBe(false);
    expect(beatsGhost({ weight: 80, reps: 9 }, { weight: 80, reps: 8 })).toBe(true);
    expect(beatsGhost({ weight: 82.5, reps: 5 }, { weight: 80, reps: 8 })).toBe(true);
  });

  it("parses rep ranges and uses a conservative fallback", () => {
    expect(minTargetReps("8-12")).toBe(8);
    expect(minTargetReps("AMRAP")).toBe(5);
  });
});
