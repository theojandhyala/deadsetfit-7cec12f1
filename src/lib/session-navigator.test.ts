import { describe, expect, it } from "vitest";
import {
  formatSessionClock,
  nextUnfinishedExercise,
  sessionElapsedSeconds,
  sessionNavigator,
} from "./session-navigator";
import type { CompletedSet, WorkoutSessionExercise } from "./types";

const set = (patch: Partial<CompletedSet> = {}): CompletedSet => ({
  weight: 50,
  reps: 8,
  ...patch,
});
const exercise = (targetSets = 3, sets: CompletedSet[] = []): WorkoutSessionExercise => ({
  exerciseId: "bench",
  name: "Bench Press",
  primary_muscles: ["CHEST"],
  targetSets,
  targetReps: "8",
  sets,
});
describe("session navigator", () => {
  it("handles an empty workout", () => {
    expect(sessionNavigator([])).toEqual({
      rows: [],
      completed: 0,
      planned: 0,
      remaining: 0,
      finishedExercises: 0,
    });
  });
  it("shows untouched plans without writing sets", () => {
    const e = exercise();
    expect(sessionNavigator([e])).toMatchObject({
      completed: 0,
      planned: 3,
      remaining: 3,
      finishedExercises: 0,
    });
    expect(e.sets).toHaveLength(0);
  });
  it("counts genuine working sets, not warmups or drops", () => {
    expect(
      sessionNavigator([
        exercise(3, [
          set({ kind: "warmup" }),
          set({ kind: "drop" }),
          set({ kind: "failure" }),
          set(),
        ]),
      ]),
    ).toMatchObject({ completed: 2, planned: 3, remaining: 1 });
  });
  it("counts timed and distance sets without inventing reps", () => {
    const exercises = [
      exercise(2, [
        set({ mode: "duration", reps: 0, seconds: 45 }),
        set({ mode: "distance", reps: 0, meters: 100 }),
      ]),
    ];
    expect(sessionNavigator(exercises)).toMatchObject({
      completed: 2,
      remaining: 0,
      finishedExercises: 1,
    });
    expect(exercises[0].sets.every((s) => s.reps === 0)).toBe(true);
  });
  it("retains extra sets without exceeding the displayed denominator", () => {
    expect(sessionNavigator([exercise(1, [set(), set(), set()])])).toMatchObject({
      completed: 3,
      planned: 3,
      remaining: 0,
    });
  });
  it("does not call an empty zero-target exercise complete", () => {
    expect(sessionNavigator([exercise(0)]).rows[0].done).toBe(false);
  });
  it.each([NaN, Infinity, -3])("contains invalid target %s", (target) => {
    expect(sessionNavigator([exercise(target)])).toMatchObject({ planned: 0, remaining: 0 });
  });
  it("floors fractional targets", () => {
    expect(sessionNavigator([exercise(2.5)]).planned).toBe(2);
  });
  it("preserves duplicate slots and superset indicators", () => {
    const a = { ...exercise(), supersetId: "a" };
    const before = JSON.stringify(a);
    const summary = sessionNavigator([a, a]);
    expect(summary.rows.map((r) => r.index)).toEqual([0, 1]);
    expect(summary.rows.every((r) => r.superset)).toBe(true);
    expect(JSON.stringify(a)).toBe(before);
  });
  it("updates completion correctly after undo", () => {
    const e = exercise(1, [set()]);
    expect(sessionNavigator([e]).finishedExercises).toBe(1);
    expect(sessionNavigator([{ ...e, sets: [] }]).finishedExercises).toBe(0);
  });
});
describe("next unfinished exercise", () => {
  it("skips completed movements", () => {
    expect(nextUnfinishedExercise([exercise(), exercise(1, [set()]), exercise()], 0)).toBe(2);
  });
  it("wraps to an earlier movement", () => {
    expect(nextUnfinishedExercise([exercise(), exercise(1, [set()])], 1)).toBe(0);
  });
  it("keeps the active movement if it is the only unfinished one", () => {
    expect(nextUnfinishedExercise([exercise(), exercise(1, [set()])], 0)).toBe(0);
  });
  it("returns null after all targets are met", () => {
    expect(nextUnfinishedExercise([exercise(1, [set()])], 0)).toBeNull();
  });
  it("handles empty workouts", () => {
    expect(nextUnfinishedExercise([], 9)).toBeNull();
  });
  it.each([-1, 20, NaN, 1.5])("handles stale active index %s", (index) => {
    expect(nextUnfinishedExercise([exercise(), exercise()], index)).toBe(0);
  });
});
describe("isolated session clock", () => {
  const start = "2026-09-12T12:00:00Z";
  it("includes time while the app was suspended", () => {
    expect(sessionElapsedSeconds(start, Date.parse(start) + 3_605_990)).toBe(3605);
  });
  it("contains malformed and future starts", () => {
    expect(sessionElapsedSeconds("invalid")).toBe(0);
    expect(sessionElapsedSeconds(start, Date.parse(start) - 10)).toBe(0);
  });
  it("contains invalid current time", () => {
    expect(sessionElapsedSeconds(start, NaN)).toBe(0);
  });
  it.each([
    [0, "0:00"],
    [65, "1:05"],
    [3605, "1:00:05"],
    [NaN, "0:00"],
    [-20, "0:00"],
  ])("formats %s as %s", (seconds, expected) => {
    expect(formatSessionClock(Number(seconds))).toBe(expected);
  });
});
