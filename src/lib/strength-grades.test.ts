import { describe, expect, it } from "vitest";

import {
  gradeExercise,
  GRADED_MUSCLES,
  personalBests,
  pointsToNextTier,
  STANDARDS,
  strengthReport,
  tierForScore,
  TIERS,
} from "./strength-grades";
import { EXERCISES } from "./exercises";
import { DEFAULT_STATE } from "./default-state";
import type { AppState, CompletedSet, Profile, WorkoutSession } from "./types";

const profile: Profile = {
  goal: "BULK",
  experience: "INTERMEDIATE",
  age: 28,
  weightKg: 80,
  heightCm: 180,
  gender: "MALE",
  daysPerWeek: 4,
  equipment: "FULL_GYM",
};

function session(exerciseId: string, name: string, sets: CompletedSet[]): WorkoutSession {
  return {
    id: `s-${exerciseId}`,
    date: "2026-08-20",
    dayKey: "MON",
    label: "PUSH",
    programId: null,
    startedAt: "2026-08-20T10:00:00.000Z",
    endedAt: "2026-08-20T11:00:00.000Z",
    exercises: [{ exerciseId, name, primary_muscles: [], targetSets: 3, targetReps: "5", sets }],
    totalVolume: 0,
    prCount: 0,
  };
}

function state(sessions: WorkoutSession[], overrides: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, profile, sessions, ...overrides };
}

const library = EXERCISES.map((e) => ({ id: e.id, name: e.name }));

describe("the standards table", () => {
  it("covers every exercise in the library", () => {
    const missing = EXERCISES.filter((e) => !STANDARDS[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("has strictly increasing thresholds — a ladder cannot go backwards", () => {
    for (const [id, standard] of Object.entries(STANDARDS)) {
      for (const table of [standard.male, standard.female]) {
        for (let i = 1; i < table.length; i += 1) {
          expect(table[i], `${id} threshold ${i}`).toBeGreaterThan(table[i - 1]!);
        }
      }
    }
  });
});

describe("personalBests", () => {
  it("takes the best estimated 1RM across sessions", () => {
    const bests = personalBests(
      state([
        session("bench-press", "Bench Press", [{ weight: 80, reps: 5 }]),
        { ...session("bench-press", "Bench Press", [{ weight: 100, reps: 3 }]), id: "s2" },
      ]),
    );
    expect(bests.get("bench-press")!.e1rmKg).toBeGreaterThan(105);
  });

  it("ignores warm-ups and drop sets", () => {
    const bests = personalBests(
      state([
        session("bench-press", "Bench Press", [
          { weight: 200, reps: 5, kind: "warmup" },
          { weight: 200, reps: 5, kind: "drop" },
          { weight: 60, reps: 5 },
        ]),
      ]),
    );
    expect(bests.get("bench-press")!.e1rmKg).toBeLessThan(80);
  });

  it("ignores sessions that were never finished", () => {
    const unfinished = {
      ...session("squat", "Back Squat", [{ weight: 300, reps: 5 }]),
      endedAt: undefined,
    };
    expect(personalBests(state([unfinished])).has("squat")).toBe(false);
  });

  it("records bodyweight reps separately from loaded work", () => {
    const bests = personalBests(
      state([session("pull-ups", "Pull Ups", [{ weight: 0, reps: 12 }])]),
    );
    expect(bests.get("pull-ups")).toMatchObject({ reps: 12, e1rmKg: 0 });
  });

  it("records the longest hold", () => {
    const bests = personalBests(
      state([
        session("plank", "Plank", [
          { weight: 0, reps: 0, mode: "duration", seconds: 45 },
          { weight: 0, reps: 0, mode: "duration", seconds: 95 },
        ]),
      ]),
    );
    expect(bests.get("plank")!.seconds).toBe(95);
  });
});

describe("gradeExercise", () => {
  const bests = { e1rmKg: 0, reps: 0, seconds: 0 };

  it("stays ungraded until the athlete chooses a strength reference", () => {
    expect(
      gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 100 }, 80, "OTHER"),
    ).toBeNull();
    expect(gradeExercise("pull-ups", "Pull Ups", { ...bests, reps: 15 }, 80, null)).toBeNull();
  });

  it("grades a loaded lift against bodyweight, not absolute load", () => {
    const light = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 100 }, 60, "MALE");
    const heavy = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 100 }, 120, "MALE");
    // The same 100 kg bench is a far better lift at 60 kg bodyweight.
    expect(light!.score).toBeGreaterThan(heavy!.score);
  });

  it("uses the women's table when the athlete is female", () => {
    const asWoman = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 60 }, 60, "FEMALE");
    const asMan = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 60 }, 60, "MALE");
    expect(TIERS.indexOf(asWoman!.tier)).toBeGreaterThan(TIERS.indexOf(asMan!.tier));
  });

  it("refuses to grade a ratio lift with no bodyweight rather than inventing one", () => {
    expect(gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 100 }, 0, "MALE")).toBeNull();
  });

  it("grades bodyweight movements on reps", () => {
    const grade = gradeExercise("pull-ups", "Pull Ups", { ...bests, reps: 15 }, 80, "MALE");
    expect(grade!.kind).toBe("REPS");
    expect(grade!.tier).toBe("ADVANCED");
  });

  it("grades holds on seconds", () => {
    const grade = gradeExercise("plank", "Plank", { ...bests, seconds: 130 }, 80, "MALE");
    expect(grade!.tier).toBe("ADVANCED");
  });

  it("reserves WORLD CLASS for a level above the published elite checkpoint", () => {
    const grade = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 400 }, 80, "MALE");
    expect(grade).toMatchObject({
      tier: "WORLD_CLASS",
      score: 100,
      nextAt: null,
      nextTier: null,
    });
  });

  it("keeps ELITE as a real tier with WORLD CLASS left to chase", () => {
    const grade = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 170 }, 80, "MALE");
    expect(grade).toMatchObject({ tier: "ELITE", nextTier: "WORLD_CLASS", nextAt: 192.5 });
  });

  it("starts at BEGINNER for a first light session", () => {
    const grade = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 20 }, 80, "MALE");
    expect(grade!.tier).toBe("BEGINNER");
    expect(grade!.score).toBeLessThan(20);
  });

  it("says exactly what the next tier costs", () => {
    const grade = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 70 }, 80, "MALE");
    // NOVICE entry is 0.75 x 80 = 60kg, so 70 is already past it; next is 1.25 x 80.
    expect(grade!.nextTier).toBe("INTERMEDIATE");
    expect(grade!.nextAt).toBe(100);
  });

  it("returns nothing for a movement with no standard", () => {
    expect(gradeExercise("made-up", "Nope", { ...bests, e1rmKg: 100 }, 80, "MALE")).toBeNull();
  });

  it("scores monotonically — more weight never lowers the grade", () => {
    let previous = -1;
    for (const e1rmKg of [20, 40, 60, 80, 100, 140, 180, 220]) {
      const grade = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg }, 80, "MALE")!;
      expect(grade.score).toBeGreaterThanOrEqual(previous);
      previous = grade.score;
    }
  });
});

