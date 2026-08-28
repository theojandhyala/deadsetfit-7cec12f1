import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import { strengthGoalRoadmaps } from "./pro-intelligence";
import { buildProReview } from "./pro-review";
import type { AppState, WorkoutSession } from "./types";

function session(date: string, weight: number, prCount = 0): WorkoutSession {
  return {
    id: date,
    date,
    dayKey: "MON",
    label: "PUSH",
    programId: null,
    startedAt: `${date}T10:00:00.000Z`,
    endedAt: `${date}T11:00:00.000Z`,
    exercises: [
      {
        exerciseId: "bench-press",
        name: "Bench Press",
        primary_muscles: ["CHEST"],
        targetSets: 3,
        targetReps: "5",
        sets: [{ weight, reps: 5, rpe: 8 }],
      },
    ],
    totalVolume: weight * 5,
    prCount,
  };
}

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...structuredClone(DEFAULT_STATE), ...overrides };
}

describe("Pro review", () => {
  it("makes building a schedule the first action when no plan exists", () => {
    const review = buildProReview(state(), new Date("2026-07-28T12:00:00Z").getTime());
    expect(review.actions[0]).toMatchObject({
      id: "build-plan",
      title: "Build your training week",
      to: "/plan",
    });
  });

  it("uses the current week instead of grading today's work as last week", () => {
    const appState = state({
      profile: {
        username: "review_test",
        goal: "BULK",
        experience: "INTERMEDIATE",
        equipment: "FULL_GYM",
        daysPerWeek: 4,
        age: 25,
        weightKg: 80,
        heightCm: 180,
        gender: "MALE",
      },
      sessions: [session("2026-07-28", 100, 1)],
    });
    const review = buildProReview(appState, new Date("2026-07-28T12:00:00Z").getTime());
    expect(review.grade).toBe("B");
    expect(review.wins[0]).toMatchObject({ value: "1", label: "session this week" });
  });

  it("builds a target roadmap from real lift history and trend", () => {
    const appState = state({
      sessions: [session("2026-07-01", 80), session("2026-07-08", 85), session("2026-07-15", 90)],
      strengthGoals: [
        {
          exerciseId: "bench-press",
          targetKg: 120,
          createdAt: "2026-07-15T12:00:00.000Z",
        },
      ],
    });

    const [roadmap] = strengthGoalRoadmaps(appState, new Date("2026-07-16T12:00:00Z").getTime());
    expect(roadmap).toMatchObject({
      exerciseId: "bench-press",
      name: "Bench Press",
      targetKg: 120,
      currentKg: 105,
      remainingKg: 15,
      reached: false,
    });
    expect(roadmap.progress).toBe(88);
    expect(roadmap.perWeek).toBeGreaterThan(0);
    expect(roadmap.etaDate).not.toBeNull();
  });

  it("marks a reached target without projecting a future date", () => {
    const appState = state({
      sessions: [session("2026-07-15", 90)],
      strengthGoals: [
        {
          exerciseId: "bench-press",
          targetKg: 100,
          createdAt: "2026-07-15T12:00:00.000Z",
        },
      ],
    });

    expect(strengthGoalRoadmaps(appState)[0]).toMatchObject({
      reached: true,
      remainingKg: 0,
      progress: 100,
      etaDate: null,
    });
  });
});
