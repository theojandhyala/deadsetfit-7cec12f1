import { getExercise } from "./exercises";
import { isWorkingSet, trackingModeFor } from "./set-tracking";
import type { AppState, DayKey, Schedule } from "./types";
import { requiresWorkingWeight } from "./workout-flow";

export type WeightRow = {
  key: string;
  exerciseId: string;
  name: string;
  weightKg: number;
  /** Honest working-set reps paired with the starting load. */
  reps: number;
  days: DayKey[];
  /** Safe to fill silently because exactly one configured load already exists. */
  autoApply: boolean;
};

export type ApplyProgrammeWeightOptions = {
  /** Preserve every positive load and only fill repetitions that are still empty. */
  fillMissingOnly?: boolean;
};

type ProgrammeWeightSource = Pick<
  AppState,
  "schedule" | "programs" | "activeProgramId" | "savedExercises" | "sessions"
>;

/**
 * Builds the one-time load-calibration queue without coupling it to React.
 * Repeated movements collapse to one row so one answer fills the entire week.
 */
export function programmeWeightRows(state: ProgrammeWeightSource): WeightRow[] {
  const known = new Map<string, Set<number>>();
  const rememberKnown = (exerciseId: string, weightKg: number) => {
    if (weightKg <= 0) return;
    const values = known.get(exerciseId) ?? new Set<number>();
    values.add(weightKg);
    known.set(exerciseId, values);
  };
  for (const day of Object.values(state.schedule ?? {})) {
    for (const exerciseId of day.exerciseIds) {
      const stored = day.exerciseConfig?.[exerciseId]?.weightKg ?? 0;
      rememberKnown(exerciseId, stored);
    }
  }
  const active = state.programs.find((program) => program.id === state.activeProgramId);
  for (const day of Object.values(active?.days ?? {})) {
    for (const item of day.items) {
      rememberKnown(item.id, item.weightKg ?? 0);
    }
  }
  const missing = new Map<
    string,
    { exerciseId: string; name: string; days: Set<DayKey>; targetReps: number }
  >();
  const addMissing = (exerciseId: string, name: string, day: DayKey, reps: string) => {
    const targetReps = Math.max(1, Math.round(Number(reps.match(/\d+/)?.[0]) || 1));
    const row = missing.get(exerciseId) ?? {
      exerciseId,
      name,
      days: new Set<DayKey>(),
      targetReps,
    };
    row.days.add(day);
    missing.set(exerciseId, row);
  };

  if (state.schedule) {
    for (const day of Object.keys(state.schedule) as DayKey[]) {
      const plan = state.schedule[day];
      for (const exerciseId of plan.exerciseIds) {
        const exercise = getExercise(exerciseId, state.savedExercises);
        if (!exercise) continue;
        const reps = plan.exerciseConfig?.[exerciseId]?.reps ?? plan.reps ?? exercise.reps;
        const tracking = trackingModeFor(exercise, reps);
        if (!requiresWorkingWeight({ tracking }, exercise.equipment)) continue;
        const stored = plan.exerciseConfig?.[exerciseId]?.weightKg ?? 0;
        if (stored > 0) continue;
        addMissing(exerciseId, exercise.name, day, reps);
      }
    }
  }

  if (active) {
    for (const day of Object.keys(active.days) as DayKey[]) {
      active.days[day].items.forEach((item) => {
        const definition = getExercise(item.id, state.savedExercises);
        const tracking = trackingModeFor(definition ?? { name: item.name }, item.reps);
        if (!requiresWorkingWeight({ tracking }, definition?.equipment ?? item.equipment)) return;
        if ((item.weightKg ?? 0) > 0) return;
        addMissing(item.id, item.name, day, item.reps);
      });
    }
  }

  if (missing.size === 0) return [];

  // History is only a suggested starting value. Search newest-first, skip
  // warm-ups/drop sets, and stop as soon as every unresolved prompt has one.
  const historyWeights = new Map<string, number>();
  const historyReps = new Map<string, number>();
  const unresolved = new Set(
    [...missing.keys()].filter((exerciseId) => (known.get(exerciseId)?.size ?? 0) === 0),
  );
  if (unresolved.size > 0) {
    const sessions = [...state.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    for (const session of sessions) {
      if (!session.endedAt) continue;
      for (const exercise of session.exercises) {
        if (!unresolved.has(exercise.exerciseId)) continue;
        const weighted = [...exercise.sets]
          .reverse()
          .find((set) => set.weight > 0 && isWorkingSet(set));
        if (!weighted) continue;
        historyWeights.set(exercise.exerciseId, weighted.weight);
        historyReps.set(exercise.exerciseId, weighted.reps);
        unresolved.delete(exercise.exerciseId);
      }
      if (unresolved.size === 0) break;
    }
  }

  return [...missing.values()].map((row) => {
    const configured = [...(known.get(row.exerciseId) ?? [])];
    return {
      key: row.exerciseId,
      exerciseId: row.exerciseId,
      name: row.name,
      days: [...row.days],
      // One configured value is safe to propagate. Conflicting configured
      // values remain a visible, user-confirmed choice instead.
      weightKg: configured[0] ?? historyWeights.get(row.exerciseId) ?? 0,
      reps: historyReps.get(row.exerciseId) ?? row.targetReps,
      autoApply: configured.length === 1,
    };
  });
}

/** Applies one known load to every exact repeat in the schedule and active programme. */
export function applyProgrammeWeights(
  state: AppState,
  values: ReadonlyMap<string, number>,
  options: ApplyProgrammeWeightOptions = {},
): AppState {
  if (values.size === 0) return state;
  let changed = false;
  const schedule = state.schedule
    ? (Object.fromEntries(
        (Object.keys(state.schedule) as DayKey[]).map((day) => {
          const plan = state.schedule![day];
          const exerciseConfig = { ...(plan.exerciseConfig ?? {}) };
          for (const exerciseId of plan.exerciseIds) {
            const weightKg = values.get(exerciseId);
            const currentWeight = exerciseConfig[exerciseId]?.weightKg ?? 0;
            if (
              weightKg == null ||
              currentWeight === weightKg ||
              (options.fillMissingOnly && currentWeight > 0)
            ) {
              continue;
            }
            changed = true;
            exerciseConfig[exerciseId] = {
              ...(exerciseConfig[exerciseId] ?? {}),
              weightKg,
            };
          }
          return [day, { ...plan, exerciseConfig }];
        }),
      ) as Schedule)
    : state.schedule;
  const programs = state.programs.map((program) => {
    if (program.id !== state.activeProgramId) return program;
    const days = { ...program.days };
    for (const day of Object.keys(days) as DayKey[]) {
      days[day] = {
        ...days[day],
        items: days[day].items.map((item) => {
          const weightKg = values.get(item.id);
          if (
            weightKg == null ||
            item.weightKg === weightKg ||
            (options.fillMissingOnly && (item.weightKg ?? 0) > 0)
          ) {
            return item;
          }
          changed = true;
          return { ...item, weightKg };
        }),
      };
    }
    return { ...program, days };
  });
  return changed ? { ...state, schedule, programs } : state;
}

/** Keep a DOM-owned decimal input valid across dot- and comma-decimal locales. */
export function normaliseDecimalInput(value: string): string {
  const clean = value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const [whole = "", ...fraction] = clean.split(".");
  return fraction.length ? `${whole}.${fraction.join("")}` : whole;
}

/** Accept both decimal separators because iOS follows the athlete's locale. */
export function parseDisplayWeight(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const weight = Number(normalized);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

/**
 * Validate the visible calibration values read directly from the native inputs.
 * This avoids relying on an iOS FormData snapshot while keeping keystrokes
 * DOM-owned and responsive.
 */
export function parseStrengthSetDraft(weight: string, repetitions: string) {
  const displayWeight = parseDisplayWeight(weight);
  const reps = Math.round(Number(repetitions));
  if (displayWeight == null || !Number.isFinite(reps) || reps < 1 || reps > 100) {
    return null;
  }
  return { displayWeight, reps };
}
