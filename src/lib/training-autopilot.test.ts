import { describe, expect, it } from "vitest";

import { applyAutopilotPlan, buildAutopilotPlan } from "./training-autopilot";
import type { AppState, CompletedSet, WorkoutSession } from "./types";

function session(date: string, weight: number, reps: number, rpe = 8): WorkoutSession {
  const sets: CompletedSet[] = [
    { weight, reps, rpe },
    { weight, reps, rpe },
    { weight, reps, rpe },
  ];
  return {
    id: date,
    date,
    dayKey: "MON",
    label: "PUSH",
    programId: null,
    startedAt: `${date}T10:00:00.000Z`,
    endedAt: `${date}T11:00:00.000Z`,
    exercises: [
      {
        exerciseId: "bench-press",
        name: "Bench Press",
        primary_muscles: ["CHEST"],
        targetSets: 3,
        targetReps: "8-12",
        sets,
      },
    ],
    totalVolume: weight * reps * 3,
    prCount: 0,
  };
}

function stateWith(sessions: WorkoutSession[]): AppState {
  return {
    profile: null,
    schedule: {
      MON: {
        label: "PUSH",
        exerciseIds: ["bench-press"],
        sets: 3,
        reps: "8-12",
      },
      TUE: { label: "REST", exerciseIds: [] },
      WED: { label: "REST", exerciseIds: [] },
      THU: { label: "REST", exerciseIds: [] },
      FRI: { label: "REST", exerciseIds: [] },
      SAT: { label: "REST", exerciseIds: [] },
      SUN: { label: "REST", exerciseIds: [] },
    },
    savedExercises: [],
    logs: [],
    checkIns: [],
    weights: [],
    measurements: [],
    foodLog: [],
    completedDates: [],
    programs: [],
    activeProgramId: null,
    sessions,
    activeSessionId: null,
    water: [],
    waterTargetMl: 3000,
    hydrationAlertsEnabled: false,
  };
}

describe("training autopilot", () => {
  it("prescribes an increase after clean target reps", () => {
    const state = stateWith([session("2026-07-20", 80, 10, 8)]);
    const plan = buildAutopilotPlan(state, "HYPERTROPHY");
    expect(plan.prescriptions[0]).toMatchObject({
      exerciseId: "bench-press",
      action: "INCREASE",
      prescribedWeightKg: 82.5,
    });
  });

  it("detects a repeated stall and prescribes a reset", () => {
    const state = stateWith([
      session("2026-07-10", 80, 8, 9.5),
      session("2026-07-15", 80, 8, 9.5),
      session("2026-07-20", 80, 8, 9.5),
    ]);
    const plan = buildAutopilotPlan(state);
    expect(plan.prescriptions[0]).toMatchObject({
      action: "RESET",
      prescribedWeightKg: 72.5,
      reduceSets: true,
    });
  });

  it("applies prescribed loads and deload sets to the schedule", () => {
    const state = stateWith([
      session("2026-07-10", 80, 8, 9.5),
      session("2026-07-15", 80, 8, 9.5),
      session("2026-07-20", 80, 8, 9.5),
    ]);
    const plan = buildAutopilotPlan(state);
    const next = applyAutopilotPlan(state.schedule!, plan);
    expect(next.MON.exerciseConfig?.["bench-press"]).toMatchObject({
      weightKg: 72.5,
      sets: 2,
    });
  });
});
