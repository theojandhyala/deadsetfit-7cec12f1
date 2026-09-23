import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import { mergeWorkoutImport } from "./workout-import-merge";
import type { WorkoutSession } from "./types";

function session(id: string, date: string): WorkoutSession {
  return {
    id,
    date,
    dayKey: "MON",
    label: "Imported",
    programId: null,
    startedAt: `${date}T12:00:00.000Z`,
    endedAt: `${date}T13:00:00.000Z`,
    exercises: [
      {
        exerciseId: "bench",
        name: "Bench Press",
        primary_muscles: ["CHEST"],
        targetSets: 1,
        targetReps: "5",
        sets: [{ weight: 100, reps: 5 }],
      },
    ],
    totalVolume: 500,
    prCount: 0,
  };
}

describe("mergeWorkoutImport", () => {
  it("appends history and completed dates without changing current preferences", () => {
    const current = {
      ...DEFAULT_STATE,
      units: "lb" as const,
      sessions: [session("existing", "2026-09-02")],
      completedDates: ["2026-09-02"],
    };
    const result = mergeWorkoutImport(current, [session("imported", "2026-08-01")]);

    expect(result.state.units).toBe("lb");
    expect(result.state.sessions.map((item) => item.id)).toEqual(["imported", "existing"]);
    expect(result.state.completedDates).toEqual(["2026-08-01", "2026-09-02"]);
    expect(result).toMatchObject({ addedSessions: 1, duplicateSessions: 0, addedSets: 1 });
  });

  it("is idempotent when the same export is selected twice", () => {
    const imported = session("stable", "2026-08-01");
    const current = { ...DEFAULT_STATE, sessions: [imported] };
    const result = mergeWorkoutImport(current, [imported]);

    expect(result.state.sessions).toHaveLength(1);
    expect(result).toMatchObject({ addedSessions: 0, duplicateSessions: 1, addedSets: 0 });
  });
});
