import { describe, expect, it } from "vitest";

import { buildWidgetSnapshot } from "./widgets";
import { DEFAULT_STATE } from "./default-state";
import type { AppState, DayKey, Profile, Schedule } from "./types";

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

const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function schedule(overrides: Partial<Record<DayKey, { label: string; exerciseIds: string[] }>>) {
  return Object.fromEntries(
    DAYS.map((day) => [day, overrides[day] ?? { label: "REST", exerciseIds: [] }]),
  ) as Schedule;
}

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, profile, ...overrides };
}

/** A Wednesday, so week maths has days either side of it. */
const WEDNESDAY = "2026-08-26";

describe("buildWidgetSnapshot", () => {
  it("reports a streak and that today is already done", () => {
    const snapshot = buildWidgetSnapshot(
      state({ completedDates: ["2026-08-24", "2026-08-25", "2026-08-26"] }),
      WEDNESDAY,
    );
    expect(snapshot.streak).toBeGreaterThanOrEqual(0);
    expect(snapshot.trainedToday).toBe(true);
  });

  it("does not claim today is done when it is not", () => {
    const snapshot = buildWidgetSnapshot(
      state({ completedDates: ["2026-08-24", "2026-08-25"] }),
      WEDNESDAY,
    );
    expect(snapshot.trainedToday).toBe(false);
  });

  it("counts only sessions inside the current Monday-start week", () => {
    const snapshot = buildWidgetSnapshot(
      state({
        completedDates: [
          "2026-08-23", // the Sunday before — previous week
          "2026-08-24", // Monday
          "2026-08-26", // Wednesday
          "2026-08-31", // the following Monday
        ],
      }),
      WEDNESDAY,
    );
    expect(snapshot.weekDone).toBe(2);
  });

  it("takes the weekly target from the athlete's own plan", () => {
    expect(buildWidgetSnapshot(state(), WEDNESDAY).weekTarget).toBe(4);
  });

  it("treats a day with no movements as a rest day", () => {
    const snapshot = buildWidgetSnapshot(state({ schedule: schedule({}) }), WEDNESDAY);
    expect(snapshot.todayLabel).toBe("");
    expect(snapshot.todayExerciseCount).toBe(0);
  });

  it("reports a scheduled day by name with its movement count", () => {
    const today = DAYS[(new Date().getDay() + 6) % 7]!;
    const snapshot = buildWidgetSnapshot(
      state({ schedule: schedule({ [today]: { label: "PUSH", exerciseIds: ["a", "b", "c"] } }) }),
      WEDNESDAY,
    );
    expect(snapshot.todayLabel).toBe("PUSH");
    expect(snapshot.todayExerciseCount).toBe(3);
  });

  it("carries a rank label and a colour the widget can parse", () => {
    const snapshot = buildWidgetSnapshot(state(), WEDNESDAY);
    expect(snapshot.rankLabel.length).toBeGreaterThan(0);
    expect(snapshot.rankColorHex).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("keeps rank progress inside 0 to 1", () => {
    for (const dates of [
      [],
      ["2026-08-26"],
      Array.from({ length: 400 }, (_, i) => `2026-01-${i}`),
    ]) {
      const snapshot = buildWidgetSnapshot(state({ completedDates: dates }), WEDNESDAY);
      expect(snapshot.rankProgress).toBeGreaterThanOrEqual(0);
      expect(snapshot.rankProgress).toBeLessThanOrEqual(1);
    }
  });

  it("survives an account with no profile at all", () => {
    const snapshot = buildWidgetSnapshot({ ...DEFAULT_STATE, profile: null }, WEDNESDAY);
    expect(snapshot.weekTarget).toBe(0);
    expect(snapshot.todayExerciseCount).toBe(0);
  });

  it("does not fall over on a malformed date", () => {
    expect(() => buildWidgetSnapshot(state(), "not-a-date")).not.toThrow();
  });
});
