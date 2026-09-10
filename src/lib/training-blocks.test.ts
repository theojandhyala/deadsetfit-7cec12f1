import { describe, it, expect } from "vitest";
import { compareTrainingBlocks } from "./training-blocks";
import { DEFAULT_STATE } from "./default-state";
import type { WorkoutSession, CompletedSet, AppState } from "./types";
const lib = [{ id: "bench", name: "Bench press", muscleGroup: "CHEST" as const }];
function session(
  id: string,
  date: string,
  sets: CompletedSet[] = [{ weight: 60, reps: 5 }],
  exerciseId = "bench",
): WorkoutSession {
  return {
    id,
    date,
    label: "Training",
    dayKey: "MON",
    programId: null,
    startedAt: date + "T10:00:00Z",
    endedAt: date + "T11:00:00Z",
    totalVolume: 99999,
    prCount: 9,
    exercises: [
      { exerciseId, name: exerciseId, primary_muscles: [], targetSets: 3, targetReps: "5", sets },
    ],
  };
}
const state = (sessions: WorkoutSession[]): AppState => ({ ...DEFAULT_STATE, sessions });
describe("training block comparison", () => {
  it("handles empty data without inventing progress", () => {
    const r = compareTrainingBlocks(state([]), lib, "2026-09-10", 28);
    expect(r.current).toMatchObject({ start: "2026-08-14", end: "2026-09-10", sessions: 0 });
    expect(r.previous).toMatchObject({ start: "2026-07-17", end: "2026-08-13", sessions: 0 });
    expect(r.changes).toEqual([]);
    expect(r.comparable).toBe(0);
  });
  it.each([7, 28, 84] as const)("uses exact inclusive %s-day boundaries", (days) => {
    const end = Date.parse("2026-09-10T00:00:00Z");
    const date = (age: number) => new Date(end - age * 86400000).toISOString().slice(0, 10);
    const r = compareTrainingBlocks(
      state([
        session("a", date(0)),
        session("b", date(days - 1)),
        session("c", date(days)),
        session("d", date(days * 2 - 1)),
        session("e", date(days * 2)),
      ]),
      lib,
      "2026-09-10",
      days,
    );
    expect(r.current.sessions).toBe(2);
    expect(r.previous.sessions).toBe(2);
  });
  it("uses calendar days across daylight saving and leap day", () => {
    const dst = compareTrainingBlocks(state([session("a", "2026-03-29")]), lib, "2026-03-30", 7);
    expect(dst.current.trainingDays).toBe(1);
    expect(dst.current.start).toBe("2026-03-24");
    expect(compareTrainingBlocks(state([]), lib, "2028-03-01", 7).current.start).toBe("2028-02-24");
  });
  it("rejects malformed dates and unsupported periods", () => {
    expect(() => compareTrainingBlocks(state([]), lib, "bad", 7)).toThrow();
    expect(() => compareTrainingBlocks(state([]), lib, "2026-02-30", 7)).toThrow();
    expect(() => compareTrainingBlocks(state([]), lib, "2026-09-10", 3 as 7)).toThrow();
  });
  it("excludes unfinished, empty, invalid and future workouts", () => {
    const unfinished = session("a", "2026-09-10");
    unfinished.endedAt = undefined;
    const r = compareTrainingBlocks(
      state([
        unfinished,
        session("b", "2026-09-11"),
        session("c", "2026-02-30"),
        session("d", "2026-09-10", []),
        session("e", "bad"),
      ]),
      lib,
      "2026-09-10",
      28,
    );
    expect(r.current.sessions).toBe(0);
    expect(r.changes).toHaveLength(0);
  });
  it("counts repeated sessions once but genuine same-day sessions separately", () => {
    const a = session("a", "2026-09-10"),
      b = session("b", "2026-09-10");
    const r = compareTrainingBlocks(state([a, a, b]), lib, "2026-09-10", 7);
    expect(r.current).toMatchObject({
      sessions: 2,
      trainingDays: 1,
      workingSets: 2,
      volumeKg: 600,
      exercises: 1,
    });
  });
  it("excludes warmups and drops, includes failure and real repeated sets", () => {
    const sets: CompletedSet[] = [
      { weight: 90, reps: 10, kind: "warmup" },
      { weight: 80, reps: 10, kind: "drop" },
      { weight: 60, reps: 5, kind: "failure" },
      { weight: 60, reps: 5 },
    ];
    expect(
      compareTrainingBlocks(state([session("a", "2026-09-10", sets)]), lib, "2026-09-10", 7)
        .current,
    ).toMatchObject({ workingSets: 2, volumeKg: 600 });
  });
  it("separates duration, distance, bodyweight and load without corrupting volume", () => {
    const sets: CompletedSet[] = [
      { weight: 60, reps: 5 },
      { weight: 0, reps: 20 },
      { weight: 0, reps: 0, mode: "duration", seconds: 60 },
      { weight: 0, reps: 0, mode: "distance", meters: 2000, seconds: 600 },
    ];
    const r = compareTrainingBlocks(
      state([session("a", "2026-09-10", sets)]),
      lib,
      "2026-09-10",
      7,
    );
    expect(r.current).toMatchObject({
      workingSets: 4,
      volumeKg: 300,
      holdSeconds: 60,
      distanceMeters: 2000,
    });
    expect(new Set(r.changes.map((c) => c.metric))).toEqual(
      new Set(["LOAD", "REPS", "HOLD", "DISTANCE"]),
    );
  });
  it("never uses summary totals, check-ins or mirrored logs", () => {
    const s = state([session("a", "2026-09-10")]);
    s.manualPRs = { bench: { value: 999, reps: 5, date: "2026-09-10" } };
    s.logs = [{ exerciseId: "bench", date: "2026-09-10", weight: 999, reps: 5 }];
    expect(compareTrainingBlocks(s, lib, "2026-09-10", 7).current.volumeKg).toBe(300);
  });
  it.each([
    [70, "IMPROVED"],
    [60, "UNCHANGED"],
    [50, "LOWER"],
  ] as const)("classifies %skg against the prior period", (weight, kind) => {
    const r = compareTrainingBlocks(
      state([session("a", "2026-09-10", [{ weight, reps: 5 }]), session("b", "2026-09-01")]),
      lib,
      "2026-09-10",
      7,
    );
    expect(r.changes[0].change).toBe(kind);
    expect(r.comparable).toBe(1);
  });
  it("keeps new and previous-only records distinct from improvements", () => {
    const r = compareTrainingBlocks(
      state([
        session("a", "2026-09-10", undefined, "new"),
        session("b", "2026-09-01", undefined, "old"),
      ]),
      lib,
      "2026-09-10",
      7,
    );
    expect(r.changes.map((c) => c.change)).toEqual(["NEW", "PREVIOUS_ONLY"]);
    expect(r.improved).toBe(0);
  });
  it("uses period bests, not the latest set or lifetime record", () => {
    const r = compareTrainingBlocks(
      state([
        session("old", "2020-01-01", [{ weight: 500, reps: 5 }]),
        session("a", "2026-09-10", [{ weight: 40, reps: 5 }]),
        session("b", "2026-09-09", [{ weight: 100, reps: 5 }]),
        session("c", "2026-09-01"),
      ]),
      lib,
      "2026-09-10",
      7,
    );
    expect(r.changes[0]).toMatchObject({
      current: 117,
      previous: 70,
      currentDays: 2,
      previousDays: 1,
      change: "IMPROVED",
    });
  });
  it("does not merge names across distinct exercise IDs or mutate inputs", () => {
    const s = state([
      session("a", "2026-09-10", undefined, "x"),
      session("b", "2026-09-10", undefined, "y"),
    ]);
    const before = structuredClone(s);
    const library = [
      { id: "x", name: "Same" },
      { id: "y", name: "Same" },
    ];
    expect(compareTrainingBlocks(s, library, "2026-09-10", 7).changes).toHaveLength(2);
    expect(s).toEqual(before);
  });
  it("ignores invalid set numbers and treats no usable sets as no workout", () => {
    const sets = [
      { weight: -1, reps: 5 },
      { weight: NaN, reps: 5 },
      { weight: 60, reps: 0 },
      { weight: 60, reps: 1.5 },
      { weight: 0, reps: 0, mode: "duration" as const, seconds: -5 },
    ];
    expect(
      compareTrainingBlocks(state([session("a", "2026-09-10", sets)]), lib, "2026-09-10", 7).current
        .sessions,
    ).toBe(0);
  });
});
