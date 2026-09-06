import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import type { LibraryExercise } from "./library.functions";
import { addGrowthRecommendationToDay, growthExerciseIsOnDay } from "./muscle-growth-plan";
import { setVolume, trackingModeFor } from "./set-tracking";
import type { AppState, Profile, Program } from "./types";

const PROFILE: Profile = {
  goal: "BULK",
  experience: "INTERMEDIATE",
  age: 25,
  weightKg: 80,
  heightCm: 180,
  gender: "MALE",
  daysPerWeek: 4,
  equipment: "FULL_GYM",
};

const PULLDOWN: LibraryExercise = {
  id: "library-lat-pulldown",
  slug: "lat-pulldown",
  name: "Lat Pulldown",
  category: "PULL",
  primary_muscles: ["lats"],
  secondary_muscles: ["biceps"],
  equipment: "CABLE",
  difficulty: 2,
  instructions: "Pull to the upper chest.",
  pro_tip: "Lead with the elbows.",
  youtube_query: "lat pulldown form",
  warmup_note: "",
  stretch_note: "",
  is_compound: true,
};

function state(partial: Partial<AppState> = {}): AppState {
  return {
    ...DEFAULT_STATE,
    profile: PROFILE,
    savedExercises: [],
    programs: [],
    ...partial,
  };
}

