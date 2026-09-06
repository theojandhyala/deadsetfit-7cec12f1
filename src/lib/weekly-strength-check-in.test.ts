import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import type { AppState, DayKey, Profile, Schedule } from "./types";
import {
  applyWeeklyStrengthCheckIn,
  snoozeWeeklyStrengthCheckIn,
  weeklyStrengthCheckInDue,
  weeklyStrengthCheckInRows,
} from "./weekly-strength-check-in";

const profile: Profile = {
  goal: "BULK",
  experience: "INTERMEDIATE",
  age: 25,
  weightKg: 80,
  heightCm: 180,
  gender: "MALE",
  daysPerWeek: 3,
  equipment: "FULL_GYM",
};

function scheduleWith(entries: Partial<Record<DayKey, Schedule[DayKey]>>): Schedule {
  const days: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return Object.fromEntries(
    days.map((day) => [day, entries[day] ?? { label: "REST", exerciseIds: [] }]),
  ) as Schedule;
}

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, profile, ...overrides };
}

describe("weeklyStrengthCheckInRows", () => {
  it("asks once for a repeated movement and carries its current plan load", () => {
    const rows = weeklyStrengthCheckInRows(
      state({
        schedule: scheduleWith({
          MON: {
            label: "PUSH",
            exerciseIds: ["bench-press"],
            exerciseConfig: { "bench-press": { weightKg: 80, reps: "8" } },
          },
          FRI: {
            label: "UPPER",
            exerciseIds: ["bench-press"],
            exerciseConfig: { "bench-press": { weightKg: 82.5, reps: "6" } },
          },
        }),
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      exerciseId: "bench-press",
      days: ["MON", "FRI"],
      plannedWeightKg: 82.5,
      kind: "RATIO",
    });
  });

  it("includes bodyweight reps and timed holds because they can colour the map", () => {
    const rows = weeklyStrengthCheckInRows(
      state({
        schedule: scheduleWith({
          MON: { label: "BODY", exerciseIds: ["push-ups", "plank"] },
        }),
      }),
    );

    expect(rows.map(({ exerciseId, kind }) => ({ exerciseId, kind }))).toEqual([
      { exerciseId: "push-ups", kind: "REPS" },
      { exerciseId: "plank", kind: "SECONDS" },
    ]);
  });

  it("uses only the active programme when one is selected", () => {
    const days = Object.fromEntries(
      (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as DayKey[]).map((day) => [
        day,
        {
          label: day === "MON" ? "LEGS" : "REST",
          items:
            day === "MON"
              ? [
                  {
                    id: "squat",
                    name: "Back Squat",
                    equipment: "barbell",
                    primary_muscles: ["quads"],
                    youtube_query: "squat",
                    sets: 3,
                    reps: "5",
                    weightKg: 100,
                  },
                ]
              : [],
        },
      ]),
    ) as never;
    const rows = weeklyStrengthCheckInRows(
      state({
        schedule: scheduleWith({ MON: { label: "PUSH", exerciseIds: ["bench-press"] } }),
        activeProgramId: "active",
        programs: [
          { id: "active", name: "Active", splitType: "CUSTOM", createdAt: "2026-08-01", days },
        ],
      }),
    );

    expect(rows.map((row) => row.exerciseId)).toEqual(["squat"]);
  });
});

describe("applyWeeklyStrengthCheckIn", () => {
  it("updates every repeated plan load and the dated map reference together", () => {
    const initial = state({
      schedule: scheduleWith({
        MON: { label: "PUSH", exerciseIds: ["bench-press"] },
        FRI: { label: "UPPER", exerciseIds: ["bench-press"] },
      }),
    });
    const next = applyWeeklyStrengthCheckIn(
      initial,
      [{ exerciseId: "bench-press", kind: "RATIO", value: 90, reps: 6 }],
      new Date("2026-08-28T12:00:00.000Z"),
    );

    expect(next.schedule?.MON.exerciseConfig?.["bench-press"]?.weightKg).toBe(90);
    expect(next.schedule?.FRI.exerciseConfig?.["bench-press"]?.weightKg).toBe(90);
    expect(next.manualPRs?.["bench-press"]).toEqual({
      value: 90,
      reps: 6,
      date: "2026-08-28T12:00:00.000Z",
    });
    expect(next.strengthCheckIn).toMatchObject({
      lastCompletedAt: "2026-08-28T12:00:00.000Z",
      completedCount: 1,
    });
  });
});

describe("weeklyStrengthCheckInDue", () => {
  const now = Date.parse("2026-08-28T12:00:00.000Z");

  it("opens for existing athletes who have never completed it", () => {
    expect(weeklyStrengthCheckInDue(state(), now)).toBe(true);
  });

  it("returns once seven days have passed", () => {
    const recent = state({
      strengthCheckIn: { lastCompletedAt: "2026-08-22T12:00:00.000Z" },
    });
    const old = state({
      strengthCheckIn: { lastCompletedAt: "2026-08-21T11:59:59.000Z" },
    });
    expect(weeklyStrengthCheckInDue(recent, now)).toBe(false);
    expect(weeklyStrengthCheckInDue(old, now)).toBe(true);
  });

  it("honours the one-day reminder snooze", () => {
    const snoozed = snoozeWeeklyStrengthCheckIn(state(), now);
    expect(weeklyStrengthCheckInDue(snoozed, now + 23 * 60 * 60 * 1000)).toBe(false);
    expect(weeklyStrengthCheckInDue(snoozed, now + 25 * 60 * 60 * 1000)).toBe(true);
  });
});
