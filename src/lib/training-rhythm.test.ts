import { describe, it, expect } from "vitest";

import { trainingRhythm } from "./training-rhythm";
import type { WorkoutSession } from "./types";

const TODAY = "2026-07-31"; // a Friday

function session(date: string, weight: number): WorkoutSession {
  return {
    id: date,
    date,
    dayKey: "MON",
    label: "Day",
    programId: null,
    startedAt: `${date}T10:00:00Z`,
    endedAt: `${date}T11:00:00Z`,
    totalVolume: 0,
    prCount: 0,
    exercises: [
      {
        exerciseId: "e1",
        name: "Lift",
        primary_muscles: [],
        targetSets: 3,
        targetReps: "8",
        sets: [{ weight, reps: 10 }],
      },
    ],
  } as WorkoutSession;
}

// Mondays in the 12-week window before TODAY.
const MONDAYS = ["2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"];
const WEDNESDAYS = ["2026-07-08", "2026-07-15", "2026-07-22", "2026-07-29"];

describe("trainingRhythm", () => {
  it("returns null under 8 sessions", () => {
    expect(trainingRhythm([session("2026-07-27", 100)], [], undefined, TODAY)).toBeNull();
  });

  it("finds the strongest day by average volume", () => {
    const sessions = [
      ...MONDAYS.map((d) => session(d, 200)), // 2000 kg avg on Mondays
      ...WEDNESDAYS.map((d) => session(d, 50)), // 500 kg avg on Wednesdays
    ];
    const r = trainingRhythm(
      sessions,
      sessions.map((s) => s.date),
      undefined,
      TODAY,
    )!;
    expect(r.strongestDay).toBe("MON");
    expect(r.days.find((d) => d.day === "MON")!.avgVolumeKg).toBe(2000);
    expect(r.advice).toContain("Mondays");
  });

  it("calls out a scheduled day that keeps getting skipped", () => {
    // Trains every Monday and Wednesday, but Friday is scheduled and never done.
    const sessions = [...MONDAYS, ...WEDNESDAYS].map((d) => session(d, 100));
    const r = trainingRhythm(
      sessions,
      sessions.map((s) => s.date),
      ["MON", "WED", "FRI"],
      TODAY,
    )!;
    expect(r.mostSkippedDay).toBe("FRI");
    const fri = r.days.find((d) => d.day === "FRI")!;
    expect(fri.scheduled).toBe(true);
    expect(fri.completionRate).toBe(0);
    expect(r.days.find((d) => d.day === "MON")!.completionRate).toBeGreaterThan(0);
    expect(r.advice).toContain("Fridays");
  });

  it("never flags unscheduled days as skipped", () => {
    const sessions = [...MONDAYS, ...WEDNESDAYS].map((d) => session(d, 100));
    const r = trainingRhythm(
      sessions,
      sessions.map((s) => s.date),
      ["MON", "WED"],
      TODAY,
    )!;
    expect(r.mostSkippedDay).toBeNull();
    expect(r.days.find((d) => d.day === "SAT")!.completionRate).toBeNull();
  });
});
