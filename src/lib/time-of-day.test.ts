import { describe, it, expect } from "vitest";

import { timeOfDay } from "./time-of-day";
import type { WorkoutSession } from "./types";

const TODAY = "2026-07-31";

function session(date: string, hour: string, weight: number, prCount = 0): WorkoutSession {
  return {
    id: `${date}-${hour}`,
    date,
    dayKey: "MON",
    label: "Day",
    programId: null,
    startedAt: `${date}T${hour}:00:00`,
    endedAt: `${date}T${hour}:59:00`,
    totalVolume: 0,
    prCount,
    exercises: [
      {
        exerciseId: "e1",
        name: "Lift",
        primary_muscles: [],
        targetSets: 1,
        targetReps: "10",
        sets: [{ weight, reps: 10 }],
      },
    ],
  } as WorkoutSession;
}

const DATES = [
  "2026-07-06",
  "2026-07-08",
  "2026-07-10",
  "2026-07-13",
  "2026-07-15",
  "2026-07-17",
  "2026-07-20",
  "2026-07-22",
];

describe("timeOfDay", () => {
  it("returns null under 8 sessions", () => {
    expect(timeOfDay([session("2026-07-20", "07", 100)], TODAY)).toBeNull();
  });

  it("finds the strongest slot and quantifies its edge", () => {
    // Four morning sessions at 1000 kg, four evening at 2000 kg.
    const sessions = [
      ...DATES.slice(0, 4).map((d) => session(d, "07", 100)),
      ...DATES.slice(4).map((d) => session(d, "19", 200, 1)),
    ];
    const r = timeOfDay(sessions, TODAY)!;
    expect(r.bestSlot).toBe("EVENING");
    const evening = r.slots.find((s) => s.slot === "EVENING")!;
    expect(evening.avgVolumeKg).toBe(2000);
    expect(evening.prs).toBe(4);
    expect(r.advice).toContain("evening");
    expect(r.advice).toContain("100%"); // 2000 vs 1000
  });

  it("stays silent when the edge is inside the noise band", () => {
    const sessions = [
      ...DATES.slice(0, 4).map((d) => session(d, "07", 100)),
      ...DATES.slice(4).map((d) => session(d, "19", 104)),
    ];
    const r = timeOfDay(sessions, TODAY)!;
    expect(r.advice).toBeNull();
  });

  it("needs three sessions before a slot can claim best", () => {
    const sessions = [
      ...DATES.slice(0, 6).map((d) => session(d, "07", 100)),
      ...DATES.slice(6).map((d) => session(d, "19", 500)), // only 2 evening
    ];
    const r = timeOfDay(sessions, TODAY)!;
    expect(r.bestSlot).toBe("MORNING");
  });
});
