import type { AppState } from "./types";
import { adaptiveTdee } from "./adaptive-tdee";
import { calorieCycle } from "./calorie-cycling";
import { hydrationInsight } from "./hydration-insight";
import { lifetimeStats } from "./lifetime-stats";
import { monthRank } from "./month-rank";
import { proteinSpread } from "./protein-spread";
import { repZoneMix } from "./rep-zones";
import { sessionRecords } from "./session-records";
import { throwback } from "./throwback";
import { timeOfDay } from "./time-of-day";
import { trainingRhythm } from "./training-rhythm";
import { weekPace } from "./week-pace";
import { normaliseTrainingDays } from "./calc";

// Intelligence status — which engines are live, asked of the ENGINES
// THEMSELVES so this list can never drift from reality. Each entry's `need`
// tells a new lifter exactly what switches it on.

export interface EngineStatus {
  key: string;
  title: string;
  active: boolean;
  need: string;
}

export interface IntelligenceStatus {
  engines: EngineStatus[];
  active: number;
  total: number;
}

export function intelligenceStatus(
  state: AppState,
  todayIso: string,
  calorieTarget = 0,
): IntelligenceStatus {
  const p = state.profile;
  const latestWeight =
    [...(state.weights ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.weight ??
    p?.weightKg ??
    0;

  const engines: EngineStatus[] = [
    {
      key: "records",
      title: "Session records",
      active: sessionRecords(state.sessions) !== null,
      need: "Finish your first workout",
    },
    {
      key: "story",
      title: "Your story",
      active: lifetimeStats(state.sessions, state.completedDates) !== null,
      need: "Finish your first workout",
    },
    {
      key: "rhythm",
      title: "Your rhythm",
      active:
        trainingRhythm(state.sessions, state.completedDates, p?.trainingDays, todayIso) !== null,
      need: "8 workouts in 12 weeks",
    },
    {
      key: "timeofday",
      title: "When you lift best",
      active: timeOfDay(state.sessions, todayIso) !== null,
      need: "8 workouts in 12 weeks",
    },
    {
      key: "repzones",
      title: "Rep-zone mix",
      active: p ? repZoneMix(state.sessions, p.goal, todayIso) !== null : false,
      need: "20 working sets in 4 weeks",
    },
    {
      key: "weekpace",
      title: "Week pace",
      active: weekPace(state.sessions, todayIso) !== null,
      need: "4 active training weeks",
    },
    {
      key: "monthrank",
      title: "Month rankings",
      active: monthRank(state.sessions, todayIso) !== null,
      need: "3 completed months of training",
    },
    {
      key: "throwback",
      title: "Throwback",
      active: throwback(state.sessions, todayIso) !== null,
      need: "90 days of history on a lift",
    },
    {
      key: "tdee",
      title: "Adaptive TDEE",
      active: adaptiveTdee(state.foodLog, state.weights, todayIso) !== null,
      need: "8 food days + 4 weigh-ins",
    },
    {
      key: "cycling",
      title: "Calorie cycling",
      active: p
        ? calorieCycle(
            calorieTarget,
            normaliseTrainingDays(p.trainingDays, p.daysPerWeek),
            todayIso,
          ) !== null
        : false,
      need: "Set a calorie goal",
    },
    {
      key: "protein",
      title: "Protein spread",
      active: proteinSpread(state.foodLog, latestWeight, todayIso) !== null,
      need: "4 days of logged meals",
    },
    {
      key: "hydration",
      title: "Hydration insight",
      active: hydrationInsight(state.water, state.waterTargetMl, todayIso) !== null,
      need: "5 days of water logging",
    },
  ];

  return {
    engines,
    active: engines.filter((e) => e.active).length,
    total: engines.length,
  };
}
