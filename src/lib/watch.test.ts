import { describe, expect, it } from "vitest";

import { projectSession } from "./watch";
import type { AppState, WorkoutSession, WorkoutSessionExercise } from "./types";

const state: Pick<AppState, "savedExercises" | "restTimerSeconds"> = {
  savedExercises: [],
  restTimerSeconds: 90,
};

function session(exercises: WorkoutSessionExercise[], overrides: Partial<WorkoutSession> = {}) {
  return {
    id: "session-1",
    date: "2026-08-27",
    dayKey: "MON",
    label: "PUSH",
    programId: null,
    startedAt: "2026-08-27T10:00:00.000Z",
    exercises,
    totalVolume: 0,
    prCount: 0,
    ...overrides,
  } as WorkoutSession;
}

const bench: WorkoutSessionExercise = {
  exerciseId: "bench-press",
  name: "Bench Press",
  primary_muscles: ["CHEST"],
  targetSets: 4,
  targetReps: "6-8",
  plannedWeightKg: 80,
  sets: [],
};

describe("projectSession", () => {
  it("publishes an idle state when there is no session", () => {
    expect(projectSession(state, null)).toEqual({ sessionId: null, label: "", exercises: [] });
  });

  it("publishes an idle state once the session has finished", () => {
    const finished = session([bench], { endedAt: "2026-08-27T11:00:00.000Z" });
    expect(projectSession(state, finished).sessionId).toBeNull();
  });

  it("carries the plan the watch needs to log with one tap", () => {
    const [exercise] = projectSession(state, session([bench])).exercises;
    expect(exercise).toMatchObject({
      id: "bench-press",
      name: "Bench Press",
      targetSets: 4,
      targetReps: "6-8",
      weight: 80,
      tracking: "WEIGHT",
      restSeconds: 90,
    });
  });

  it("falls back to the last working set when the plan has no weight", () => {
    const performed: WorkoutSessionExercise = {
      ...bench,
      plannedWeightKg: undefined,
      sets: [
        { weight: 60, reps: 8 },
        { weight: 70, reps: 6 },
      ],
    };
    expect(projectSession(state, session([performed])).exercises[0]!.weight).toBe(70);
  });

  it("ignores warm-ups and holds when picking that fallback weight", () => {
    const performed: WorkoutSessionExercise = {
      ...bench,
      plannedWeightKg: undefined,
      sets: [
        { weight: 60, reps: 8 },
        { weight: 40, reps: 10, kind: "warmup" },
        { weight: 20, reps: 0, mode: "duration", seconds: 45 },
      ],
    };
    expect(projectSession(state, session([performed])).exercises[0]!.weight).toBe(60);
  });

  it("uses the exercise's own rest when it has one", () => {
    const custom: WorkoutSessionExercise = { ...bench, restSeconds: 180 };
    expect(projectSession(state, session([custom])).exercises[0]!.restSeconds).toBe(180);
  });

  it("respects a rest setting of zero rather than treating it as unset", () => {
    const noRest: WorkoutSessionExercise = { ...bench, restSeconds: 0 };
    expect(projectSession(state, session([noRest])).exercises[0]!.restSeconds).toBe(0);
  });

  it("carries timed movements across with their target", () => {
    const plank: WorkoutSessionExercise = {
      exerciseId: "plank",
      name: "Plank",
      primary_muscles: ["CORE"],
      targetSets: 3,
      targetReps: "45-60s",
      tracking: "DURATION",
      targetSeconds: 60,
      sets: [{ weight: 0, reps: 0, mode: "duration", seconds: 55 }],
    };
    const [exercise] = projectSession(state, session([plank])).exercises;
    expect(exercise).toMatchObject({ tracking: "DURATION", targetSeconds: 60 });
    expect(exercise!.sets[0]).toMatchObject({ mode: "duration", seconds: 55, isPR: false });
  });

  it("infers tracking for a session built before the field existed", () => {
    const legacy: WorkoutSessionExercise = {
      exerciseId: "plank",
      name: "Plank",
      primary_muscles: ["CORE"],
      targetSets: 3,
      targetReps: "45-60s",
      sets: [],
    };
    expect(projectSession(state, session([legacy])).exercises[0]!.tracking).toBe("DURATION");
  });

  it("marks personal records so the watch can show the flame", () => {
    const withPR: WorkoutSessionExercise = {
      ...bench,
      sets: [{ weight: 100, reps: 5, isPR: true }],
    };
    expect(projectSession(state, session([withPR])).exercises[0]!.sets[0]!.isPR).toBe(true);
  });

  it("defaults rest to the app preference when neither is set", () => {
    const noPref = { savedExercises: [], restTimerSeconds: undefined };
    expect(projectSession(noPref, session([bench])).exercises[0]!.restSeconds).toBe(90);
  });

  it("carries the bar so the wrist can show plates per side", () => {
    const trap: WorkoutSessionExercise = { ...bench, barKg: 25 };
    expect(projectSession(state, session([trap])).exercises[0]!.barKg).toBe(25);
  });

  it("defaults the bar to Olympic when the movement has none set", () => {
    expect(projectSession(state, session([bench])).exercises[0]!.barKg).toBe(20);
  });

  it("sends last session's sets so the target is on the wrist", () => {
    const previous = session([{ ...bench, sets: [{ weight: 75, reps: 8 }] }], {
      id: "older",
      date: "2026-08-20",
      endedAt: "2026-08-20T11:00:00.000Z",
    });
    const live = session([bench]);
    const projected = projectSession({ ...state, sessions: [previous, live] }, live);
    expect(projected.exercises[0]!.ghost).toEqual([{ weight: 75, reps: 8, isPR: false }]);
  });

  it("never sends the live session back as its own ghost", () => {
    const live = session([{ ...bench, sets: [{ weight: 80, reps: 5 }] }]);
    const projected = projectSession({ ...state, sessions: [live] }, live);
    expect(projected.exercises[0]!.ghost).toEqual([]);
  });

  it("ignores unfinished sessions when looking for the ghost", () => {
    const abandoned = session([{ ...bench, sets: [{ weight: 999, reps: 1 }] }], {
      id: "abandoned",
      endedAt: undefined,
    });
    const live = session([bench]);
    const projected = projectSession({ ...state, sessions: [abandoned, live] }, live);
    expect(projected.exercises[0]!.ghost).toEqual([]);
  });
});
