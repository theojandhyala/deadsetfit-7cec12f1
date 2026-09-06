import { describe, expect, it } from "vitest";

import {
  GROWTH_GOAL_OPTIONS,
  GROWTH_TARGET_OPTIONS,
  buildMuscleGrowthGuide,
  growthTargetsFor,
  isSafeGrowthExerciseId,
} from "./muscle-growth-recommendations";
import type { DayKey, Exercise, Program, Schedule } from "./types";

function exercise(
  id: string,
  name: string,
  muscleGroup: Exercise["muscleGroup"],
  patch: Partial<Exercise> = {},
): Exercise {
  return {
    id,
    name,
    muscleGroup,
    equipment: ["FULL_GYM"],
    skill: "BEGINNER",
    sets: 3,
    reps: "8-12",
    videoId: "",
    instruction: `Perform ${name} with controlled form.`,
    ...patch,
  };
}

const LIBRARY: Exercise[] = [
  exercise("bench-press", "Bench Press", "CHEST", {
    isCompound: true,
    skill: "INTERMEDIATE",
    sets: 4,
    reps: "6-8",
  }),
  exercise("incline-db-press", "Incline Dumbbell Press", "CHEST", {
    equipment: ["FULL_GYM", "HOME_GYM"],
    isCompound: true,
    instruction: "Press on a 30 degree incline to train the upper chest.",
  }),
  exercise("cable-fly", "Cable Fly", "CHEST", { isCompound: false }),
  exercise("dips", "Chest Dips", "CHEST", {
    equipment: ["FULL_GYM", "BODYWEIGHT"],
    isCompound: true,
  }),
  exercise("lat-pulldown", "Lat Pulldown", "BACK", { isCompound: true }),
  exercise("pull-ups", "Pull Ups", "BACK", {
    equipment: ["FULL_GYM", "HOME_GYM", "BODYWEIGHT"],
    isCompound: true,
  }),
  exercise("seated-row", "Seated Row", "BACK", { isCompound: true }),
  exercise("inverted-row", "Inverted Row", "BACK", {
    equipment: ["FULL_GYM", "HOME_GYM", "BODYWEIGHT"],
    isCompound: true,
  }),
  exercise("deadlift", "Deadlift", "BACK", {
    isCompound: true,
    skill: "ADVANCED",
    sets: 4,
    reps: "3-5",
  }),
  exercise("superman", "Superman", "BACK", {
    equipment: ["FULL_GYM", "HOME_GYM", "BODYWEIGHT"],
    reps: "30-45s",
  }),
  exercise("shrug", "Dumbbell Shrug", "BACK", {
    equipment: ["FULL_GYM", "HOME_GYM"],
    isCompound: false,
  }),
  exercise("plank", "Plank", "CORE", {
    equipment: ["FULL_GYM", "HOME_GYM", "BODYWEIGHT"],
    reps: "45-60s",
  }),
  exercise("run", "Treadmill Run", "LEGS", { tracking: "DISTANCE" }),
];

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function schedule(days: Partial<Record<DayKey, string[]>>): Schedule {
  return Object.fromEntries(
    DAY_KEYS.map((day) => [
      day,
      {
        label: days[day]?.length ? "Training" : "REST",
        exerciseIds: days[day] ?? [],
      },
    ]),
  ) as Schedule;
}

function activeProgram(items: Partial<Record<DayKey, Program["days"][DayKey]["items"]>>) {
  return {
    days: Object.fromEntries(
      DAY_KEYS.map((day) => [
        day,
        { label: items[day]?.length ? "Training" : "REST", items: items[day] ?? [] },
      ]),
    ) as Program["days"],
  };
}

describe("muscle growth target options", () => {
  it("provides unique broad and specific button IDs with the requested back question", () => {
    const ids = GROWTH_TARGET_OPTIONS.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GROWTH_GOAL_OPTIONS.map((option) => option.id)).toEqual(["SIZE", "STRENGTH", "BALANCE"]);
    expect(GROWTH_TARGET_OPTIONS.find((option) => option.id === "BACK")?.question).toBe(
      "How can I get my back bigger?",
    );
    expect(growthTargetsFor("BACK").map((option) => option.id)).toEqual([
      "BACK",
      "BACK_WIDTH",
      "BACK_THICKNESS",
      "LOWER_BACK",
      "TRAPS",
    ]);
  });
});

