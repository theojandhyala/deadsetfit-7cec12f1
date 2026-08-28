import { describe, expect, it } from "vitest";

import { deriveLiveSetupBlueprint } from "./setup-blueprint";
import type { DayKey, Profile, Schedule } from "./types";

const complete: Partial<Profile> = {
  goal: "BULK",
  experience: "INTERMEDIATE",
  trainingDays: ["MON", "TUE", "THU", "SAT"],
  daysPerWeek: 4,
  equipment: "FULL_GYM",
  focusMuscles: ["BACK", "LEGS"],
  exercisesPerSession: 4,
  sessionMinutes: 45,
};

function scheduleWith(entries: Partial<Record<DayKey, Schedule[DayKey]>>): Schedule {
  const days: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return Object.fromEntries(
    days.map((day) => [day, entries[day] ?? { label: "REST", exerciseIds: [] }]),
  ) as Schedule;
}

describe("deriveLiveSetupBlueprint", () => {
  it("previews a safe generated week while clearly marking unanswered setup", () => {
    const result = deriveLiveSetupBlueprint({});

    expect(result.splitName).toBe("FULL BODY");
    expect(result.isProvisional).toBe(true);
    expect(result.week.filter((day) => day.isTraining).map((day) => day.dayKey)).toEqual([
      "MON",
      "WED",
      "FRI",
    ]);
    expect(result.firstWorkout).toMatchObject({ ready: false, status: "BUILDING" });
    expect(result.firstWorkout.missingRequirements).toEqual(
      expect.arrayContaining(["GOAL", "TRAINING_DAYS", "EQUIPMENT", "EXPERIENCE", "SESSION"]),
    );
  });

  it("keeps an explicit one- or two-day edit provisional until it is valid", () => {
    const result = deriveLiveSetupBlueprint({ ...complete, trainingDays: ["TUE", "SAT"] });

    expect(result.isProvisional).toBe(true);
    expect(result.firstWorkout.missingRequirements).toContain("TRAINING_DAYS");
    expect(result.firstWorkout.status).toBe("BUILDING");
  });

  it("reads back the chosen days, split, priorities and session shape", () => {
    const result = deriveLiveSetupBlueprint(complete);

    expect(result.splitName).toBe("UPPER / LOWER");
    expect(result.splitDetail).toBe("4 days · Mon, Tue, Thu and Sat");
    expect(result.week.filter((day) => day.isTraining).map((day) => day.shortLabel)).toEqual([
      "UPPER",
      "LOWER",
      "UPPER",
      "LOWER",
    ]);
    expect(result.priorityMuscles).toEqual(["BACK", "LEGS"]);
    expect(result.priorityLabel).toBe("BACK + LEGS PRIORITY");
    expect(result.sessionLabel).toBe("45-MINUTE SESSIONS");
    expect(result.sessionDetail).toContain("4 movements");
  });

  it("does not call a weighted workout ready until its unique starting loads exist", () => {
    const schedule = scheduleWith({
      MON: {
        label: "UPPER",
        exerciseIds: ["bench-press", "bench-press", "lat-pulldown", "push-ups", "plank"],
        exerciseConfig: {
          "bench-press": { weightKg: 80 },
        },
      },
    });
    const result = deriveLiveSetupBlueprint(complete, { schedule });

    expect(result.firstWorkout).toMatchObject({
      ready: false,
      status: "SET_WEIGHTS",
      missingWeightCount: 1,
    });
    expect(result.firstWorkout.message).toContain("1 starting weight");
    expect(result.sessionDetail).toContain("starting loads are the next setup step");
  });

  it("reuses a repeated exercise's known load across the whole week", () => {
    const schedule = scheduleWith({
      MON: {
        label: "PUSH",
        exerciseIds: ["bench-press"],
      },
      THU: {
        label: "UPPER",
        exerciseIds: ["bench-press"],
        exerciseConfig: { "bench-press": { weightKg: 82.5 } },
      },
    });
    const result = deriveLiveSetupBlueprint(complete, { schedule });

    expect(result.firstWorkout).toMatchObject({
      ready: true,
      status: "READY",
      dayKey: "MON",
      missingWeightCount: 0,
    });
  });

  it("treats bodyweight and timed work as ready without invented loads", () => {
    const schedule = scheduleWith({
      SAT: {
        label: "BODYWEIGHT + CORE",
        exerciseIds: ["push-ups", "plank"],
      },
    });
    const result = deriveLiveSetupBlueprint(
      { ...complete, trainingDays: ["SAT", "SUN", "MON"], daysPerWeek: 3 },
      { schedule },
    );

    expect(result.firstWorkout).toMatchObject({
      ready: true,
      status: "READY",
      dayKey: "SAT",
      missingWeightCount: 0,
    });
  });

  it("surfaces muscle-map gaps from the real scheduled exercise coverage", () => {
    const schedule = scheduleWith({
      MON: {
        label: "CHEST + BACK",
        exerciseIds: ["bench-press", "lat-pulldown"],
        exerciseConfig: {
          "bench-press": { weightKg: 80 },
          "lat-pulldown": { weightKg: 60 },
        },
      },
    });
    const result = deriveLiveSetupBlueprint(complete, { schedule });

    expect(result.coveredMuscles).toEqual(["CHEST", "BACK"]);
    expect(result.missingMuscles).toEqual(["SHOULDERS", "ARMS", "LEGS", "CORE"]);
  });

  it("turns low sleep and dense weeks into honest recovery copy", () => {
    const result = deriveLiveSetupBlueprint({
      ...complete,
      trainingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      daysPerWeek: 6,
      sleepQuality: "LOW",
    });

    expect(result.recovery).toMatchObject({
      status: "WATCH",
      headline: "RECOVERY WATCH ON",
      restDays: 1,
      longestTrainingRun: 6,
    });
    expect(result.recovery.detail).toContain("Low sleep noted");
  });

  it("gives build-your-own a safe editable scaffold instead of an empty plan", () => {
    const result = deriveLiveSetupBlueprint(complete, { mode: "BUILD" });

    expect(result.splitName).toBe("YOUR CUSTOM SPLIT");
    expect(result.week.filter((day) => day.isTraining).map((day) => day.dayKey)).toEqual([
      "MON",
      "TUE",
      "THU",
      "SAT",
    ]);
    expect(result.week.filter((day) => day.isTraining).every((day) => day.exerciseCount > 0)).toBe(
      true,
    );
    expect(result.firstWorkout).toMatchObject({ status: "SET_WEIGHTS", dayKey: "MON" });
    expect(result.recovery).toMatchObject({ status: "BALANCED", restDays: 3 });
  });
});
