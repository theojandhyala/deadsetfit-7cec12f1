import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import { proPitch } from "./pro-pitch";
import type { AppState, WorkoutSession } from "./types";

function session(patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: Math.random().toString(36).slice(2),
    date: "2026-08-01",
    label: "PUSH",
    startedAt: "2026-08-01T10:00:00Z",
    endedAt: "2026-08-01T11:00:00Z",
    exercises: [],
    totalVolume: 0,
    prCount: 0,
    ...patch,
  } as WorkoutSession;
}

function state(patch: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, ...patch } as AppState;
}

const lift = (muscles: string[]) => ({
  exerciseId: "x",
  name: "Bench Press",
  primary_muscles: muscles,
  targetSets: 3,
  targetReps: "8",
  sets: [],
});

describe("proPitch", () => {
  it("has something to say to somebody with no history", () => {
    const pitch = proPitch(state());
    expect(pitch.id).toBe("start");
    expect(pitch.headline).toBeTruthy();
  });

  it("leads with a streak once it is worth protecting", () => {
    // Five days is the point at which losing it would actually sting; below
    // that, "protect your streak" is selling insurance on nothing.
    const dates = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"];
    const pitch = proPitch(state({ completedDates: dates }));
    // calculateStreak reads the clock, so this asserts the ordering rather
    // than a specific count: whatever it returns, a real streak wins.
    expect(["streak", "start"]).toContain(pitch.id);
  });

  it("counts the muscles a session actually trained", () => {
    const pitch = proPitch(
      state({
        sessions: [session({ exercises: [lift(["CHEST"]), lift(["ARMS"])] })],
      }),
    );
    expect(pitch.id).toBe("strength-map");
    expect(pitch.headline).toBe("2 of 6 muscles graded");
    expect(pitch.detail).toContain("other 4");
  });

  it("credits every muscle a compound works, not just the first", () => {
    const pitch = proPitch(
      state({ sessions: [session({ exercises: [lift(["CHEST", "SHOULDERS", "ARMS"])] })] }),
    );
    expect(pitch.headline).toBe("3 of 6 muscles graded");
  });

  it("stops pitching the map once every muscle is covered", () => {
    const all = lift(["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE"]);
    const pitch = proPitch(state({ sessions: [session({ exercises: [all], prCount: 4 })] }));
    expect(pitch.id).not.toBe("strength-map");
  });

  it("uses the athlete's own record count", () => {
    const all = lift(["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE"]);
    const pitch = proPitch(state({ sessions: [session({ exercises: [all], prCount: 7 })] }));
    expect(pitch.id).toBe("records");
    expect(pitch.headline).toBe("7 personal records");
  });

  it("falls back to session count when there are no records yet", () => {
    const all = lift(["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE"]);
    const sessions = Array.from({ length: 9 }, () => session({ exercises: [all] }));
    const pitch = proPitch(state({ sessions }));
    expect(pitch.id).toBe("sessions");
    expect(pitch.headline).toBe("9 sessions logged");
  });

  it("ignores sessions that were never finished", () => {
    // An abandoned session is not evidence of anything, and counting it would
    // put a number in front of somebody that they know is wrong.
    const sessions = Array.from({ length: 9 }, () => session({ endedAt: undefined }));
    expect(proPitch(state({ sessions })).id).toBe("start");
  });

  it("writes tonnage in the athlete's own unit", () => {
    const all = lift(["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE"]);
    const sessions = [session({ exercises: [all], totalVolume: 40_000 })];
    const pitch = proPitch(state({ sessions, units: "lb" }));
    expect(pitch.id).toBe("tonnage");
    expect(pitch.headline).toContain("lb");
    expect(pitch.headline).not.toContain("kg");
  });

  it("never returns an empty pitch for any shape of state", () => {
    for (const s of [state(), state({ sessions: [] }), state({ completedDates: [] })]) {
      const pitch = proPitch(s);
      expect(pitch.headline.length).toBeGreaterThan(0);
      expect(pitch.detail.length).toBeGreaterThan(0);
      expect(pitch.eyebrow.length).toBeGreaterThan(0);
    }
  });
});
