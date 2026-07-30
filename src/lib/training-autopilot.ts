import { getExercise } from "./exercises";
import { minTargetReps, suggestNextWeight } from "./progression";
import type { AppState, DayKey, ExercisePlan, Schedule, WorkoutSessionExercise } from "./types";

export type AutopilotStrategy = "BALANCED" | "STRENGTH" | "HYPERTROPHY";
export type AutopilotPhase = "BASELINE" | "BUILD" | "DELOAD";
export type AutopilotAction = "INCREASE" | "HOLD" | "RESET" | "BASELINE";

export interface AutopilotPrescription {
  exerciseId: string;
  name: string;
  currentWeightKg: number;
  prescribedWeightKg: number;
  action: AutopilotAction;
  reason: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  reduceSets: boolean;
}

export interface AutopilotPlan {
  phase: AutopilotPhase;
  readiness: number;
  fatigue: number;
  headline: string;
  explanation: string;
  prescriptions: AutopilotPrescription[];
  trainedExerciseCount: number;
}

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_MS = 86_400_000;

function e1rm(weight: number, reps: number) {
  return weight * (1 + Math.max(0, reps) / 30);
}

function roundLoad(value: number) {
  return Math.max(0, Math.round(value / 2.5) * 2.5);
}

function exerciseHistory(state: AppState, exerciseId: string) {
  return [...state.sessions]
    .filter((session) => session.endedAt)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((session) => {
      const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
      if (!exercise) return [];
      const working = exercise.sets.filter((set) => set.weight > 0 && set.kind !== "warmup");
      if (!working.length) return [];
      const top = working.reduce((best, set) =>
        e1rm(set.weight, set.reps) > e1rm(best.weight, best.reps) ? set : best,
      );
      const rated = working.filter((set) => typeof set.rpe === "number" && set.rpe > 0);
      return [
        {
          date: session.date,
          exercise,
          topWeight: top.weight,
          topE1rm: e1rm(top.weight, top.reps),
          averageRpe: rated.length
            ? rated.reduce((sum, set) => sum + (set.rpe ?? 0), 0) / rated.length
            : undefined,
        },
      ];
    });
}

function scheduleTargets(state: AppState) {
  const result = new Map<
    string,
    { reps: string; progression: ExercisePlan["progression"]; configuredWeight: number }
  >();
  const activeProgram = state.programs.find((program) => program.id === state.activeProgramId);
  if (activeProgram) {
    for (const dayKey of DAY_KEYS) {
      for (const item of activeProgram.days[dayKey]?.items ?? []) {
        if (result.has(item.id)) continue;
        result.set(item.id, {
          reps: item.reps || "8-12",
          progression: "DOUBLE",
          configuredWeight: 0,
        });
      }
    }
  }
  if (!state.schedule) return result;
  for (const dayKey of DAY_KEYS) {
    const day = state.schedule[dayKey];
    for (const exerciseId of day.exerciseIds) {
      if (result.has(exerciseId)) continue;
      const exercise = getExercise(exerciseId, state.savedExercises);
      const config = day.exerciseConfig?.[exerciseId];
      result.set(exerciseId, {
        reps: config?.reps ?? day.reps ?? exercise?.reps ?? "8-12",
        progression: config?.progression ?? "DOUBLE",
        configuredWeight: config?.weightKg ?? 0,
      });
    }
  }
  return result;
}

function globalFatigue(state: AppState) {
  const now = Date.now();
  const recent = state.sessions.filter((session) => {
    if (!session.endedAt) return false;
    const age = now - new Date(session.date).getTime();
    return age >= 0 && age <= 7 * DAY_MS;
  });
  const previous = state.sessions.filter((session) => {
    if (!session.endedAt) return false;
    const age = now - new Date(session.date).getTime();
    return age > 7 * DAY_MS && age <= 14 * DAY_MS;
  });
  const workingSets = recent.flatMap((session) =>
    session.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.kind !== "warmup")),
  );
  const rated = workingSets.filter((set) => typeof set.rpe === "number" && set.rpe > 0);
  const averageRpe = rated.length
    ? rated.reduce((sum, set) => sum + (set.rpe ?? 0), 0) / rated.length
    : 0;
  const recentVolume = recent.reduce((sum, session) => sum + (session.totalVolume || 0), 0);
  const previousVolume = previous.reduce((sum, session) => sum + (session.totalVolume || 0), 0);
  const volumeSpike =
    previousVolume > 0 ? Math.max(0, (recentVolume - previousVolume) / previousVolume) : 0;
  const sessionLoad = Math.min(30, recent.length * 6);
  const effortLoad = averageRpe ? Math.max(0, averageRpe - 7) * 18 : 0;
  const spikeLoad = Math.min(25, volumeSpike * 30);
  return Math.round(Math.min(100, sessionLoad + effortLoad + spikeLoad));
}

function missedTarget(exercise: WorkoutSessionExercise) {
  const working = exercise.sets.filter((set) => set.weight > 0 && set.kind !== "warmup");
  if (!working.length) return false;
  const target = minTargetReps(exercise.targetReps || "8");
  const missedReps = working.filter((set) => set.reps < target).length > working.length / 2;
  const grinding =
    working.filter((set) => typeof set.rpe === "number" && (set.rpe ?? 0) >= 9.5).length >
    working.length / 2;
  return missedReps || grinding;
}

