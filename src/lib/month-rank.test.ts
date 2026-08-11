import { describe, it, expect } from "vitest";

import { monthRank } from "./month-rank";
import type { WorkoutSession } from "./types";

const TODAY = "2026-08-10";

function session(date: string, weight: number): WorkoutSession {
  return {
    id: `${date}-${weight}`,
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
        targetSets: 1,
        targetReps: "10",
        sets: [{ weight, reps: 10 }],
      },
    ],
  } as WorkoutSession;
}

describe("monthRank", () => {
  it("needs three completed months", () => {
    expect(monthRank([session("2026-07-10", 100)], TODAY)).toBeNull();
  });

  it("ranks the last completed month and excludes the running one", () => {
    const sessions = [
      session("2026-05-10", 300), // May: 3000
      session("2026-06-10", 100), // June: 1000
      session("2026-07-10", 200), // July: 2000
      session("2026-08-05", 900), // August is running — must not compete
    ];
    const r = monthRank(sessions, TODAY)!;
    expect(r.month).toBe("2026-07");
    expect(r.label).toBe("July 2026");
    expect(r.rank).toBe(2);
    expect(r.totalMonths).toBe(3);
    expect(r.bestMonth).toEqual({ label: "May 2026", volumeKg: 3000 });
  });

  it("crowns a record month with rank 1", () => {
    const sessions = [
      session("2026-05-10", 100),
      session("2026-06-10", 200),
      session("2026-07-10", 300),
    ];
    expect(monthRank(sessions, TODAY)!.rank).toBe(1);
  });
});
