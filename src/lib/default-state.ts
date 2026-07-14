import type { AppState } from "./types";

export const DEFAULT_STATE: AppState = {
  profile: null,
  schedule: null,
  logs: [],
  checkIns: [],
  weights: [],
  measurements: [],
  foodLog: [],
  completedDates: [],
  programs: [],
  activeProgramId: null,
  sessions: [],
  activeSessionId: null,
  water: [],
  waterTargetMl: 3000,
  hydrationAlertsEnabled: true,
  manualPRs: {},
  units: "kg",
  remindersEnabled: true,
  streakArmor: { shields: 0, lastRefillMonth: "", usedDates: [] },
  healthSync: { enabled: false, importWorkouts: true, exportWorkouts: true },
};
