import { describe, it, expect } from "vitest";

import { staleMuscles } from "./exercise-variety";
import type { Exercise, WorkoutSession } from "./types";

const TODAY = "2026-07-31";

const LIBRARY: Exercise[] = [
  {
    id: "bench",
    name: "Bench Press",
    muscleGroup: "CHEST",
    equipment: ["FULL_GYM"],
    skill: "BEGINNER",
    sets: 3,
    reps: "8",
    videoId: "",
    instruction: "",
  },
  {
    id: "incline-db",
    name: "Incline Dumbbell Press",
    muscleGroup: "CHEST",
    equipment: ["FULL_GYM", "HOME_GYM"],
    skill: "BEGINNER",
    sets: 3,
    reps: "10",
    videoId: "",
    instruction: "",
  },
  {
    id: "dips",
    name: "Chest Dips",
    muscleGroup: "CHEST",
    equipment: ["FULL_GYM", "BODYWEIGHT"],
    skill: "INTERMEDIATE",
    sets: 3,
    reps: "12",
    videoId: "",
    instruction: "",
  },
] as Exercise[];

function chestSession(date: string, name: string): WorkoutSession {
  return {
    id: date,
    date,
    dayKey: "MON",
    label: "Push",
    programId: null,
    startedAt: `${date}T10:00:00Z`,
    endedAt: `${date}T11:00:00Z`,
    totalVolume: 0,
    prCount: 0,
    exercises: [
      {
        exerciseId: name,
        name,
        primary_muscles: ["chest"],
        targetSets: 3,
        targetReps: "8",
        sets: [{ weight: 80, reps: 8 }],
      },
    ],
  } as WorkoutSession;
}

const SIX_DATES = [
  "2026-07-06",
  "2026-07-10",
  "2026-07-14",
  "2026-07-18",
  "2026-07-22",
  "2026-07-26",
];

describe("staleMuscles", () => {
  it("flags a muscle fed the same movement for 6+ sessions", () => {
    const sessions = SIX_DATES.map((d) => chestSession(d, "Bench Press"));
    const out = staleMuscles(sessions, LIBRARY, "FULL_GYM", TODAY);
    expect(out).toHaveLength(1);
    expect(out[0].muscle).toBe("CHEST");
    expect(out[0].exerciseName).toBe("Bench Press");
    expect(out[0].suggestions.map((s) => s.id)).toEqual(["incline-db", "dips"]);
  });

  it("stays quiet when variety exists or data is thin", () => {
    const varied = SIX_DATES.map((d, i) =>
      chestSession(d, i % 2 ? "Bench Press" : "Incline Dumbbell Press"),
    );
    expect(staleMuscles(varied, LIBRARY, "FULL_GYM", TODAY)).toHaveLength(0);
    const thin = SIX_DATES.slice(0, 3).map((d) => chestSession(d, "Bench Press"));
    expect(staleMuscles(thin, LIBRARY, "FULL_GYM", TODAY)).toHaveLength(0);
  });

  it("only suggests movements matching the athlete's equipment", () => {
    const sessions = SIX_DATES.map((d) => chestSession(d, "Bench Press"));
    const out = staleMuscles(sessions, LIBRARY, "BODYWEIGHT", TODAY);
    expect(out[0].suggestions.map((s) => s.id)).toEqual(["dips"]);
  });

  it("suggests nothing when the library has no alternative", () => {
    const sessions = SIX_DATES.map((d) => chestSession(d, "Bench Press"));
    const out = staleMuscles(sessions, [LIBRARY[0]], "FULL_GYM", TODAY);
    expect(out).toHaveLength(0);
  });
});
