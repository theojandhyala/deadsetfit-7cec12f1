import { describe, expect, it } from "vitest";

import { buildPlannedSetGrid } from "./planned-set-grid";
import { DEFAULT_STATE } from "./default-state";
import type { AppState, Exercise, Program, Schedule } from "./types";

const exercise: Exercise = {
  id: "incline-test",
  name: "Incline Test Press",
  muscleGroup: "CHEST",
  primaryMuscles: ["upper chest", "front delts"],
  equipment: ["FULL_GYM"],
  skill: "BEGINNER",
  sets: 3,
  reps: "8-12",
  videoId: "",
  instruction: "Press.",
};

const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

function emptySchedule(): Schedule {
  const schedule = {} as Schedule;
  for (const day of days) schedule[day] = { label: "REST", exerciseIds: [] };
  return schedule;
}

describe("buildPlannedSetGrid", () => {
  it("uses per-exercise set overrides and credits distinct primary muscle groups", () => {
    const schedule = emptySchedule();
    schedule.MON = {
      label: "PUSH",
      exerciseIds: [exercise.id],
      exerciseConfig: { [exercise.id]: { sets: 5 } },
    };
    const state = {
      ...DEFAULT_STATE,
      schedule,
      savedExercises: [exercise],
    } as AppState;

    const grid = buildPlannedSetGrid(state);
    expect(grid.rows.find((row) => row.muscle === "CHEST")?.cells[0]?.sets).toBe(5);
    expect(grid.rows.find((row) => row.muscle === "SHOULDERS")?.cells[0]?.sets).toBe(5);
    expect(grid.coveredMuscles).toBe(2);
  });

  it("uses the active programme rather than the inactive weekly schedule", () => {
    const schedule = emptySchedule();
    schedule.MON = { label: "CHEST", exerciseIds: [exercise.id] };
    const program: Program = {
      id: "active",
      name: "Active",
      splitType: "CUSTOM",
      createdAt: "2026-08-28T00:00:00Z",
      days: days.reduce((result, day) => {
        result[day] = { label: "REST", items: [] };
        return result;
      }, {} as Program["days"]),
    };
    program.days.TUE = {
      label: "PULL",
      items: [
        {
          id: "row",
          name: "Row",
          equipment: "BARBELL",
          primary_muscles: ["lats", "rhomboids"],
          youtube_query: "row form",
          sets: 4,
          reps: "6-10",
        },
      ],
    };
    const state = {
      ...DEFAULT_STATE,
      schedule,
      savedExercises: [exercise],
      programs: [program],
      activeProgramId: program.id,
    } as AppState;

    const grid = buildPlannedSetGrid(state);
    expect(grid.source).toBe("PROGRAM");
    expect(grid.rows.find((row) => row.muscle === "CHEST")?.totalSets).toBe(0);
    expect(grid.rows.find((row) => row.muscle === "BACK")?.cells[1]?.sets).toBe(4);
  });
});