describe("strengthReport", () => {
  it("keeps the full report ungraded until bodyweight and reference are set", () => {
    const trained = [session("pull-ups", "Pull Ups", [{ weight: 0, reps: 20 }])];
    const missingWeight = strengthReport(
      state(trained, { profile: { ...profile, weightKg: 0 } }),
      library,
    );
    const missingReference = strengthReport(
      state(trained, { profile: { ...profile, gender: "OTHER" } }),
      library,
    );
    expect(missingWeight.gradedCount).toBe(0);
    expect(missingReference.gradedCount).toBe(0);
    expect(missingReference.ungraded).toEqual(GRADED_MUSCLES);
  });

  it("reports nothing graded for a brand-new account", () => {
    const report = strengthReport(state([]), library);
    expect(report.muscles).toEqual([]);
    expect(report.gradedCount).toBe(0);
    expect(report.ungraded.length).toBeGreaterThan(0);
  });

  it("grades a muscle from the movements actually trained", () => {
    const report = strengthReport(
      state([session("bench-press", "Bench Press", [{ weight: 100, reps: 5 }])]),
      library,
    );
    const chest = report.muscles.find((m) => m.muscle === "CHEST");
    expect(chest).toBeTruthy();
    expect(chest!.exercises).toHaveLength(1);
    expect(report.ungraded).not.toContain("CHEST");
  });

  it("averages rather than flattering — one elite lift is not a strong muscle", () => {
    const report = strengthReport(
      state([
        session("bench-press", "Bench Press", [{ weight: 200, reps: 5 }]),
        { ...session("cable-fly", "Cable Fly", [{ weight: 5, reps: 10 }]), id: "s2" },
      ]),
      library,
    );
    const chest = report.muscles.find((m) => m.muscle === "CHEST")!;
    expect(chest.tier).not.toBe("WORLD_CLASS");
    expect(chest.weakest!.exerciseId).toBe("cable-fly");
  });

  it("names the movement holding a muscle back", () => {
    const report = strengthReport(
      state([
        session("squat", "Back Squat", [{ weight: 180, reps: 3 }]),
        { ...session("leg-curl", "Leg Curl", [{ weight: 10, reps: 10 }]), id: "s2" },
      ]),
      library,
    );
    expect(report.muscles.find((m) => m.muscle === "LEGS")!.weakest!.exerciseId).toBe("leg-curl");
  });

  it("grades a recognised custom weighted exercise into its muscle group", () => {
    const report = strengthReport(
      state([session("custom-chest-press", "Custom Chest Press", [{ weight: 70, reps: 8 }])]),
      [{ id: "custom-chest-press", name: "Custom Chest Press", muscleGroup: "CHEST" }],
    );
    expect(
      report.muscles.find((muscle) => muscle.muscle === "CHEST")?.exercises[0]?.exerciseId,
    ).toBe("custom-chest-press");
  });

  it("keeps the overall score inside the ladder", () => {
    const report = strengthReport(
      state([session("bench-press", "Bench Press", [{ weight: 400, reps: 10 }])]),
      library,
    );
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});

describe("tierForScore", () => {
  it("maps the ends of the range to the ends of the ladder", () => {
    expect(tierForScore(0)).toBe("BEGINNER");
    expect(tierForScore(100)).toBe("WORLD_CLASS");
  });

  it("keeps the rounded six-tier boundaries aligned with exercise scores", () => {
    expect(tierForScore(16)).toBe("BEGINNER");
    expect(tierForScore(17)).toBe("NOVICE");
    expect(tierForScore(33)).toBe("INTERMEDIATE");
    expect(tierForScore(82)).toBe("ELITE");
    expect(tierForScore(83)).toBe("WORLD_CLASS");
  });

  it("clamps nonsense instead of returning undefined", () => {
    expect(tierForScore(-50)).toBe("BEGINNER");
    expect(tierForScore(9999)).toBe("WORLD_CLASS");
  });

  it("says what the next tier costs, and nothing at the top", () => {
    expect(pointsToNextTier(10)!.tier).toBe("NOVICE");
    expect(pointsToNextTier(100)).toBeNull();
  });
});