function emptyProgram(): Program {
  const rest = () => ({ label: "REST", items: [] });
  return {
    id: "programme-1",
    name: "My programme",
    splitType: "CUSTOM",
    createdAt: "2026-08-27T00:00:00.000Z",
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
}

describe("addGrowthRecommendationToDay", () => {
  it("adds to the active programme because it owns the training week", () => {
    const programme = emptyProgram();
    const initial = state({ programs: [programme], activeProgramId: programme.id });
    const result = addGrowthRecommendationToDay(initial, "MON", {
      exercise: PULLDOWN,
      sets: 4,
      reps: "8-12",
      restSeconds: 120,
    });

    expect(result.status).toBe("ADDED");
    expect(result.destination).toBe("PROGRAM");
    expect(result.state.programs[0]!.days.MON.items[0]).toMatchObject({
      id: PULLDOWN.id,
      sets: 4,
      reps: "8-12",
      restSeconds: 120,
      primary_muscles: ["lats"],
    });
    expect(result.state.programs[0]!.days.MON.label).toBe("BACK");
    expect(result.state.savedExercises).toHaveLength(1);
    expect(result.state.schedule).toBeNull();
  });

  it("adds to the schedule with its prescribed sets and reps", () => {
    const result = addGrowthRecommendationToDay(state(), "TUE", {
      exercise: PULLDOWN,
      sets: 3,
      reps: "10-15",
      restSeconds: 75,
    });

    expect(result.status).toBe("ADDED");
    expect(result.destination).toBe("SCHEDULE");
    expect(result.state.schedule!.TUE.exerciseIds).toContain(PULLDOWN.id);
    expect(result.state.schedule!.TUE.exerciseConfig?.[PULLDOWN.id]).toMatchObject({
      sets: 3,
      reps: "10-15",
      restSeconds: 75,
    });
  });

  it("recognises exercises on the generated schedule before it has been persisted", () => {
    const initial = state();
    const generated = addGrowthRecommendationToDay(initial, "TUE", {
      exercise: PULLDOWN,
      sets: 3,
      reps: "10-15",
    });
    const existingId = generated.state.schedule!.TUE.exerciseIds.find(
      (exerciseId) => exerciseId !== PULLDOWN.id,
    );

    expect(existingId).toBeTruthy();
    expect(growthExerciseIsOnDay(initial, "TUE", existingId!)).toBe(true);
  });

  it("does not copy a built-in catalogue exercise into saved custom exercises", () => {
    const bench: LibraryExercise = {
      ...PULLDOWN,
      id: "bench-press",
      slug: "bench-press",
      name: "Bench Press",
      category: "PUSH",
      primary_muscles: ["chest"],
      secondary_muscles: ["triceps", "front delts"],
      equipment: "BARBELL",
    };
    const result = addGrowthRecommendationToDay(state(), "WED", {
      exercise: bench,
      sets: 4,
      reps: "6-10",
    });

    expect(result.status).toBe("ADDED");
    expect(result.state.savedExercises).toEqual([]);
    expect(result.state.schedule!.WED.exerciseIds).toContain("bench-press");
  });

  it("does not duplicate the same exercise on one day", () => {
    const first = addGrowthRecommendationToDay(state(), "TUE", {
      exercise: PULLDOWN,
      sets: 3,
      reps: "10-15",
    });
    const second = addGrowthRecommendationToDay(first.state, "TUE", {
      exercise: PULLDOWN,
      sets: 5,
      reps: "5-8",
    });

    expect(second.status).toBe("ALREADY_ADDED");
    expect(second.state.schedule!.TUE.exerciseIds.filter((id) => id === PULLDOWN.id)).toHaveLength(
      1,
    );
    expect(second.state.schedule!.TUE.exerciseConfig?.[PULLDOWN.id]?.sets).toBe(3);
  });

  it("refuses a same-name duplicate with a different catalogue id", () => {
    const first = addGrowthRecommendationToDay(state(), "TUE", {
      exercise: PULLDOWN,
      sets: 3,
      reps: "10-15",
    });
    const duplicate = { ...PULLDOWN, id: "another-database-id", name: "Lat  Pulldown" };
    const second = addGrowthRecommendationToDay(first.state, "TUE", {
      exercise: duplicate,
      sets: 4,
      reps: "8-12",
    });

    expect(second.status).toBe("ALREADY_ADDED");
    expect(second.state.schedule!.TUE.exerciseIds).toContain(PULLDOWN.id);
    expect(second.state.schedule!.TUE.exerciseIds).not.toContain(duplicate.id);
    expect(second.state.schedule!.TUE.exerciseIds.filter((id) => id === PULLDOWN.id)).toHaveLength(
      1,
    );
    expect(growthExerciseIsOnDay(first.state, "TUE", duplicate.id, duplicate.name)).toBe(true);
  });

  it("copies a known working weight only when the exact exercise repeats on another day", () => {
    const unique = {
      ...PULLDOWN,
      id: "library-kneeling-pulldown",
      name: "Kneeling One-Arm Pulldown",
    };
    const first = addGrowthRecommendationToDay(state(), "MON", {
      exercise: unique,
      sets: 3,
      reps: "10-12",
    });
    const weighted = {
      ...first.state,
      schedule: {
        ...first.state.schedule!,
        MON: {
          ...first.state.schedule!.MON,
          exerciseConfig: {
            ...first.state.schedule!.MON.exerciseConfig,
            [unique.id]: { sets: 3, reps: "10-12", weightKg: 55 },
          },
        },
      },
    };
    const repeated = addGrowthRecommendationToDay(weighted, "THU", {
      exercise: unique,
      sets: 4,
      reps: "8-12",
    });

    expect(repeated.state.schedule!.THU.exerciseConfig?.[unique.id]).toMatchObject({
      sets: 4,
      reps: "8-12",
      weightKg: 55,
    });
  });

  it("keeps timed recommendations on the duration logger's reps-zero volume path", () => {
    const hold: LibraryExercise = {
      ...PULLDOWN,
      id: "library-dead-hang",
      slug: "dead-hang",
      name: "Dead Hang",
      equipment: "BODYWEIGHT",
      primary_muscles: ["forearms", "lats"],
      is_compound: false,
    };
    const result = addGrowthRecommendationToDay(state(), "FRI", {
      exercise: hold,
      sets: 3,
      reps: "30-45s",
    });
    const stored = result.state.savedExercises.find((exercise) => exercise.id === hold.id);
    const reps = result.state.schedule!.FRI.exerciseConfig?.[hold.id]?.reps;

    expect(trackingModeFor(stored, reps)).toBe("DURATION");
    expect(setVolume({ mode: "duration", seconds: 45, weight: 0, reps: 0 })).toBe(0);
  });
});
