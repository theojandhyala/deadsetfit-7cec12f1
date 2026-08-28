import { allExercises, getExercise } from "./exercises";
import { estimate1RM } from "./calc";
import { applyProgrammeWeights } from "./programme-weight-setup";
import { countsForRecords } from "./set-tracking";
import { strengthStandardKind, type StrengthStandardKind } from "./strength-grades";
import { toMuscleGroup } from "./recovery";
import type { AppState, DayKey, MuscleGroup } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type StrengthCheckInRow = {
  exerciseId: string;
  name: string;
  days: DayKey[];
  muscleGroup: MuscleGroup;
  kind: StrengthStandardKind;
  /** The configured load applied to every repeat in the active plan. */
  plannedWeightKg: number;
  /** The latest athlete-confirmed or actually logged reference. */
  value: number;
  reps: number;
};

export type StrengthCheckInAnswer = {
  exerciseId: string;
  kind: StrengthStandardKind;
  value: number;
  reps?: number;
};

type DraftRow = Omit<StrengthCheckInRow, "value" | "reps">;

function parseFirstRepTarget(reps: string | undefined): number {
  const first = reps?.match(/\d+/)?.[0];
  return Math.max(1, Math.round(Number(first) || 1));
}

function bestLoggedReference(
  state: AppState,
  exerciseId: string,
  kind: StrengthStandardKind,
): { value: number; reps: number } {
  let bestScore = 0;
  let result = { value: 0, reps: 1 };
  for (const session of state.sessions) {
    if (!session.endedAt) continue;
    const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise) continue;
    for (const set of exercise.sets) {
      if (!countsForRecords(set)) continue;
      if (kind === "SECONDS") {
        const seconds = set.mode === "duration" ? (set.seconds ?? 0) : 0;
        if (seconds > bestScore) {
          bestScore = seconds;
          result = { value: seconds, reps: 1 };
        }
      } else if (kind === "REPS") {
        if (!set.mode && set.reps > bestScore) {
          bestScore = set.reps;
          result = { value: set.reps, reps: 1 };
        }
      } else if (!set.mode && set.weight > 0 && set.reps > 0) {
        const e1rm = estimate1RM(set.weight, set.reps);
        if (e1rm > bestScore) {
          bestScore = e1rm;
          result = { value: set.weight, reps: set.reps };
        }
      }
    }
  }
  for (const log of state.logs) {
    if (log.exerciseId !== exerciseId) continue;
    if (kind === "RATIO" && log.weight > 0 && log.reps > 0) {
      const e1rm = estimate1RM(log.weight, log.reps);
      if (e1rm > bestScore) {
        bestScore = e1rm;
        result = { value: log.weight, reps: log.reps };
      }
    } else if (kind === "REPS" && log.reps > bestScore) {
      bestScore = log.reps;
      result = { value: log.reps, reps: 1 };
    }
  }
  return result;
}

/**
 * One row per unique movement in the active training source. A repeated bench
 * on Monday and Friday is deliberately one question and one answer.
 */
