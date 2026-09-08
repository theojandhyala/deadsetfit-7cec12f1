import { describe, expect, it } from "vitest";
import {
  buildExerciseFinderCatalogue,
  exerciseSearchScore,
  findExercises,
  normaliseExerciseSearch,
  plannedFinderIds,
  type FinderFilters,
} from "./exercise-finder";
import { libraryExerciseToExercise } from "./exercise-library";
import { DEFAULT_STATE } from "./default-state";
import { addGrowthRecommendationToDay } from "./muscle-growth-plan";
import { trackingModeFor } from "./set-tracking";
import type { LibraryExercise } from "./library.functions";
import type { Exercise, Program } from "./types";

const row: LibraryExercise = {
  id: "test-row",
  slug: "test-row",
  name: "Cable Row",
  equipment: "CABLE",
  category: "PULL",
  primary_muscles: ["lats"],
  secondary_muscles: ["biceps"],
  difficulty: 2,
  instructions: "Control the movement.",
  pro_tip: "",
  warmup_note: "",
  stretch_note: "",
  youtube_query: "cable row",
  is_compound: true,
};
const filters: FinderFilters = {
  query: "",
  muscle: "ALL",
  equipment: "ALL",
  beginner: false,
  collection: "ALL",
};
const hold: Exercise = {
  id: "custom-hold",
  name: "My Forearm Hold",
  muscleGroup: "ARMS",
  equipment: ["BODYWEIGHT"],
  skill: "BEGINNER",
  sets: 2,
  reps: "30s",
  tracking: "DURATION",
  isCustom: true,
  videoId: "",
  instruction: "Hold with control.",
};

describe("exercise search", () => {
  it.each([
    ["db press", "Incline Dumbbell Press"],
    ["cable flys", "Cable Fly"],
    ["flyes", "Cable Fly"],
    ["becnh press", "Bench Press"],
    ["dumbell curl", "Dumbbell Curl"],
    ["rdl", "Romanian Deadlift"],
    ["press dumbbell", "Dumbbell Press"],
  ])("finds %s without a network request", (query, name) => {
    expect(exerciseSearchScore(query, name)).toBeGreaterThan(0);
  });
  it("matches muscle and equipment aliases", () => {
    expect(exerciseSearchScore("pecs db", "Incline Press", "chest dumbbell")).toBeGreaterThan(0);
  });
  it("requires every query word and refuses loose short-word typo matches", () => {
    expect(exerciseSearchScore("cable squat", "Cable Fly")).toBe(0);
    expect(exerciseSearchScore("row", "Bow")).toBe(0);
    expect(exerciseSearchScore("zzz", "Bench Press")).toBe(0);
  });
  it("ranks exact names above typos", () => {
    expect(exerciseSearchScore("bench press", "Bench Press")).toBeGreaterThan(
      exerciseSearchScore("bench press", "Benc Press"),
    );
  });
  it("normalises punctuation, accents, spacing and abbreviations", () => {
    expect(normaliseExerciseSearch("  DÚMBbells—FLYES ")).toBe("dumbbell fly");
  });
});

describe("finder catalogue and filters", () => {
  it("works offline with saved and bundled movements", () => {
    const catalogue = buildExerciseFinderCatalogue([hold], []);
    expect(catalogue.length).toBeGreaterThan(20);
    expect(catalogue.find((x) => x.id === hold.id)).toMatchObject({
      source: "SAVED",
      plannedSets: 2,
      plannedReps: "30s",
    });
    expect(findExercises(catalogue, { ...filters, collection: "SAVED" }).map((x) => x.id)).toEqual([
      hold.id,
    ]);
  });
  it("keeps the saved identity and prescription when the network returns the same exercise", () => {
    const local = { ...libraryExerciseToExercise(row), sets: 5, reps: "4-6" };
    const catalogue = buildExerciseFinderCatalogue([local], [row, { ...row, id: "duplicate" }]);
    expect(catalogue.filter((x) => x.name === row.name)).toHaveLength(1);
    expect(catalogue.find((x) => x.id === row.id)).toMatchObject({
      plannedSets: 5,
      plannedReps: "4-6",
      source: "SAVED",
    });
  });
  it("combines primary muscle, equipment, difficulty and plan filters", () => {
    const catalogue = buildExerciseFinderCatalogue(
      [],
      [row, { ...row, id: "advanced-row", name: "Advanced Row", difficulty: 5 }],
    );
    expect(
      findExercises(
        catalogue,
        { ...filters, muscle: "BACK", equipment: "CABLE", beginner: true, collection: "PLANNED" },
        new Set([row.id]),
      ).map((x) => x.id),
    ).toEqual([row.id]);
  });
  it("uses the active programme rather than a stale fallback schedule", () => {
    const rest = () => ({ label: "REST", items: [] });
    const programme: Program = {
      id: "active",
      name: "Active",
      splitType: "CUSTOM",
      createdAt: "2026-09-08",
      days: {
        MON: rest(),
        TUE: rest(),
        WED: rest(),
        THU: rest(),
        FRI: rest(),
        SAT: rest(),
        SUN: rest(),
      },
    };
    const result = addGrowthRecommendationToDay(
      { ...DEFAULT_STATE, programs: [programme], activeProgramId: programme.id },
      "MON",
      { exercise: row, sets: 4, reps: "6-8" },
    );
    expect([...plannedFinderIds(result.state, buildExerciseFinderCatalogue([], [row]))]).toEqual([
      row.id,
    ]);
  });
  it("does not change the original catalogue or custom timed logger mode", () => {
    const saved = structuredClone(hold);
    const catalogue = buildExerciseFinderCatalogue([saved], []);
    findExercises(catalogue, { ...filters, query: "hold" });
    expect(saved).toEqual(hold);
    expect(trackingModeFor(saved, catalogue.find((x) => x.id === hold.id)!.plannedReps)).toBe(
      "DURATION",
    );
  });
});

describe("primary muscle classification for new additions", () => {
  it.each([
    ["triceps", "chest", "ARMS"],
    ["shoulders", "chest", "SHOULDERS"],
    ["quads", "back", "LEGS"],
    ["lateral deltoids", "triceps", "SHOULDERS"],
    ["calves", "core", "LEGS"],
    ["latissimus dorsi", "biceps", "BACK"],
    ["gluteus maximus", "back", "LEGS"],
    ["rectus abdominis", "shoulders", "CORE"],
    ["rear_delts", "triceps", "SHOULDERS"],
  ])("keeps %s primary despite %s support", (primary, secondary, group) => {
    expect(
      libraryExerciseToExercise({
        ...row,
        category: "PUSH",
        primary_muscles: [primary],
        secondary_muscles: [secondary],
      }).muscleGroup,
    ).toBe(group);
  });
});
