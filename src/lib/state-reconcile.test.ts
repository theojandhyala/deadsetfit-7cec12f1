import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import { mergeAppStates } from "./state-reconcile";
import type { AppState, WorkoutSession } from "./types";

function state(overrides: Partial<AppState>): AppState {
  return { ...DEFAULT_STATE, ...overrides };
}

function session(id: string, setCount: number, endedAt?: string): WorkoutSession {
  return {
    id,
    date: "2026-09-06",
    dayKey: "MON",
    label: "Push",
    programId: null,
    startedAt: "2026-09-06T10:00:00.000Z",
    ...(endedAt ? { endedAt } : {}),
    exercises: [
      {
        exerciseId: "bench-press",
        name: "Bench Press",
        primary_muscles: ["chest"],
        targetSets: 3,
        targetReps: "5",
        sets: Array.from({ length: setCount }, () => ({ weight: 100, reps: 5 })),
      },
    ],
    totalVolume: setCount * 500,
    prCount: 0,
  };
}

describe("mergeAppStates", () => {
  it("keeps sessions created independently on two devices", () => {
    const merged = mergeAppStates(
      state({ sessions: [session("local", 3)] }),
      state({ sessions: [session("remote", 2)] }),
    );
    expect(merged.sessions.map((item) => item.id).sort()).toEqual(["local", "remote"]);
  });

  it("never replaces a more complete session with a stale copy", () => {
    const merged = mergeAppStates(
      state({ sessions: [session("same", 3, "2026-09-06T11:00:00.000Z")] }),
      state({ sessions: [session("same", 1)] }),
    );
    expect(merged.sessions[0].endedAt).toBeTruthy();
    expect(merged.sessions[0].exercises[0].sets).toHaveLength(3);
  });

  it("preserves repeated identical sets instead of deduplicating a real workout", () => {
    const merged = mergeAppStates(
      state({ sessions: [session("same", 3)] }),
      state({ sessions: [session("same", 2)] }),
    );
    expect(merged.sessions[0].exercises[0].sets).toHaveLength(3);
  });

  it("unions append-only progress while taking settings from the newest snapshot", () => {
    const local = state({
      completedDates: ["2026-09-05"],
      waterTargetMl: 3500,
      syncMeta: { revision: 3, updatedAt: "2026-09-06T12:00:00.000Z", deviceId: "a" },
    });
    const remote = state({
      completedDates: ["2026-09-04"],
      waterTargetMl: 2500,
      syncMeta: { revision: 9, updatedAt: "2026-09-06T11:00:00.000Z", deviceId: "b" },
    });
    const merged = mergeAppStates(local, remote);
    expect(merged.completedDates).toEqual(["2026-09-04", "2026-09-05"]);
    expect(merged.waterTargetMl).toBe(3500);
  });
});