export function weeklyStrengthCheckInRows(state: AppState): StrengthCheckInRow[] {
  const rows = new Map<string, DraftRow & { targetReps: number }>();
  const active = state.programs.find((program) => program.id === state.activeProgramId);

  const add = (
    exerciseId: string,
    name: string,
    day: DayKey,
    muscleGroup: MuscleGroup | undefined,
    plannedWeightKg: number,
    targetReps: number,
  ) => {
    if (!muscleGroup) return;
    const kind = strengthStandardKind(exerciseId, muscleGroup);
    if (!kind) return;
    const existing = rows.get(exerciseId);
    if (existing) {
      if (!existing.days.includes(day)) existing.days.push(day);
      if (plannedWeightKg > 0) existing.plannedWeightKg = plannedWeightKg;
      return;
    }
    rows.set(exerciseId, {
      exerciseId,
      name,
      days: [day],
      muscleGroup,
      kind,
      plannedWeightKg,
      targetReps,
    });
  };

  if (active) {
    for (const day of Object.keys(active.days) as DayKey[]) {
      for (const item of active.days[day].items) {
        const definition = getExercise(item.id, state.savedExercises);
        const muscleGroup =
          definition?.muscleGroup ??
          item.primary_muscles
            .map(toMuscleGroup)
            .find((muscle): muscle is NonNullable<typeof muscle> => Boolean(muscle));
        add(
          item.id,
          item.name,
          day,
          muscleGroup,
          item.weightKg ?? 0,
          parseFirstRepTarget(item.reps),
        );
      }
    }
  } else {
    for (const day of Object.keys(state.schedule ?? {}) as DayKey[]) {
      const plan = state.schedule![day];
      for (const exerciseId of plan.exerciseIds) {
        const definition = getExercise(exerciseId, state.savedExercises);
        if (!definition) continue;
        add(
          exerciseId,
          definition.name,
          day,
          definition.muscleGroup,
          plan.exerciseConfig?.[exerciseId]?.weightKg ?? 0,
          parseFirstRepTarget(
            plan.exerciseConfig?.[exerciseId]?.reps ?? plan.reps ?? definition.reps,
          ),
        );
      }
    }
  }

  return [...rows.values()].map(({ targetReps, ...row }) => {
    const logged = bestLoggedReference(state, row.exerciseId, row.kind);
    const manual = state.manualPRs?.[row.exerciseId];
    return {
      ...row,
      value: manual?.value ?? logged.value,
      reps: row.kind === "RATIO" ? (manual?.reps ?? logged.reps ?? targetReps) : 1,
    };
  });
}

export function weeklyStrengthCheckInDue(state: AppState, now = Date.now()): boolean {
  const snoozed = Date.parse(state.strengthCheckIn?.snoozedUntil ?? "");
  if (Number.isFinite(snoozed) && snoozed > now) return false;
  const completed = Date.parse(state.strengthCheckIn?.lastCompletedAt ?? "");
  return !Number.isFinite(completed) || now - completed >= WEEK_MS;
}

export function snoozeWeeklyStrengthCheckIn(state: AppState, now = Date.now()): AppState {
  return {
    ...state,
    strengthCheckIn: {
      ...state.strengthCheckIn,
      snoozedUntil: new Date(now + DAY_MS).toISOString(),
    },
  };
}

/** Apply confirmed records and use weighted answers as next week's plan loads. */
export function applyWeeklyStrengthCheckIn(
  state: AppState,
  answers: readonly StrengthCheckInAnswer[],
  now = new Date(),
): AppState {
  const valid = answers.filter((answer) => Number.isFinite(answer.value) && answer.value > 0);
  const weights = new Map(
    valid
      .filter((answer) => answer.kind === "RATIO")
      .map((answer) => [answer.exerciseId, answer.value]),
  );
  const withLoads = applyProgrammeWeights(state, weights);
  const date = now.toISOString();
  const manualPRs = { ...(withLoads.manualPRs ?? {}) };
  for (const answer of valid) {
    manualPRs[answer.exerciseId] = {
      value: answer.value,
      reps: answer.kind === "RATIO" ? Math.max(1, Math.round(answer.reps ?? 1)) : undefined,
      date,
    };
  }
  return {
    ...withLoads,
    manualPRs,
    strengthCheckIn: {
      lastCompletedAt: date,
      snoozedUntil: undefined,
      completedCount: (state.strengthCheckIn?.completedCount ?? 0) + 1,
    },
  };
}

/** Library entries needed to compare the Strength Map before and after a review. */
export function strengthCheckInLibrary(state: AppState) {
  const byId = new Map(
    allExercises(state.savedExercises).map((exercise) => [
      exercise.id,
      { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup },
    ]),
  );
  const active = state.programs.find((program) => program.id === state.activeProgramId);
  for (const day of Object.values(active?.days ?? {})) {
    for (const item of day.items) {
      if (byId.has(item.id)) continue;
      const muscleGroup = item.primary_muscles
        .map(toMuscleGroup)
        .find((muscle): muscle is NonNullable<typeof muscle> => Boolean(muscle));
      if (muscleGroup) byId.set(item.id, { id: item.id, name: item.name, muscleGroup });
    }
  }
  return [...byId.values()];
}
