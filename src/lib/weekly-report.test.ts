import { describe, it, expect } from "vitest";

import { gradeHistory } from "./weekly-report";
import type { AppState, WorkoutSession } from "./types";

// 2026-07-31 is a Friday; the current week's Monday is 2026-07-27.
const NOW = new Date("2026-07-31T12:00:00Z");

function session(date: string): WorkoutSession {
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
        sets: [
          { weight: 80, reps: 8 },
          { weight: 80, reps: 8 },
          { weight: 80, reps: 8 },
        ],
      },
    ],
  } as WorkoutSession;
}

function stateWith(sessions: WorkoutSession[]): AppState {
  return {
    sessions,
    completedDates: sessions.map((s) => s.date),
    profile: { daysPerWeek: 3 },
  } as unknown as AppState;
}

describe("gradeHistory", () => {
  it("is empty with no finished sessions", () => {
    expect(gradeHistory(stateWith([]), 8, NOW)).toHaveLength(0);
  });

  it("drops weeks before the first session instead of grading them F", () => {
    // First session two full weeks ago — history must start there, not 8 weeks back.
    const sessions = [
      session("2026-07-14"),
      session("2026-07-16"),
      session("2026-07-21"),
      session("2026-07-23"),
    ];
    const grades = gradeHistory(stateWith(sessions), 8, NOW);
    expect(grades).toHaveLength(2);
    expect(grades[0].weekStart).toBe("2026-07-13");
    expect(grades[1].weekStart).toBe("2026-07-20");
    expect(grades.every((g) => g.grade !== "F")).toBe(true);
  });

  it("grades an empty week between active ones as F", () => {
    const sessions = [
      session("2026-07-06"),
      session("2026-07-08"),
      session("2026-07-10"),
      session("2026-07-20"),
      session("2026-07-22"),
    ];
    const grades = gradeHistory(stateWith(sessions), 8, NOW);
    expect(grades).toHaveLength(3);
    expect(grades[1].weekStart).toBe("2026-07-13");
    expect(grades[1].grade).toBe("F");
    expect(grades[1].sessions).toBe(0);
  });

  it("never includes the current, still-running week", () => {
    const sessions = [session("2026-07-20"), session("2026-07-28")];
    const grades = gradeHistory(stateWith(sessions), 8, NOW);
    expect(grades.every((g) => g.weekStart < "2026-07-27")).toBe(true);
  });
});
