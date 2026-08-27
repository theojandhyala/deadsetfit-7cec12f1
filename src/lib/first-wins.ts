import type { AppState } from "./types";

export type FirstWinId = "PLAN" | "WORKOUT" | "NUTRITION" | "BASELINE";

export type FirstWinStep = {
  id: FirstWinId;
  title: string;
  detail: string;
  action: string;
  done: boolean;
};

export function getFirstWinSteps(state: AppState): FirstWinStep[] {
  const activeProgram = state.programs.find((program) => program.id === state.activeProgramId);
  const planReady = activeProgram
    ? Object.values(activeProgram.days).some((day) => day.items.length > 0)
    : !!state.schedule && Object.values(state.schedule).some((day) => day.exerciseIds.length > 0);
  const workoutLogged =
    state.sessions.some((session) => !!session.endedAt) ||
    state.logs.length > 0 ||
    state.completedDates.length > 0;
  const baselineRecorded =
    state.weights.length > 0 || state.measurements.length > 0 || state.checkIns.length > 0;

  return [
    {
      id: "PLAN",
      title: "Your week is ready",
      detail: "Review the days, exercises, sets and reps.",
      action: "Review plan",
      done: planReady,
    },
    {
      id: "WORKOUT",
      title: "Complete your first workout",
      detail: "Log the working sets so progress and PRs can start.",
      action: "Start workout",
      done: workoutLogged,
    },
    {
      id: "NUTRITION",
      title: "Log one meal",
      detail: "Set a useful calorie and protein baseline for today.",
      action: "Log food",
      done: state.foodLog.length > 0,
    },
    {
      id: "BASELINE",
      title: "Record a starting point",
      detail: "Add bodyweight, measurements or a private progress photo.",
      action: "Add baseline",
      done: baselineRecorded,
    },
  ];
}
