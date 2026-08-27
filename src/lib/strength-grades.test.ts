import { describe, expect, it } from "vitest";

import {
  gradeExercise,
  strengthJourney,
  strengthReportAsOf,
  strengthTrend,
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

  it("has one threshold per tier above BEGINNER", () => {
    for (const [id, standard] of Object.entries(STANDARDS)) {
      expect(standard.male, id).toHaveLength(TIERS.length - 1);
      expect(standard.female, id).toHaveLength(TIERS.length - 1);
    }
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

  it("tops out at WORLD CLASS with nothing left to chase", () => {
    const grade = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 400 }, 80, "MALE");
    expect(grade).toMatchObject({ tier: "WORLD CLASS", score: 100, nextAt: null, nextTier: null });
  });

  it("keeps ELITE reachable below WORLD CLASS", () => {
    // 2.0x bodyweight bench enters ELITE; WORLD CLASS is 2.3x.
    const elite = gradeExercise("bench-press", "Bench", { ...bests, e1rmKg: 165 }, 80, "MALE");
    expect(elite!.tier).toBe("ELITE");
    expect(elite!.nextTier).toBe("WORLD CLASS");
    expect(elite!.nextAt).toBe(185);
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
    expect(chest.tier).not.toBe("ELITE");
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
    expect(tierForScore(100)).toBe("WORLD CLASS");
  });

  it("clamps nonsense instead of returning undefined", () => {
    expect(tierForScore(-50)).toBe("BEGINNER");
    expect(tierForScore(9999)).toBe("WORLD CLASS");
  });

  it("walks the whole ladder in order as the score climbs", () => {
    const seen = [0, 20, 40, 60, 80, 100].map(tierForScore);
    expect(seen).toEqual(TIERS);
  });

  it("says what the next tier costs, and nothing at the top", () => {
    expect(pointsToNextTier(10)!.tier).toBe("NOVICE");
    expect(pointsToNextTier(100)).toBeNull();
  });
});

/** A finished session on a specific day. */
function sessionOn(date: string, exerciseId: string, weight: number, reps: number): WorkoutSession {
  return {
    ...session(exerciseId, exerciseId, [{ weight, reps }]),
    id: `s-${date}-${exerciseId}-${weight}`,
    date,
    startedAt: `${date}T10:00:00.000Z`,
    endedAt: `${date}T11:00:00.000Z`,
  };
}

const NOW = new Date("2026-08-27T12:00:00.000Z");

describe("strengthReportAsOf", () => {
  it("hides work logged after the cutoff", () => {
    const sessions = [
      sessionOn("2026-08-10", "bench-press", 80, 5),
      sessionOn("2026-08-25", "bench-press", 120, 5),
    ];
    const early = strengthReportAsOf(state(sessions), library, "2026-08-15");
    const late = strengthReportAsOf(state(sessions), library, "2026-08-26");
    expect(late.score).toBeGreaterThan(early.score);
  });

  it("includes work logged on the cutoff day itself", () => {
    const report = strengthReportAsOf(
      state([sessionOn("2026-08-15", "bench-press", 100, 5)]),
      library,
      "2026-08-15",
    );
    expect(report.gradedCount).toBe(1);
  });

  it("reports nothing graded before the athlete had trained", () => {
    const report = strengthReportAsOf(
      state([sessionOn("2026-08-20", "bench-press", 100, 5)]),
      library,
      "2026-08-01",
    );
    expect(report.gradedCount).toBe(0);
  });
});

