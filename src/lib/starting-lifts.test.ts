import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import {
  applyStartingLifts,
  parseStartingLift,
  startingLiftOneRm,
  startingLiftRecords,
  startingWorkingWeight,
  STARTING_LIFTS,
} from "./starting-lifts";
import type { AppState, Schedule } from "./types";

describe("parseStartingLift", () => {
  it("reads a real set", () => {
    expect(parseStartingLift("squat", { weight: "100", reps: "5" }, "kg")).toEqual({
      exerciseId: "squat",
      weightKg: 100,
      reps: 5,
    });
  });

  it("converts from the athlete's own units", () => {
    const lift = parseStartingLift("bench-press", { weight: "225", reps: "3" }, "lb");
    expect(lift?.weightKg).toBeCloseTo(102.06, 1);
  });

  it("ignores a half-filled row rather than storing a lift of nothing", () => {
    // A weight with no reps used to be storable as a record; it would then be
    // graded as a set of zero repetitions.
    expect(parseStartingLift("squat", { weight: "100", reps: "" }, "kg")).toBeNull();
    expect(parseStartingLift("squat", { weight: "", reps: "5" }, "kg")).toBeNull();
    expect(parseStartingLift("squat", undefined, "kg")).toBeNull();
  });

  it("rejects values that are not a strength record", () => {
    // Epley is badly wrong past about 20 reps, and half a tonne is a typo.
    expect(parseStartingLift("squat", { weight: "100", reps: "40" }, "kg")).toBeNull();
    expect(parseStartingLift("squat", { weight: "900", reps: "5" }, "kg")).toBeNull();
    expect(parseStartingLift("squat", { weight: "-100", reps: "5" }, "kg")).toBeNull();
    expect(parseStartingLift("squat", { weight: "abc", reps: "5" }, "kg")).toBeNull();
  });

  it("rounds fractional reps to a whole set", () => {
    expect(parseStartingLift("squat", { weight: "100", reps: "5.6" }, "kg")?.reps).toBe(6);
  });
});

describe("startingLiftRecords", () => {
  it("stores the set performed, not an estimated max", () => {
    // The card and the Strength Map both run Epley over the stored pair. Storing
    // an estimate here would have it estimated twice and inflate every grade.
    const records = startingLiftRecords(
      [{ exerciseId: "squat", weightKg: 100, reps: 5 }],
      new Date("2026-03-04T10:00:00Z"),
    );
    expect(records.squat).toEqual({ value: 100, reps: 5, date: "2026-03-04" });
    expect(records.squat.value).toBeLessThan(
      startingLiftOneRm({
        exerciseId: "squat",
        weightKg: 100,
        reps: 5,
      }),
    );
  });
});

describe("startingWorkingWeight", () => {
  it("starts the week at the weight the athlete named, snapped to loadable", () => {
    // Deliberately not a percentage of an estimated max: they told us they can
    // do this weight, and anything derived on top is a guess dressed up as a
    // prescription.
    expect(startingWorkingWeight({ exerciseId: "squat", weightKg: 101, reps: 5 }, "kg")).toBe(100);
  });
});

function stateWithSchedule(): AppState {
  const schedule = {
    MON: { label: "Push", exerciseIds: ["bench-press", "ohp"] },
    TUE: { label: "Rest", exerciseIds: [] },
    WED: { label: "Legs", exerciseIds: ["squat"] },
    THU: { label: "Rest", exerciseIds: [] },
    FRI: { label: "Pull", exerciseIds: ["deadlift"] },
    SAT: { label: "Rest", exerciseIds: [] },
    SUN: { label: "Rest", exerciseIds: [] },
  } as unknown as Schedule;
  return { ...DEFAULT_STATE, schedule };
}

describe("applyStartingLifts", () => {
  it("seeds records and day-one loads together", () => {
    const next = applyStartingLifts(
      stateWithSchedule(),
      [{ exerciseId: "squat", weightKg: 100, reps: 5 }],
      "kg",
    );
    expect(next.manualPRs?.squat?.value).toBe(100);
    expect(next.schedule?.WED.exerciseConfig?.squat?.weightKg).toBe(100);
  });

  it("never overwrites a weight the athlete set by hand", () => {
    // Someone who chose BUILD may have typed loads on the schedule screen. A
    // declared lift must not silently replace a number they entered themselves.
    const base = stateWithSchedule();
    base.schedule!.WED.exerciseConfig = { squat: { weightKg: 80 } };
    const next = applyStartingLifts(base, [{ exerciseId: "squat", weightKg: 140, reps: 3 }], "kg");
    expect(next.schedule?.WED.exerciseConfig?.squat?.weightKg).toBe(80);
    // The record is still kept — it is a real lift, it just is not the load.
    expect(next.manualPRs?.squat?.value).toBe(140);
  });

  it("leaves state untouched when nothing was declared", () => {
    const base = stateWithSchedule();
    expect(applyStartingLifts(base, [], "kg")).toBe(base);
  });
});

describe("STARTING_LIFTS", () => {
  it("names exercises that exist, so a seeded load lands on a real movement", async () => {
    const { EXERCISES } = await import("./exercises");
    const ids = new Set(EXERCISES.map((exercise) => exercise.id));
    for (const lift of STARTING_LIFTS) expect(ids.has(lift.id)).toBe(true);
  });
});
