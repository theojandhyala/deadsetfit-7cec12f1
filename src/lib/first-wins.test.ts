import { describe, expect, it } from "vitest";

import { DEFAULT_STATE } from "./default-state";
import { getFirstWinSteps } from "./first-wins";
import type { AppState, Schedule } from "./types";

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...DEFAULT_STATE, ...overrides };
}

function readySchedule(): Schedule {
  return {
    MON: { label: "PUSH", exerciseIds: ["bench"] },
    TUE: { label: "REST", exerciseIds: [] },
    WED: { label: "REST", exerciseIds: [] },
    THU: { label: "REST", exerciseIds: [] },
    FRI: { label: "REST", exerciseIds: [] },
    SAT: { label: "REST", exerciseIds: [] },
    SUN: { label: "REST", exerciseIds: [] },
  };
}

describe("getFirstWinSteps", () => {
  it("starts with four incomplete actions for an empty account", () => {
    expect(getFirstWinSteps(state()).map((step) => step.done)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("recognizes a usable weekly plan", () => {
    const steps = getFirstWinSteps(state({ schedule: readySchedule() }));
    expect(steps.find((step) => step.id === "PLAN")?.done).toBe(true);
  });

  it("counts imported or historical training as a completed first workout", () => {
    const steps = getFirstWinSteps(state({ completedDates: ["2026-08-20"] }));
    expect(steps.find((step) => step.id === "WORKOUT")?.done).toBe(true);
  });

  it("completes every first win from real account data", () => {
    const steps = getFirstWinSteps(
      state({
        schedule: readySchedule(),
        completedDates: ["2026-08-20"],
        foodLog: [
          { date: "2026-08-20", name: "Lunch", calories: 600, protein: 40, carbs: 60, fats: 20 },
        ],
        weights: [{ date: "2026-08-20", weight: 80 }],
      }),
    );
    expect(steps.every((step) => step.done)).toBe(true);
  });
});
