import { describe, expect, it } from "vitest";

import {
  calculateMacros,
  defaultSchedule,
  estimate1RM,
  plateBreakdown,
  updateScheduleDay,
} from "./calc";
import { getExercise } from "./exercises";
import type { Equipment, Profile } from "./types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    goal: "MAINTAIN",
    experience: "BEGINNER",
    age: 28,
    weightKg: 80,
    heightCm: 180,
    gender: "OTHER",
    daysPerWeek: 5,
    equipment: "FULL_GYM",
    exercisesPerSession: 5,
    ...overrides,
  };
}

describe("defaultSchedule", () => {
  it.each<Equipment>(["FULL_GYM", "HOME_GYM", "BODYWEIGHT"])(
    "only schedules exercises available for %s",
    (equipment) => {
      const schedule = defaultSchedule(profile({ equipment, daysPerWeek: 6 }));

      for (const day of Object.values(schedule)) {
        for (const exerciseId of day.exerciseIds) {
          expect(getExercise(exerciseId), exerciseId).toBeDefined();
          expect(getExercise(exerciseId)?.equipment, exerciseId).toContain(equipment);
        }
      }
    },
  );

  it("honours the requested movement cap without adding duplicates", () => {
    const schedule = defaultSchedule(
      profile({
        equipment: "BODYWEIGHT",
        daysPerWeek: 6,
        exercisesPerSession: 3,
        focusMuscles: ["CHEST", "LEGS"],
      }),
    );

    for (const day of Object.values(schedule)) {
      expect(day.exerciseIds.length).toBeLessThanOrEqual(3);
      expect(new Set(day.exerciseIds).size).toBe(day.exerciseIds.length);
    }
  });

  it("creates the exact number of training days selected during onboarding", () => {
    for (const daysPerWeek of [3, 4, 5, 6] as const) {
      const schedule = defaultSchedule(profile({ daysPerWeek }));
      const trainingDays = Object.values(schedule).filter((day) => day.exerciseIds.length > 0);
      expect(trainingDays).toHaveLength(daysPerWeek);
    }
  });

  it("composes rapid edits to one exercise without dropping earlier targets", () => {
    let schedule = defaultSchedule(profile({ daysPerWeek: 3 }));
    const exerciseId = schedule.MON.exerciseIds[0];

    schedule = updateScheduleDay(schedule, "MON", (day) => ({
      ...day,
      exerciseConfig: {
        ...(day.exerciseConfig ?? {}),
        [exerciseId]: { ...(day.exerciseConfig?.[exerciseId] ?? {}), sets: 4 },
      },
    }));
    schedule = updateScheduleDay(schedule, "MON", (day) => ({
      ...day,
      exerciseConfig: {
        ...(day.exerciseConfig ?? {}),
        [exerciseId]: { ...(day.exerciseConfig?.[exerciseId] ?? {}), reps: "6-10" },
      },
    }));
    schedule = updateScheduleDay(schedule, "MON", (day) => ({
      ...day,
      exerciseConfig: {
        ...(day.exerciseConfig ?? {}),
        [exerciseId]: { ...(day.exerciseConfig?.[exerciseId] ?? {}), weightKg: 60 },
      },
    }));

    expect(schedule.MON.exerciseConfig?.[exerciseId]).toEqual({
      sets: 4,
      reps: "6-10",
      weightKg: 60,
    });
  });
});

describe("training calculations", () => {
  it("keeps macro calories internally consistent", () => {
    const calories = 2_400;
    const macros = calculateMacros(profile(), calories);
    const macroCalories = macros.protein * 4 + macros.carbs * 4 + macros.fats * 9;
    expect(Math.abs(macroCalories - calories)).toBeLessThanOrEqual(4);
  });

  it("estimates one-rep max and loading plates defensively", () => {
    expect(estimate1RM(100, 5)).toBe(117);
    expect(estimate1RM(-10, 5)).toBe(0);
    expect(plateBreakdown(100)).toEqual({ perSide: [25, 15], remainderKg: 0, barKg: 20 });
  });
});