export function buildAutopilotPlan(
  state: AppState,
  strategy: AutopilotStrategy = "BALANCED",
): AutopilotPlan {
  const targets = scheduleTargets(state);
  const fatigue = globalFatigue(state);
  const phase: AutopilotPhase =
    fatigue >= 72
      ? "DELOAD"
      : state.sessions.some((session) => session.endedAt)
        ? "BUILD"
        : "BASELINE";
  const prescriptions: AutopilotPrescription[] = [];
  let trainedExerciseCount = 0;

  for (const [exerciseId, target] of targets) {
    const history = exerciseHistory(state, exerciseId);
    const latest = history.at(-1);
    const name = getExercise(exerciseId, state.savedExercises)?.name ?? exerciseId;
    if (!latest) {
      prescriptions.push({
        exerciseId,
        name,
        currentWeightKg: target.configuredWeight,
        prescribedWeightKg: target.configuredWeight,
        action: "BASELINE",
        reason: target.configuredWeight
          ? "Use the planned load and establish a clean performance baseline"
          : "Log one weighted session to unlock an automatic load prescription",
        confidence: "LOW",
        reduceSets: false,
      });
      continue;
    }

    trainedExerciseCount += 1;
    const recent = history.slice(-3);
    const range =
      recent.length >= 3
        ? (Math.max(...recent.map((entry) => entry.topE1rm)) -
            Math.min(...recent.map((entry) => entry.topE1rm))) /
          Math.max(1, recent[0].topE1rm)
        : 1;
    const stalled = recent.length >= 3 && range < 0.015;
    const repeatedMisses =
      recent.length >= 2 && recent.slice(-2).every((entry) => missedTarget(entry.exercise));
    const shouldReset = phase === "DELOAD" || stalled || repeatedMisses;

    if (shouldReset) {
      prescriptions.push({
        exerciseId,
        name,
        currentWeightKg: latest.topWeight,
        prescribedWeightKg: roundLoad(latest.topWeight * 0.9),
        action: "RESET",
        reason:
          phase === "DELOAD"
            ? "Systemic fatigue is elevated — reduce load and one working set this week"
            : repeatedMisses
              ? "Two repeated misses — reset 10%, rebuild clean reps, then progress"
              : "Three-session strength stall — reset 10% to restart momentum",
        confidence: recent.length >= 3 ? "HIGH" : "MEDIUM",
        reduceSets: true,
      });
      continue;
    }

    const progression =
      strategy === "STRENGTH"
        ? "LINEAR"
        : strategy === "HYPERTROPHY"
          ? "DOUBLE"
          : target.progression;
    const suggestion = suggestNextWeight(state, exerciseId, target.reps, progression);
    const prescribed = suggestion?.weightKg ?? latest.topWeight;
    prescriptions.push({
      exerciseId,
      name,
      currentWeightKg: latest.topWeight,
      prescribedWeightKg: prescribed,
      action: suggestion?.kind === "up" ? "INCREASE" : "HOLD",
      reason: suggestion?.reason ?? "Repeat the latest load and build a stronger baseline",
      confidence: recent.length >= 3 ? "HIGH" : "MEDIUM",
      reduceSets: false,
    });
  }

  prescriptions.sort((a, b) => {
    const priority: Record<AutopilotAction, number> = {
      RESET: 0,
      INCREASE: 1,
      HOLD: 2,
      BASELINE: 3,
    };
    return priority[a.action] - priority[b.action] || a.name.localeCompare(b.name);
  });

  const readiness = Math.max(0, 100 - fatigue);
  return {
    phase,
    readiness,
    fatigue,
    headline:
      phase === "DELOAD"
        ? "Back off now. Come back stronger."
        : phase === "BUILD"
          ? "Progressive overload is cleared."
          : "Build the baseline first.",
    explanation:
      phase === "DELOAD"
        ? "Recent workload and effort crossed the recovery threshold. Autopilot will reduce affected loads by 10% and remove one working set."
        : phase === "BUILD"
          ? "Loads are prescribed from completed reps, recorded effort, stalls and your selected progression strategy."
          : "Autopilot activates as soon as weighted sessions are completed.",
    prescriptions,
    trainedExerciseCount,
  };
}

export function applyAutopilotPlan(schedule: Schedule, plan: AutopilotPlan): Schedule {
  const byExercise = new Map(plan.prescriptions.map((item) => [item.exerciseId, item]));
  return Object.fromEntries(
    DAY_KEYS.map((dayKey) => {
      const day = schedule[dayKey];
      const exerciseConfig = { ...(day.exerciseConfig ?? {}) };
      for (const exerciseId of day.exerciseIds) {
        const prescription = byExercise.get(exerciseId);
        if (!prescription || prescription.prescribedWeightKg <= 0) continue;
        const current = exerciseConfig[exerciseId] ?? {};
        const currentSets = current.sets ?? day.sets;
        exerciseConfig[exerciseId] = {
          ...current,
          weightKg: prescription.prescribedWeightKg,
          sets:
            prescription.reduceSets && currentSets ? Math.max(2, currentSets - 1) : current.sets,
        };
      }
      return [dayKey, { ...day, exerciseConfig }];
    }),
  ) as Schedule;
}
