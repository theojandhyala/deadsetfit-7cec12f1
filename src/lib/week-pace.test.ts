import { describe, it, expect } from "vitest";

import { weekPace } from "./week-pace";
import type { WorkoutSession } from "./types";

// 2026-07-31 is a Friday (weekday index 4, Monday-first).
const FRIDAY = "2026-07-31";

function session(date: string, weight: number): WorkoutSession {
  return {
    id: `${date}-${weight}`,
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
        targetSets: 1,
        targetReps: "10",
        sets: [{ weight, reps: 10 }],
      },
    ],
  } as WorkoutSession;
}

// Four past weeks, each with 1000 kg logged on its Monday and 1000 on its
// Saturday — so "usual by Friday" is 1000, full week 2000.
function history(): WorkoutSession[] {
  const out: WorkoutSession[] = [];
  for (const monday of ["2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20"]) {
    out.push(session(monday, 100)); // Monday: 1000 kg
    const sat = new Date(`${monday}T00:00:00Z`);
    sat.setUTCDate(sat.getUTCDate() + 5);
    out.push(session(sat.toISOString().slice(0, 10), 100)); // Saturday: 1000 kg
  }
  return out;
}

describe("weekPace", () => {
  it("stays silent on Monday/Tuesday and with thin history", () => {
    expect(weekPace(history(), "2026-07-27")).toBeNull(); // Monday
    expect(weekPace([session("2026-07-27", 100)], FRIDAY)).toBeNull();
  });

  it("flags a week running ahead of the usual pace", () => {
    const sessions = [...history(), session("2026-07-28", 100), session("2026-07-30", 100)];
    const r = weekPace(sessions, FRIDAY)!;
    expect(r.usualKg).toBe(1000);
    expect(r.currentKg).toBe(2000);
    expect(r.pct).toBe(200);
    expect(r.verdict).toBe("AHEAD");
  });

  it("flags a quiet week as behind", () => {
    const r = weekPace(history(), FRIDAY)!;
    expect(r.currentKg).toBe(0);
    expect(r.verdict).toBe("BEHIND");
  });

  it("ignores fully-untrained weeks when computing the usual", () => {
    // Same history plus 4 empty weeks before it — usual must stay 1000.
    const r = weekPace(history(), FRIDAY, 12)!;
    expect(r.usualKg).toBe(1000);
  });
});
