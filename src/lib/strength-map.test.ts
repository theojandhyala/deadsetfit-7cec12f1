import { describe, expect, it } from "vitest";

import {
  addStrengthExerciseToSchedule,
  buildStrengthMap,
  exerciseRespectsInjuryNotes,
  strengthRecommendations,
  strengthRegionsForExercise,
} from "./strength-map";
import type { AppState, Exercise } from "./types";

const bench: Exercise = {
  id: "bench-press",
  name: "Bench Press",
  muscleGroup: "CHEST",
  equipment: ["FULL_GYM"],
  skill: "BEGINNER",
  sets: 3,
  reps: "8",
  videoId: "",
  instruction: "",
};

function state(): AppState {
  return {
    profile: {
      goal: "BULK",
      experience: "BEGINNER",
      age: 25,
      weightKg: 80,
      heightCm: 180,
      gender: "MALE",
      daysPerWeek: 3,
      equipment: "FULL_GYM",
    },
    schedule: {
      MON: { label: "Push", exerciseIds: ["bench-press"] },
      TUE: { label: "Rest", exerciseIds: [] },
      WED: { label: "Rest", exerciseIds: [] },
      THU: { label: "Rest", exerciseIds: [] },
      FRI: { label: "Rest", exerciseIds: [] },
      SAT: { label: "Rest", exerciseIds: [] },
      SUN: { label: "Rest", exerciseIds: [] },
    },
    savedExercises: [bench],
    logs: [],
    checkIns: [],
    weights: [],
    measurements: [],
    foodLog: [],
    completedDates: [],
    programs: [],
    activeProgramId: null,
    sessions: [],
    activeSessionId: null,
    water: [],
    waterTargetMl: 2500,
    hydrationAlertsEnabled: false,
  };
}

describe("strength map", () => {
  it("deterministically filters movements that conflict with injury notes", () => {
    expect(
      exerciseRespectsInjuryNotes(
        { ...bench, id: "overhead-press", name: "Overhead Press" },
        "Recovering from a shoulder injury",
      ),
    ).toBe(false);
    expect(exerciseRespectsInjuryNotes(bench, "Recovering from a knee injury")).toBe(true);
  });

  it("leaves unplanned regions grey and explains planned-but-unlogged regions", () => {
    const app = state();
    app.logs = [{ exerciseId: "deadlift", weight: 100, reps: 5, date: "2026-01-01" }];
    const result = buildStrengthMap(app);
    expect(result.regions.find((region) => region.id === "chest")?.status).toBe("unlogged");
    const back = result.regions.find((region) => region.id === "back");
    expect(back?.status).toBe("unplanned");
    expect(back?.score).toBe(0);
  });

  it("raises a region only from real improvements and repeated logged days", () => {
    const app = state();
    app.logs = [
      { exerciseId: "bench-press", weight: 60, reps: 5, date: "2026-01-01" },
      { exerciseId: "bench-press", weight: 75, reps: 5, date: "2026-02-01" },
    ];
    const chest = buildStrengthMap(app).regions.find((region) => region.id === "chest")!;
    expect(chest.status).toBe("tracked");
    expect(chest.score).toBeGreaterThan(50);
    expect(chest.loggedExerciseCount).toBe(1);
    expect(chest.exercises[0]).toMatchObject({
      exerciseId: "bench-press",
      sessions: 2,
      latestWeight: 75,
      latestReps: 5,
    });
    expect(chest.exercises[0].changePercent).toBeGreaterThan(20);
  });

  it("does not count warmups as strength evidence", () => {
    const app = state();
    app.sessions = [
      {
        id: "one",
        date: "2026-01-01",
        dayKey: "MON",
        label: "Push",
        programId: null,
        startedAt: "2026-01-01T12:00:00Z",
        endedAt: "2026-01-01T13:00:00Z",
        totalVolume: 200,
        prCount: 0,
        exercises: [
          {
            exerciseId: "bench-press",
            name: "Bench Press",
            primary_muscles: ["chest"],
            targetSets: 1,
            targetReps: "5",
            sets: [{ weight: 40, reps: 5, kind: "warmup" }],
          },
        ],
      },
    ];
    expect(buildStrengthMap(app).regions.find((region) => region.id === "chest")?.status).toBe(
      "unlogged",
    );
  });

  it("uses an athlete-entered setup baseline immediately", () => {
    const app = state();
    app.manualPRs = {
      "bench-press": { value: 70, reps: 8, date: "2026-01-01" },
    };
    const chest = buildStrengthMap(app).regions.find((region) => region.id === "chest")!;
    expect(chest.status).toBe("tracked");
    expect(chest.exercises[0]).toMatchObject({ latestWeight: 70, latestReps: 8 });
  });

  it("maps specific lower-body movements instead of painting every leg muscle", () => {
    expect(
      strengthRegionsForExercise({
        ...bench,
        id: "calf-raise",
        name: "Calf Raise",
        muscleGroup: "LEGS",
      }),
    ).toEqual(["calves"]);
  });

  it("recommends movements compatible with the athlete's equipment", () => {
    const app = state();
    app.profile!.equipment = "BODYWEIGHT";
    const recommendations = strengthRecommendations(app, "chest", 10);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every(({ exercise }) => exercise.equipment.includes("BODYWEIGHT"))).toBe(
      true,
    );
  });

  it("adds a recommendation to a matching workout and never duplicates it", () => {
    const app = state();
    const first = addStrengthExerciseToSchedule(app, "incline-db-press", "chest")!;
    expect(first.added).toBe(true);
    expect(first.day).toBe("MON");
    expect(first.schedule.MON.exerciseIds).toContain("incline-db-press");

    app.schedule = first.schedule;
    const duplicate = addStrengthExerciseToSchedule(app, "incline-db-press", "chest")!;
    expect(duplicate.added).toBe(false);
    expect(
      Object.values(duplicate.schedule)
        .flatMap((day) => day.exerciseIds)
        .filter((id) => id === "incline-db-press"),
    ).toHaveLength(1);
  });
});
