import type { AppState } from "./types";

export const DEFAULT_STATE: AppState = {
  profile: null,
  schedule: null,
  logs: [],
  checkIns: [],
  weights: [],
  measurements: [],
  foodLog: [],
  mealPlan: null,
  completedDates: [],
  programs: [],
  activeProgramId: null,
  sessions: [],
  activeSessionId: null,
  physiqueScans: [],
  water: [],
  waterTargetMl: 3000,
  hydrationAlertsEnabled: true,
  manualPRs: {},
  units: "kg",
  remindersEnabled: true,
  runs: [],
};