describe("strengthTrend", () => {
  it("reports the gain when a lift went up this week", () => {
    const trend = strengthTrend(
      state([
        sessionOn("2026-08-01", "bench-press", 80, 5),
        sessionOn("2026-08-25", "bench-press", 120, 5),
      ]),
      library,
      7,
      NOW,
    );
    expect(trend.overallChange).toBeGreaterThan(0);
    expect(trend.movers[0]!.muscle).toBe("CHEST");
    expect(trend.movers[0]!.change).toBeGreaterThan(0);
  });

  it("stays flat when nothing improved in the window", () => {
    const trend = strengthTrend(
      state([sessionOn("2026-08-01", "bench-press", 100, 5)]),
      library,
      7,
      NOW,
    );
    expect(trend.overallChange).toBe(0);
    expect(trend.movers).toEqual([]);
  });

  it("does not count a lighter session as going backwards", () => {
    // Grades are built from bests, so a deload week must not read as a loss.
    const trend = strengthTrend(
      state([
        sessionOn("2026-08-01", "bench-press", 120, 5),
        sessionOn("2026-08-25", "bench-press", 60, 5),
      ]),
      library,
      7,
      NOW,
    );
    expect(trend.overallChange).toBe(0);
  });

  it("counts a brand-new muscle as a gain from zero", () => {
    const trend = strengthTrend(state([sessionOn("2026-08-25", "squat", 140, 5)]), library, 7, NOW);
    const legs = trend.movers.find((m) => m.muscle === "LEGS")!;
    expect(legs.then).toBe(0);
    expect(legs.change).toBe(legs.now);
  });

  it("ranks the biggest gain first", () => {
    const trend = strengthTrend(
      state([
        sessionOn("2026-08-01", "bench-press", 60, 5),
        sessionOn("2026-08-01", "squat", 60, 5),
        sessionOn("2026-08-25", "squat", 180, 5),
        sessionOn("2026-08-25", "bench-press", 65, 5),
      ]),
      library,
      7,
      NOW,
    );
    expect(trend.movers[0]!.muscle).toBe("LEGS");
  });

  it("says which date it is comparing against", () => {
    expect(strengthTrend(state([]), library, 7, NOW).since).toBe("2026-08-20");
  });
});

describe("strengthJourney", () => {
  it("needs more than one session before it claims a journey", () => {
    const one = strengthJourney(
      state([sessionOn("2026-08-20", "bench-press", 100, 5)]),
      library,
      365,
      NOW,
    );
    expect(one.meaningful).toBe(false);
  });

  it("compares from the first session, not a year ago, for a new athlete", () => {
    // Eight weeks in, the "start" body should be their eight weeks — not
    // eleven months of empty body flattering the comparison.
    const journey = strengthJourney(
      state([
        sessionOn("2026-07-01", "bench-press", 60, 5),
        sessionOn("2026-08-25", "bench-press", 100, 5),
      ]),
      library,
      365,
      NOW,
    );
    expect(journey.startedOn).toBe("2026-07-01");
  });

  it("caps the window for a long-standing athlete", () => {
    const journey = strengthJourney(
      state([
        sessionOn("2020-01-01", "bench-press", 60, 5),
        sessionOn("2026-08-25", "bench-press", 160, 5),
      ]),
      library,
      365,
      NOW,
    );
    expect(journey.startedOn).toBe("2025-08-27");
  });

  it("names the muscles that climbed a tier", () => {
    const journey = strengthJourney(
      state([
        sessionOn("2026-07-01", "bench-press", 40, 5),
        sessionOn("2026-08-25", "bench-press", 160, 3),
      ]),
      library,
      365,
      NOW,
    );
    expect(journey.climbed).toContain("CHEST");
  });

  it("claims no climb when the grade did not move", () => {
    const journey = strengthJourney(
      state([
        sessionOn("2026-07-01", "bench-press", 100, 5),
        sessionOn("2026-08-25", "bench-press", 100, 5),
      ]),
      library,
      365,
      NOW,
    );
    expect(journey.climbed).toEqual([]);
  });

  it("treats a muscle trained for the first time as a climb", () => {
    const journey = strengthJourney(
      state([
        sessionOn("2026-07-01", "bench-press", 100, 5),
        sessionOn("2026-08-25", "squat", 140, 5),
      ]),
      library,
      365,
      NOW,
    );
    expect(journey.climbed).toContain("LEGS");
  });
});
