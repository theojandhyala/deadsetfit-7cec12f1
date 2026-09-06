import { describe, expect, it } from "vitest";

import { projectActivity } from "./workout-activity";
import type { WorkoutSession, WorkoutSessionExercise } from "./types";

const bench: WorkoutSessionExercise = {
  exerciseId: "bench-press",
  name: "Bench Press",
  primary_muscles: ["CHEST"],
  targetSets: 3,
  targetReps: "6-8",
  sets: [],
};

function session(exercises: WorkoutSessionExercise[]): WorkoutSession {
  return {
    id: "s1",
    date: "2026-08-27",
    dayKey: "MON",
    label: "PUSH",
    programId: null,
    startedAt: "2026-08-27T10:00:00.000Z",
    exercises,
    totalVolume: 0,
    prCount: 0,
  };
}

describe("projectActivity", () => {
  it("counts working sets against the plan", () => {
    const state = projectActivity(
      session([
        {
          ...bench,
          sets: [
            { weight: 60, reps: 8 },
            { weight: 60, reps: 8 },
          ],
        },
        { ...bench, exerciseId: "ohp", name: "Overhead Press", targetSets: 3 },
      ]),
      0,
    );
    expect(state.setsDone).toBe(2);
    expect(state.setsPlanned).toBe(6);
  });

  it("excludes warm-ups and drops from the working count", () => {
    const state = projectActivity(
      session([
        {
          ...bench,
          sets: [
            { weight: 40, reps: 10, kind: "warmup" },
            { weight: 60, reps: 8 },
            { weight: 45, reps: 8, kind: "drop" },
          ],
        },
      ]),
      0,
    );
    expect(state.setsDone).toBe(1);
  });

  it("counts a set to failure as a working set", () => {
    const state = projectActivity(
      session([{ ...bench, sets: [{ weight: 60, reps: 8, kind: "failure" }] }]),
      0,
    );
    expect(state.setsDone).toBe(1);
  });

  it("never shows more sets done than planned", () => {
    const state = projectActivity(
      session([
        {
          ...bench,
          targetSets: 2,
          sets: [
            { weight: 60, reps: 8 },
            { weight: 60, reps: 8 },
            { weight: 60, reps: 8 },
          ],
        },
      ]),
      0,
    );
    expect(state.setsDone).toBe(3);
    expect(state.setsPlanned).toBe(3);
  });

  it("keeps holds out of tonnage", () => {
    const state = projectActivity(
      session([
        {
          ...bench,
          sets: [
            { weight: 60, reps: 10 },
            { weight: 20, reps: 0, mode: "duration", seconds: 60 },
          ],
        },
      ]),
      0,
    );
    expect(state.volumeKg).toBe(600);
  });

  it("names the movement you are actually on", () => {
    const state = projectActivity(
      session([bench, { ...bench, exerciseId: "ohp", name: "Overhead Press" }]),
      1,
    );
    expect(state.exerciseName).toBe("Overhead Press");
  });

  it("falls back to the first movement if the index is out of range", () => {
    expect(projectActivity(session([bench]), 9).exerciseName).toBe("Bench Press");
  });

  it("surfaces records", () => {
    const state = projectActivity(
      session([{ ...bench, sets: [{ weight: 100, reps: 5, isPR: true }] }]),
      0,
    );
    expect(state.prCount).toBe(1);
  });

  it("sends the start time as epoch milliseconds", () => {
    expect(projectActivity(session([bench]), 0).startedAtMs).toBe(
      Date.parse("2026-08-27T10:00:00.000Z"),
    );
  });

  it("does not send NaN when the start time is unparseable", () => {
    const broken = { ...session([bench]), startedAt: "nonsense" };
    expect(Number.isFinite(projectActivity(broken, 0).startedAtMs)).toBe(true);
  });
});