describe("buildMuscleGrowthGuide", () => {
  it("ranks a diverse size plan for a broad muscle and returns add-ready IDs", () => {
    const guide = buildMuscleGrowthGuide({
      target: "BACK",
      goal: "SIZE",
      exercises: LIBRARY,
      profile: { equipment: "FULL_GYM", experience: "INTERMEDIATE" },
      limit: 4,
    });

    expect(guide.id).toBe("growth-back-size");
    expect(guide.recommendations).toHaveLength(4);
    expect(new Set(guide.recommendations.flatMap((item) => item.areas))).toEqual(
      new Set(["BACK_WIDTH", "BACK_THICKNESS", "LOWER_BACK", "TRAPS"]),
    );
    expect(guide.addExerciseIds).toEqual(
      guide.recommendations.map((recommendation) => recommendation.exerciseId),
    );
    expect(guide.recommendations.every((item) => item.reasons.length >= 2)).toBe(true);
  });

  it("only returns direct matches for a specific area", () => {
    const guide = buildMuscleGrowthGuide({
      target: "UPPER_CHEST",
      exercises: LIBRARY,
      limit: 6,
    });

    expect(guide.recommendations.map((item) => item.exerciseId)).toEqual(["incline-db-press"]);
    expect(guide.recommendations[0]).toMatchObject({
      match: "DIRECT",
      areas: ["UPPER_CHEST"],
      areaLabels: ["Upper chest"],
    });
  });

  it("uses granular catalogue primary muscles even when the exercise name is opaque", () => {
    const guide = buildMuscleGrowthGuide({
      target: "BACK_WIDTH",
      exercises: [
        exercise("catalogue-1042", "Supported Pull 1042", "BACK", {
          instruction: "Use a controlled range of motion.",
          primaryMuscles: ["lats"],
        }),
      ],
    });

    expect(guide.recommendations).toHaveLength(1);
    expect(guide.recommendations[0]).toMatchObject({
      exerciseId: "catalogue-1042",
      areas: ["BACK_WIDTH"],
    });
  });

  it("changes ordering and prescriptions for size versus strength", () => {
    const chest = LIBRARY.filter((item) => item.muscleGroup === "CHEST");
    const size = buildMuscleGrowthGuide({ target: "CHEST", goal: "SIZE", exercises: chest });
    const strength = buildMuscleGrowthGuide({
      target: "CHEST",
      goal: "STRENGTH",
      exercises: chest,
    });

    expect(size.recommendations[0].exerciseId).toBe("cable-fly");
    expect(size.recommendations[0].prescription).toMatchObject({
      reps: "10-15",
      tracking: "WEIGHT",
    });
    expect(strength.recommendations[0].exerciseId).toBe("bench-press");
    expect(strength.recommendations[0].prescription).toMatchObject({
      sets: 4,
      reps: "3-6",
      restSeconds: 180,
    });
  });

  it("recognises plural compound names when older built-ins lack metadata", () => {
    const guide = buildMuscleGrowthGuide({
      target: "BACK_WIDTH",
      goal: "STRENGTH",
      exercises: [LIBRARY.find((item) => item.id === "pull-ups")!],
    });

    expect(guide.recommendations[0].prescription).toMatchObject({
      sets: 4,
      reps: "3-6",
      restSeconds: 180,
    });
    expect(guide.recommendations[0].reason).toMatch(/compound pattern/);
  });

  it("uses active-program coverage as the source of truth without counting a stale schedule", () => {
    const guide = buildMuscleGrowthGuide({
      target: "BACK",
      goal: "BALANCE",
      exercises: LIBRARY,
      schedule: schedule({ MON: ["deadlift", "bench-press"] }),
      activeProgram: activeProgram({
        MON: [
          {
            id: "lat-pulldown",
            name: "Lat Pulldown",
            equipment: "Cable",
            primary_muscles: ["lats"],
            youtube_query: "",
            sets: 3,
            reps: "8-12",
          },
        ],
        THU: [
          {
            id: "seated-row",
            name: "Seated Row",
            equipment: "Cable",
            primary_muscles: ["upper back", "rhomboids"],
            youtube_query: "",
            sets: 3,
            reps: "8-12",
          },
        ],
      }),
      limit: 6,
    });

    expect(guide.coverage).toMatchObject({
      status: "PARTIAL",
      coveredAreas: ["BACK_WIDTH", "BACK_THICKNESS"],
      missingAreas: ["LOWER_BACK", "TRAPS"],
      plannedExerciseIds: ["lat-pulldown", "seated-row"],
      weeklyExposureCount: 2,
    });
    expect(guide.addExerciseIds).not.toContain("lat-pulldown");
    expect(guide.addExerciseIds).not.toContain("seated-row");
    expect(
      guide.recommendations[0].areas.some((area) => guide.coverage.missingAreas.includes(area)),
    ).toBe(true);
  });

  it("treats a broad exercise as no coverage for a different specific target", () => {
    const guide = buildMuscleGrowthGuide({
      target: "UPPER_CHEST",
      exercises: LIBRARY,
      schedule: schedule({ MON: ["bench-press"] }),
    });

    expect(guide.coverage.status).toBe("NONE");
    expect(guide.coverage.plannedExerciseIds).toEqual([]);
    expect(guide.addExerciseIds).toEqual(["incline-db-press"]);
  });

  it("filters by the athlete's equipment before deduplicating names", () => {
    const inaccessible = exercise("gym-row", "Supported Row", "BACK", {
      equipment: ["FULL_GYM"],
      equipmentLabel: "Plate-loaded machine",
    });
    const accessible = exercise("home-row", "Supported Row", "BACK", {
      equipment: ["HOME_GYM"],
      instruction: "A dumbbell row for upper back thickness.",
    });
    const guide = buildMuscleGrowthGuide({
      target: "BACK_THICKNESS",
      exercises: [inaccessible, accessible],
      profile: { equipment: "HOME_GYM" },
    });

    expect(guide.recommendations.map((item) => item.exerciseId)).toEqual(["home-row"]);
    expect(guide.recommendations[0].reasons).toContain("Fits your home gym setup.");
  });

  it("deduplicates equivalent exercise names and recognises a planned copy", () => {
    const duplicate = exercise("remote-lat-pulldown", " Lat-Pulldown ", "BACK", {
      equipmentLabel: "Cable",
      secondaryMuscles: ["biceps"],
    });
    const guide = buildMuscleGrowthGuide({
      target: "BACK_WIDTH",
      exercises: [duplicate, ...LIBRARY],
      schedule: schedule({ MON: ["lat-pulldown"] }),
      limit: 6,
    });

    const pulldowns = guide.recommendations.filter((item) => /pulldown/i.test(item.name));
    expect(pulldowns).toHaveLength(1);
    expect(pulldowns[0]).toMatchObject({ exerciseId: "lat-pulldown", alreadyPlanned: true });
    expect(guide.addExerciseIds).not.toContain("lat-pulldown");
  });

  it("preserves duration prescriptions so live sets can keep reps: 0", () => {
    const input = LIBRARY.find((item) => item.id === "plank")!;
    const before = structuredClone(input);
    const guide = buildMuscleGrowthGuide({
      target: "ABS",
      goal: "SIZE",
      exercises: [input],
      profile: { equipment: "BODYWEIGHT" },
    });

    expect(guide.recommendations[0].prescription).toEqual({
      sets: 3,
      reps: "45-60s",
      tracking: "DURATION",
      restSeconds: 75,
    });
    expect(input).toEqual(before);
    expect(guide.recommendations[0]).not.toHaveProperty("completedSets");
  });

  it("does not recommend distance conditioning as muscle-growth work", () => {
    const guide = buildMuscleGrowthGuide({
      target: "LEGS",
      exercises: [LIBRARY.find((item) => item.id === "run")!],
    });
    expect(guide.recommendations).toEqual([]);
    expect(guide.addExerciseIds).toEqual([]);
    expect(guide.emptyReason).toMatch(/No safe legs matches/);
  });

  it("filters unsafe exercise IDs and emits DOM-safe guide, card and action IDs", () => {
    const unsafe = exercise("../bad id", "Lat Pulldown", "BACK");
    const guide = buildMuscleGrowthGuide({
      target: "BACK",
      exercises: [unsafe, ...LIBRARY],
      limit: 2,
    });
    const safeUiId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    expect(isSafeGrowthExerciseId("remote:exercise_2.0")).toBe(true);
    expect(isSafeGrowthExerciseId("../bad id")).toBe(false);
    expect(guide.recommendations.some((item) => item.exerciseId === unsafe.id)).toBe(false);
    expect(guide.id).toMatch(safeUiId);
    guide.recommendations.forEach((item) => {
      expect(item.id).toMatch(safeUiId);
      expect(item.action.id).toMatch(safeUiId);
      expect(isSafeGrowthExerciseId(item.action.exerciseId)).toBe(true);
    });
  });

  it("is deterministic across input order and clamps the card limit", () => {
    const forward = buildMuscleGrowthGuide({
      target: "BACK",
      exercises: LIBRARY,
      limit: 99,
    });
    const reverse = buildMuscleGrowthGuide({
      target: "BACK",
      exercises: [...LIBRARY].reverse(),
      limit: 99,
    });
    const one = buildMuscleGrowthGuide({ target: "BACK", exercises: LIBRARY, limit: 0 });

    expect(forward).toEqual(reverse);
    expect(forward.recommendations).toHaveLength(6);
    expect(one.recommendations).toHaveLength(1);
  });

  it("flags advanced technique for a beginner and surfaces injury-safe copy", () => {
    const guide = buildMuscleGrowthGuide({
      target: "LOWER_BACK",
      goal: "STRENGTH",
      exercises: [LIBRARY.find((item) => item.id === "deadlift")!],
      profile: { experience: "BEGINNER", equipment: "FULL_GYM", injuries: "Old back injury" },
    });

    expect(guide.recommendations[0].caution).toMatch(/Advanced technique/);
    expect(guide.safetyNote).toMatch(/injury note/);
  });
});
