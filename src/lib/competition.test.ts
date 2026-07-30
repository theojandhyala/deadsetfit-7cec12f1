import { describe, expect, it } from "vitest";

import { getWeeklyCompetitionStats } from "./competition";
import { DEFAULT_STATE } from "./default-state";
import type { AppState, WorkoutSession } from "./types";

function session(id: string, date: string, ended = true, warmup = false): WorkoutSession {
  return {
    id,
    date,
    dayKey: "MON",
    label: "Workout",
    programId: null,
    startedAt: `${date}T10:00:00.000Z`,
    endedAt: ended ? `${date}T11:00:00.000Z` : undefined,
    exercises: [
      {
        exerciseId: "squat",
        name: "Back Squat",
        primary_muscles: ["legs"],
        targetSets: 2,
        targetReps: "5",
        sets: [
          { weight: 20, reps: 5, kind: warmup ? "warmup" : undefined },
          { weight: 100, reps: 5 },
        ],
      },
    ],
    totalVolume: 0,
    prCount: 1,
  };
}

function state(sessions: WorkoutSession[]): AppState {
  return { ...structuredClone(DEFAULT_STATE), sessions };
}

describe("weekly competition scoring", () => {
  it("counts completed sessions from Monday through today only", () => {
    const stats = getWeeklyCompetitionStats(
      state([
        session("previous", "2026-07-19"),
        session("monday", "2026-07-20"),
        session("active", "2026-07-21", false),
        session("future", "2026-07-24"),
      ]),
      new Date(2026, 6, 22, 12),
    );

    expect(stats.weekStart).toBe("2026-07-20");
    expect(stats.sessions).toBe(1);
    expect(stats.days).toBe(1);
  });

  it("excludes warmups from set count and scoring volume", () => {
    const stats = getWeeklyCompetitionStats(
      state([session("one", "2026-07-20", true, true)]),
      new Date(2026, 6, 20, 12),
    );
    expect(stats.sets).toBe(1);
    expect(stats.volumeKg).toBe(500);
    expect(stats.prs).toBe(1);
  });
});
