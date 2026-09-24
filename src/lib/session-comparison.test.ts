import { describe, expect, it } from "vitest";
import { comparablePreviousVolume, compareSessionLifts } from "./session-comparison";
import type { CompletedSet, WorkoutSession } from "./types";

function session(id: string, day: number, sets: CompletedSet[]): WorkoutSession {
  const date = `2026-09-${day}`;
  return {
    id,
    date,
    dayKey: "MON",
    label: "Upper",
    programId: null,
    startedAt: `${date}T10:00:00Z`,
    endedAt: `${date}T11:00:00Z`,
    totalVolume: 0,
    prCount: 0,
    exercises: [
      {
        exerciseId: "press",
        name: "Press",
        primary_muscles: ["CHEST"],
        targetSets: 3,
        targetReps: "8-10",
        sets,
      },
    ],
  };
}
const lift = (weight = 60, reps = 8): CompletedSet => ({ weight, reps });

describe("session lift comparison", () => {
  it("uses the nearest earlier valid session, not an all-time best or a future record", () => {
    const current = session("now", 24, [lift(60, 10)]);
    const rows = compareSessionLifts(current, [
      session("future", 25, [lift(100)]),
      session("old", 20, [lift(90)]),
      session("previous", 23, [lift()]),
      current,
    ]);
    expect(rows[0]).toMatchObject({
      previousDate: "2026-09-23",
      previous: lift(),
      status: "improved",
    });
  });
  it("does not call a heavier lower-rep set an automatic improvement", () => {
    expect(
      compareSessionLifts(session("now", 24, [lift(80, 1)]), [
        session("old", 23, [lift(60, 10)]),
      ])[0]?.status,
    ).toBe("different");
  });
  it("labels equal efforts and first-session baselines without fabricating a delta", () => {
    const now = session("now", 24, [lift()]);
    expect(compareSessionLifts(now, [session("previous", 23, [lift()])])[0]?.status).toBe(
      "matched",
    );
    expect(compareSessionLifts(now, [])[0]).toMatchObject({
      status: "baseline",
      previous: undefined,
    });
  });
  it("combines duplicate occurrences and ignores warmups, drops and malformed sets", () => {
    const now = session("now", 24, [
      lift(200),
      { ...lift(300), kind: "warmup" },
      { ...lift(400), kind: "drop" },
      lift(NaN),
      lift(-1),
      lift(30, 2.5),
    ]);
    now.exercises.push({ ...now.exercises[0]!, sets: [{ ...lift(205), kind: "failure" }] });
    const before = JSON.stringify(now);
    expect(compareSessionLifts(now, [])).toHaveLength(1);
    expect(compareSessionLifts(now, [])[0]?.set.weight).toBe(205);
    expect(JSON.stringify(now)).toBe(before);
  });
  it("keeps duration and distance separate from weight records", () => {
    const before = session("previous", 23, [
      { weight: 0, reps: 0, mode: "duration", seconds: 45 },
      { weight: 0, reps: 0, mode: "distance", meters: 1000 },
    ]);
    const now = session("now", 24, [
      { weight: 0, reps: 0, mode: "duration", seconds: 60 },
      { weight: 0, reps: 0, mode: "distance", meters: 1200 },
    ]);
    expect(compareSessionLifts(now, [before]).map((row) => row.status)).toEqual([
      "improved",
      "improved",
    ]);
    expect(compareSessionLifts(now, [before]).every((row) => row.set.reps === 0)).toBe(true);
  });
  it("does not treat a longer hold with a lighter load as the same effort", () => {
    const now = session("now", 24, [{ weight: 5, reps: 0, mode: "duration", seconds: 60 }]);
    const before = session("previous", 23, [
      { weight: 10, reps: 0, mode: "duration", seconds: 45 },
    ]);
    expect(compareSessionLifts(now, [before])[0]?.status).toBe("different");
  });
  it("rejects unfinished, overlapping and invalid histories and invalid current sessions", () => {
    const now = session("now", 24, [lift()]);
    const previous = session("previous", 23, [lift()]);
    const history = [
      { ...previous, endedAt: undefined },
      { ...previous, endedAt: "2026-09-24T12:00:00Z" },
      { ...previous, startedAt: "bad" },
    ];
    expect(compareSessionLifts(now, history)[0]?.status).toBe("baseline");
    expect(compareSessionLifts({ ...now, startedAt: "bad" }, [])).toEqual([]);
    expect(compareSessionLifts({ ...now, endedAt: undefined }, [])).toEqual([]);
  });
  it("compares bodyweight reps without inventing lifted weight", () => {
    expect(
      compareSessionLifts(session("now", 24, [lift(0, 12)]), [
        session("previous", 23, [lift(0, 10)]),
      ])[0]?.status,
    ).toBe("improved");
  });
});

describe("comparable live workout pacing", () => {
  it("requires matching prescription and includes drop-set tonnage consistently", () => {
    const now = session("now", 24, []);
    const previous = session("previous", 23, [
      lift(60, 10),
      { ...lift(40, 10), kind: "drop" },
      { ...lift(20, 10), kind: "warmup" },
    ]);
    expect(comparablePreviousVolume(now, [previous])?.volume).toBe(1000);
    expect(
      comparablePreviousVolume(now, [
        { ...previous, exercises: [{ ...previous.exercises[0]!, targetSets: 5 }] },
      ]),
    ).toBeNull();
    expect(
      comparablePreviousVolume(now, [
        { ...previous, exercises: [{ ...previous.exercises[0]!, exerciseId: "other" }] },
      ]),
    ).toBeNull();
    expect(comparablePreviousVolume(now, [session("future", 25, [lift()])])).toBeNull();
  });
});
