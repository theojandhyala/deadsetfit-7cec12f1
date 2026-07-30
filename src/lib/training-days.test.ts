import { describe, it, expect } from "vitest";

import { defaultSchedule, normaliseTrainingDays, WEEK } from "./calc";
import { daysPerWeekFor, describeDays } from "./training-days";
import type { DayKey, Profile } from "./types";

const base: Profile = {
  goal: "BULK",
  experience: "BEGINNER",
  age: 25,
  weightKg: 80,
  heightCm: 180,
  gender: "MALE",
  daysPerWeek: 3,
  equipment: "FULL_GYM",
};

const trainingDaysOf = (p: Profile): DayKey[] =>
  WEEK.filter((d) => defaultSchedule(p)[d].exerciseIds.length > 0);

describe("normaliseTrainingDays", () => {
  it("orders the chosen days by weekday", () => {
    expect(normaliseTrainingDays(["SAT", "MON", "WED"], 3)).toEqual(["MON", "WED", "SAT"]);
  });

  it("falls back to the legacy spread when nothing is chosen", () => {
    expect(normaliseTrainingDays(undefined, 3)).toEqual(["MON", "WED", "FRI"]);
    expect(normaliseTrainingDays([], 4)).toEqual(["MON", "TUE", "THU", "FRI"]);
  });
});

describe("defaultSchedule training days", () => {
  it("keeps the pre-existing spread for profiles saved before day-picking", () => {
    expect(trainingDaysOf(base)).toEqual(["MON", "WED", "FRI"]);
    expect(trainingDaysOf({ ...base, daysPerWeek: 4 })).toEqual(["MON", "TUE", "THU", "FRI"]);
    expect(trainingDaysOf({ ...base, daysPerWeek: 5 })).toEqual([
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
    ]);
  });

  it("places workouts on exactly the days the lifter picked", () => {
    const p = { ...base, trainingDays: ["TUE", "THU", "SAT"] as DayKey[] };
    expect(trainingDaysOf(p)).toEqual(["TUE", "THU", "SAT"]);
    expect(defaultSchedule(p).MON.label).toBe("REST");
    expect(defaultSchedule(p).SUN.label).toBe("REST");
  });

  it("supports a weekend-only week", () => {
    const p = { ...base, trainingDays: ["FRI", "SAT", "SUN"] as DayKey[] };
    expect(trainingDaysOf(p)).toEqual(["FRI", "SAT", "SUN"]);
  });

  it("rotates the split across the chosen days", () => {
    const s = defaultSchedule({
      ...base,
      daysPerWeek: 4,
      trainingDays: ["MON", "TUE", "THU", "SAT"],
    });
    expect(s.MON.label).toContain("UPPER");
    expect(s.TUE.label).toContain("LOWER");
    expect(s.THU.label).toContain("UPPER");
    expect(s.SAT.label).toContain("LOWER");
  });

  it("never shares an exerciseIds array between days", () => {
    const s = defaultSchedule({ ...base, trainingDays: ["MON", "WED", "FRI"] });
    s.MON.exerciseIds.push("sentinel");
    expect(s.WED.exerciseIds).not.toContain("sentinel");
  });
});

describe("training-days helpers", () => {
  it("clamps the day count into the range the split generator supports", () => {
    expect(daysPerWeekFor(["MON", "TUE"] as DayKey[])).toBe(3);
    expect(daysPerWeekFor(WEEK)).toBe(6);
    expect(daysPerWeekFor(["MON", "WED", "FRI", "SAT"] as DayKey[])).toBe(4);
  });

  it("reads the week back in plain English", () => {
    expect(describeDays(["MON", "WED", "FRI"])).toBe("Mon, Wed and Fri");
    expect(describeDays(["MON"])).toBe("Mon");
    expect(describeDays([])).toBe("no days yet");
  });
});
