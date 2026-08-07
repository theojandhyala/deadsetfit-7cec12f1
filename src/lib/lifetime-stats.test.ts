import { describe, it, expect } from "vitest";

import { lifetimeStats, longestStreak, tonnageEquivalent } from "./lifetime-stats";
import type { WorkoutSession } from "./types";

function session(over: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: "s1",
    date: "2026-07-01",
    dayKey: "MON",
    label: "Push",
    programId: null,
    startedAt: "2026-07-01T10:00:00Z",
    endedAt: "2026-07-01T11:00:00Z",
    totalVolume: 0,
    prCount: 0,
    exercises: [],
    ...over,
  } as WorkoutSession;
}

describe("lifetimeStats", () => {
  it("returns null with no finished sessions", () => {
    expect(lifetimeStats([], [])).toBeNull();
    expect(lifetimeStats([session({ endedAt: undefined })], [])).toBeNull();
  });

  it("totals volume, sets and reps from working sets only", () => {
    const s = session({
      exercises: [
        {
          exerciseId: "e1",
          name: "Bench Press",
          primary_muscles: ["chest"],
          targetSets: 3,
          targetReps: "8",
          sets: [
            { weight: 60, reps: 8, kind: "warmup" },
            { weight: 100, reps: 8 },
            { weight: 100, reps: 6 },
          ],
        },
      ],
    });
    const r = lifetimeStats([s], ["2026-07-01"])!;
    expect(r.totalVolumeKg).toBe(1400);
    expect(r.totalSets).toBe(2);
    expect(r.totalReps).toBe(14);
    expect(r.heaviestSet).toEqual({ name: "Bench Press", weight: 100, reps: 8 });
    expect(r.topExercise).toEqual({ name: "Bench Press", sets: 2 });
    expect(r.hoursTrained).toBe(1);
    expect(r.firstSessionDate).toBe("2026-07-01");
  });

  it("clamps a session accidentally left running", () => {
    const s = session({ endedAt: "2026-07-03T10:00:00Z" }); // 48h "session"
    const r = lifetimeStats([s], [])!;
    expect(r.hoursTrained).toBe(4);
  });
});

describe("longestStreak", () => {
  it("finds the longest consecutive run", () => {
    expect(
      longestStreak(["2026-07-01", "2026-07-02", "2026-07-04", "2026-07-05", "2026-07-06"]),
    ).toBe(3);
  });
  it("handles duplicates and empties", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(["2026-07-01", "2026-07-01"])).toBe(1);
  });
});

describe("tonnageEquivalent", () => {
  it("picks the largest object out-lifted at least once", () => {
    expect(tonnageEquivalent(100)).toBeNull();
    expect(tonnageEquivalent(500)).toEqual({ count: 1, label: "grand piano" });
    expect(tonnageEquivalent(4600)).toEqual({ count: 3, label: "family cars" });
    expect(tonnageEquivalent(300_000)).toEqual({ count: 2, label: "blue whales" });
  });
});
