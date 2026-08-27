import { describe, it, expect } from "vitest";

import { repZoneMix } from "./rep-zones";
import type { WorkoutSession } from "./types";

const TODAY = "2026-07-31";

function sessionWithReps(date: string, repsList: number[]): WorkoutSession {
  return {
    id: date,
    date,
    dayKey: "MON",
    label: "Day",
    programId: null,
    startedAt: `${date}T10:00:00Z`,
    endedAt: `${date}T11:00:00Z`,
    totalVolume: 0,
    prCount: 0,
    exercises: [
      {
        exerciseId: "e1",
        name: "Lift",
        primary_muscles: [],
        targetSets: repsList.length,
        targetReps: "8",
        sets: repsList.map((reps) => ({ weight: 50, reps })),
      },
    ],
  } as WorkoutSession;
}

describe("repZoneMix", () => {
  it("refuses with fewer than 20 working sets", () => {
    expect(repZoneMix([sessionWithReps("2026-07-30", [8, 8, 8])], "BULK", TODAY)).toBeNull();
  });

  it("classifies zones and flags a mismatch against the goal", () => {
    // 24 sets, all triples — a strength mix under a BULK goal.
    const sessions = [
      sessionWithReps("2026-07-28", Array(12).fill(3)),
      sessionWithReps("2026-07-30", Array(12).fill(3)),
    ];
    const r = repZoneMix(sessions, "BULK", TODAY)!;
    expect(r.totalSets).toBe(24);
    expect(r.pct.STRENGTH).toBe(100);
    expect(r.dominant).toBe("STRENGTH");
    expect(r.targetZone).toBe("BUILD");
    expect(r.aligned).toBe(false);
  });

  it("percentages always sum to 100", () => {
    const sessions = [
      sessionWithReps(
        "2026-07-28",
        [3, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8, 8, 8, 15, 15, 15, 15, 15, 15, 15],
      ),
    ];
    const r = repZoneMix(sessions, "BULK", TODAY)!;
    expect(r.pct.STRENGTH + r.pct.BUILD + r.pct.ENDURANCE).toBe(100);
    expect(r.dominant).toBe("STRENGTH");
  });

  it("aligned when the mix matches an ATHLETIC goal", () => {
    const sessions = [
      sessionWithReps("2026-07-28", Array(12).fill(4)),
      sessionWithReps("2026-07-30", Array(12).fill(4)),
    ];
    const r = repZoneMix(sessions, "ATHLETIC", TODAY)!;
    expect(r.aligned).toBe(true);
  });

  it("ignores sessions outside the window and unfinished ones", () => {
    const old = sessionWithReps("2026-05-01", Array(30).fill(8));
    const open = { ...sessionWithReps("2026-07-30", Array(30).fill(8)), endedAt: undefined };
    expect(repZoneMix([old, open], "BULK", TODAY)).toBeNull();
  });
});
