import { describe, it, expect } from "vitest";

import { sessionRecords } from "./session-records";
import type { WorkoutSession } from "./types";

function session(
  id: string,
  date: string,
  reps: number[],
  weight = 100,
  hours = 1,
): WorkoutSession {
  return {
    id,
    date,
    dayKey: "MON",
    label: `Day ${id}`,
    programId: null,
    startedAt: `${date}T10:00:00Z`,
    endedAt: `${date}T${String(10 + hours).padStart(2, "0")}:00:00Z`,
    totalVolume: 0,
    prCount: 0,
    exercises: [
      {
        exerciseId: "e1",
        name: "Lift",
        primary_muscles: [],
        targetSets: reps.length,
        targetReps: "8",
        sets: reps.map((r) => ({ weight, reps: r })),
      },
    ],
  } as WorkoutSession;
}

describe("sessionRecords", () => {
  it("returns null with no finished sessions", () => {
    expect(sessionRecords([])).toBeNull();
  });

  it("finds heaviest, most reps and longest across sessions", () => {
    const a = session("a", "2026-07-01", [8, 8, 8]); // 2400 kg, 24 reps, 1h
    const b = session("b", "2026-07-03", [10, 10, 10, 10], 50, 2); // 2000 kg, 40 reps, 2h
    const r = sessionRecords([a, b])!;
    expect(r.heaviest).toMatchObject({ volumeKg: 2400, date: "2026-07-01" });
    expect(r.mostReps).toMatchObject({ reps: 40, date: "2026-07-03" });
    expect(r.longest).toMatchObject({ minutes: 120, date: "2026-07-03" });
  });

  it("flags which records the latest session just broke", () => {
    const a = session("a", "2026-07-01", [8, 8, 8]); // 2400 kg
    const b = session("b", "2026-07-05", [12, 12, 12]); // 3600 kg, 36 reps — breaks volume+reps
    const r = sessionRecords([a, b])!;
    expect(r.latestBroke).toEqual(["VOLUME", "REPS"]);
    expect(r.latestDate).toBe("2026-07-05");
  });

  it("a single session breaks every record it sets", () => {
    const r = sessionRecords([session("a", "2026-07-01", [8])])!;
    expect(r.latestBroke).toEqual(["VOLUME", "REPS", "DURATION"]);
  });

  it("ignores warm-up sets in tonnage", () => {
    const s = session("a", "2026-07-01", [8]);
    s.exercises[0].sets.unshift({ weight: 60, reps: 10, kind: "warmup" });
    const r = sessionRecords([s])!;
    expect(r.heaviest!.volumeKg).toBe(800);
    expect(r.mostReps!.reps).toBe(8);
  });
});
