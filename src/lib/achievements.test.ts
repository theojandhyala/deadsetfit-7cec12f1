import { describe, it, expect } from "vitest";

import {
  ACHIEVEMENT_COUNT,
  achievementById,
  achievementFacts,
  achievements,
  unlockedIds,
} from "./achievements";
import { DEFAULT_STATE } from "./default-state";
import type { AppState, CompletedSet, WorkoutSession } from "./types";

function session(over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s-${Math.round(over.totalVolume ?? 0)}-${over.date ?? "d"}`,
    date: "2026-07-01",
    dayKey: "MON",
    label: "Push",
    programId: null,
    startedAt: "2026-07-01T10:00:00",
    endedAt: "2026-07-01T11:00:00",
    totalVolume: 0,
    prCount: 0,
    exercises: [],
    ...over,
  } as WorkoutSession;
}

function lift(name: string, sets: CompletedSet[], exerciseId = name.toLowerCase()) {
  return { exerciseId, name, primary_muscles: [], targetSets: sets.length, targetReps: "5", sets };
}

function state(over: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, ...over };
}

const find = (list: ReturnType<typeof achievements>, id: string) => {
  const hit = list.find((a) => a.id === id);
  if (!hit) throw new Error(`no achievement ${id}`);
  return hit;
};

describe("catalog", () => {
  it("ships a substantial catalog", () => {
    expect(ACHIEVEMENT_COUNT).toBeGreaterThanOrEqual(60);
  });

  it("has no duplicate ids", () => {
    const ids = achievements(state()).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every achievement has a positive target", () => {
    for (const a of achievements(state())) expect(a.target).toBeGreaterThan(0);
  });
});

describe("empty state", () => {
  it("unlocks nothing and does not crash", () => {
    const list = achievements(state());
    expect(unlockedIds(list)).toEqual([]);
    expect(list.every((a) => a.progress === 0)).toBe(true);
  });
});

describe("progress", () => {
  it("tracks partial progress toward a locked badge", () => {
    const list = achievements(state({ sessions: [session(), session({ date: "2026-07-02" })] }));
    const ten = find(list, "sessions-10");
    expect(ten.progress).toBe(2);
    expect(ten.unlocked).toBe(false);
  });

  it("unlocks exactly at the threshold", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      session({ date: `2026-07-${String(i + 1).padStart(2, "0")}` }),
    );
    expect(find(achievements(state({ sessions })), "sessions-10").unlocked).toBe(true);
  });

  it("clamps progress to the target so a bar never overflows", () => {
    const sessions = Array.from({ length: 40 }, (_, i) =>
      session({ date: `2026-07-${String((i % 28) + 1).padStart(2, "0")}` }),
    );
    const ten = find(achievements(state({ sessions })), "sessions-10");
    expect(ten.progress).toBe(10);
  });

  it("ignores sessions that were never finished", () => {
    const list = achievements(state({ sessions: [session({ endedAt: undefined })] }));
    expect(find(list, "first-rep").unlocked).toBe(false);
  });
});

describe("strength facts", () => {
  it("excludes warm-up and drop sets from the heaviest lift", () => {
    const f = achievementFacts(
      state({
        sessions: [
          session({
            exercises: [
              lift("Bench Press", [
                { weight: 200, reps: 1, kind: "warmup" },
                { weight: 150, reps: 1, kind: "drop" },
                { weight: 100, reps: 5 },
              ]),
            ],
          }),
        ],
      }),
    );
    expect(f.heaviestSetKg).toBe(100);
  });

  it("scores bodyweight ratios against the athlete's weight", () => {
    const f = achievementFacts(
      state({
        profile: { ...(DEFAULT_STATE.profile ?? ({} as never)), weightKg: 80 } as never,
        sessions: [
          session({ exercises: [lift("Barbell Bench Press", [{ weight: 80, reps: 3 }])] }),
        ],
      }),
    );
    expect(f.benchRatio).toBeCloseTo(1);
  });

  it("reports a zero ratio when bodyweight is unknown", () => {
    const f = achievementFacts(
      state({ sessions: [session({ exercises: [lift("Bench", [{ weight: 100, reps: 1 }])] })] }),
    );
    expect(f.benchRatio).toBe(0);
  });
});

describe("timing facts", () => {
  it("counts sunrise and night sessions from local time", () => {
    const f = achievementFacts(
      state({
        sessions: [
          session({ startedAt: "2026-07-01T05:30:00" }),
          session({ date: "2026-07-02", startedAt: "2026-07-02T22:10:00" }),
          session({ date: "2026-07-03", startedAt: "2026-07-03T13:00:00" }),
        ],
      }),
    );
    expect(f.sessionsBefore7am).toBe(1);
    expect(f.sessionsAfter9pm).toBe(1);
  });

  it("counts weekend sessions", () => {
    // 2026-07-04 is a Saturday, 2026-07-05 a Sunday, 2026-07-06 a Monday.
    const f = achievementFacts(
      state({
        sessions: [
          session({ date: "2026-07-04", startedAt: "2026-07-04T10:00:00" }),
          session({ date: "2026-07-05", startedAt: "2026-07-05T10:00:00" }),
          session({ date: "2026-07-06", startedAt: "2026-07-06T10:00:00" }),
        ],
      }),
    );
    expect(f.weekendSessions).toBe(2);
  });
});

describe("nutrition facts", () => {
  it("counts a protein day against 1.6 g per kg of bodyweight", () => {
    const profile = { ...(DEFAULT_STATE.profile ?? ({} as never)), weightKg: 100 } as never;
    const day = (date: string, protein: number) => ({
      date,
      name: "meal",
      calories: 500,
      protein,
      carbs: 0,
      fats: 0,
    });
    const f = achievementFacts(
      state({ profile, foodLog: [day("2026-07-01", 160), day("2026-07-02", 100)] }),
    );
    expect(f.daysFoodLogged).toBe(2);
    expect(f.daysProteinHit).toBe(1);
  });

  it("counts a water day only once the daily target is cleared", () => {
    const f = achievementFacts(
      state({
        waterTargetMl: 2000,
        water: [
          { date: "2026-07-01", ml: 1200, at: "2026-07-01T09:00:00Z" },
          { date: "2026-07-01", ml: 900, at: "2026-07-01T15:00:00Z" },
          { date: "2026-07-02", ml: 500, at: "2026-07-02T09:00:00Z" },
        ],
      }),
    );
    expect(f.daysWaterHit).toBe(1);
  });
});

describe("variety facts", () => {
  it("counts distinct exercises and muscle groups", () => {
    const f = achievementFacts(
      state({
        sessions: [
          session({
            exercises: [
              lift("Bench Press", [{ weight: 60, reps: 5 }], "bench"),
              lift("Barbell Row", [{ weight: 60, reps: 5 }], "row"),
              lift("Bench Press", [{ weight: 60, reps: 5 }], "bench"),
            ],
          }),
        ],
      }),
    );
    expect(f.distinctExercises).toBe(2);
    expect(f.distinctMuscleGroups).toBe(2);
  });
});

describe("achievementById", () => {
  it("resolves a known badge as unlocked, for share cards", () => {
    const a = achievementById("first-rep", "kg");
    expect(a?.label).toBe("FIRST REP");
    expect(a?.unlocked).toBe(true);
  });

  it("returns null for an unknown id", () => {
    expect(achievementById("nope", "kg")).toBeNull();
  });
});
