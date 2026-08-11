import { describe, it, expect } from "vitest";

import { throwback } from "./throwback";
import type { WorkoutSession } from "./types";

const TODAY = "2026-07-31";

function session(date: string, name: string, weight: number, reps: number): WorkoutSession {
  return {
    id: `${date}-${name}`,
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
        exerciseId: name,
        name,
        primary_muscles: [],
        targetSets: 1,
        targetReps: "8",
        sets: [{ weight, reps }],
      },
    ],
  } as WorkoutSession;
}

describe("throwback", () => {
  it("returns null without both a past anchor and recent training", () => {
    expect(throwback([], TODAY)).toBeNull();
    expect(throwback([session("2026-07-28", "Bench Press", 100, 8)], TODAY)).toBeNull();
    expect(throwback([session("2026-05-02", "Bench Press", 80, 8)], TODAY)).toBeNull();
  });

  it("compares the same lift 90 days apart", () => {
    // 2026-05-02 is 90 days before 2026-07-31.
    const r = throwback(
      [session("2026-05-02", "Bench Press", 80, 8), session("2026-07-28", "Bench Press", 90, 8)],
      TODAY,
    )!;
    expect(r.exercise).toBe("Bench Press");
    expect(r.daysAgo).toBe(90);
    expect(r.thenE1rm).toBe(101);
    expect(r.nowE1rm).toBe(114);
    expect(r.gainKg).toBe(13);
  });

  it("prefers the year anchor when both exist", () => {
    const r = throwback(
      [
        session("2025-08-01", "Squat", 100, 5), // ~365 days ago
        session("2026-05-02", "Squat", 120, 5), // 90 days ago
        session("2026-07-28", "Squat", 140, 5),
      ],
      TODAY,
    )!;
    expect(r.daysAgo).toBe(365);
  });

  it("never celebrates regression or noise", () => {
    const regressed = [
      session("2026-05-02", "Bench Press", 100, 8),
      session("2026-07-28", "Bench Press", 80, 8),
    ];
    expect(throwback(regressed, TODAY)).toBeNull();
    const flat = [
      session("2026-05-02", "Bench Press", 100, 8),
      session("2026-07-28", "Bench Press", 100.5, 8),
    ];
    expect(throwback(flat, TODAY)).toBeNull();
  });
});
