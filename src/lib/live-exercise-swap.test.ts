import { describe, expect, it } from "vitest";

import { liveExerciseSwapCandidates } from "./live-exercise-swap";
import type { Exercise } from "./types";

const exercise = (
  id: string,
  name: string,
  muscleGroup: Exercise["muscleGroup"],
  equipment: Exercise["equipment"],
): Exercise => ({
  id,
  name,
  muscleGroup,
  equipment,
  skill: "BEGINNER",
  sets: 3,
  reps: "8-12",
  videoId: "",
  instruction: "Controlled reps.",
});

const library = [
  exercise("bench", "Bench Press", "CHEST", ["FULL_GYM"]),
  exercise("incline-db", "Incline Dumbbell Press", "CHEST", ["HOME_GYM", "FULL_GYM"]),
  exercise("push-up", "Push Up", "CHEST", ["BODYWEIGHT"]),
  exercise("row", "Seated Row", "BACK", ["FULL_GYM"]),
  exercise("cable-fly", "Cable Fly", "CHEST", ["FULL_GYM"]),
];

describe("liveExerciseSwapCandidates", () => {
  it("offers only same-muscle alternatives that fit the athlete's equipment", () => {
    const candidates = liveExerciseSwapCandidates(library, {
      currentExerciseId: "bench",
      targetMuscles: ["chest"],
      availableEquipment: "HOME_GYM",
    });

    expect(candidates.map((item) => item.id)).toEqual(["incline-db", "push-up"]);
  });

  it("never duplicates another movement already planned in the live session", () => {
    const candidates = liveExerciseSwapCandidates(library, {
      currentExerciseId: "bench",
      targetMuscles: ["CHEST"],
      availableEquipment: "FULL_GYM",
      reservedExerciseIds: ["incline-db"],
    });

    expect(candidates.map((item) => item.id)).toEqual(["cable-fly", "push-up"]);
  });

  it("filters the alternatives without changing their relevance rules", () => {
    const candidates = liveExerciseSwapCandidates(library, {
      currentExerciseId: "bench",
      targetMuscles: ["CHEST"],
      availableEquipment: "FULL_GYM",
      query: "cable",
    });

    expect(candidates.map((item) => item.id)).toEqual(["cable-fly"]);
  });
});
