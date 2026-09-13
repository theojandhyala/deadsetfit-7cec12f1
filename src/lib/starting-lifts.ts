import { estimate1RM } from "./calc";
import { applyProgrammeWeights } from "./programme-weight-setup";
import { snapToLoadable, toKg, type WeightUnit } from "./units";
import type { AppState } from "./types";

/**
 * The lifts setup asks about, if the athlete wants to declare them.
 *
 * Deliberately the four the strength standards are built around, and no more.
 * Every extra row is another screenful of optional typing between an athlete
 * and their first session.
 */
export const STARTING_LIFTS: Array<{ id: string; label: string; hint: string }> = [
  { id: "bench-press", label: "Bench Press", hint: "80" },
  { id: "squat", label: "Back Squat", hint: "100" },
  { id: "deadlift", label: "Deadlift", hint: "120" },
  { id: "ohp", label: "Overhead Press", hint: "50" },
];

/** One declared lift: a set the athlete says they can already do. */
export interface StartingLift {
  exerciseId: string;
  /** Weight in kilograms, whatever units it was typed in. */
  weightKg: number;
  reps: number;
}

export interface StartingLiftDraft {
  weight: string;
  reps: string;
}

/**
 * Read a typed row, rejecting anything that is not a real set.
 *
 * Returns null rather than a zero so a half-filled row (a weight with no reps,
 * or the other way round) is ignored entirely instead of being stored as a
 * record of lifting nothing.
 */
export function parseStartingLift(
  exerciseId: string,
  draft: StartingLiftDraft | undefined,
  unit: WeightUnit,
): StartingLift | null {
  if (!draft) return null;
  const weight = Number(draft.weight);
  const reps = Number(draft.reps);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  if (!Number.isFinite(reps) || reps < 1) return null;
  // A "best set" beyond 20 reps is an endurance effort, not a strength record,
  // and Epley is badly wrong out there.
  if (reps > 20) return null;
  const weightKg = toKg(weight, unit);
  if (weightKg > 500) return null;
  return { exerciseId, weightKg, reps: Math.round(reps) };
}

/**
 * The manual-PR records these declared sets become.
 *
 * Stored as the set that was actually performed — weight and reps — not as an
 * estimated one-rep max. The card and the Strength Map both run Epley over the
 * stored pair themselves, so storing an estimate here would have it estimated
 * twice and inflate every grade.
 */
export function startingLiftRecords(
  lifts: readonly StartingLift[],
  now = new Date(),
): Record<string, { value: number; reps: number; date: string }> {
  const date = now.toISOString().slice(0, 10);
  const out: Record<string, { value: number; reps: number; date: string }> = {};
  for (const lift of lifts) {
    out[lift.exerciseId] = { value: lift.weightKg, reps: lift.reps, date };
  }
  return out;
}

/**
 * The working weight to start the first week at.
 *
 * It is the athlete's own declared set, snapped to what their gym can actually
 * load — not a percentage of an estimated max. They have told us they can do
 * this weight for these reps; anything we derive on top of that is a guess
 * dressed up as a prescription.
 */
export function startingWorkingWeight(lift: StartingLift, unit: WeightUnit): number {
  return snapToLoadable(lift.weightKg, unit);
}

/** The estimated one-rep max a declared set implies, for the read-back only. */
export function startingLiftOneRm(lift: StartingLift): number {
  return estimate1RM(lift.weightKg, lift.reps);
}

/**
 * Fold declared lifts into app state: records for the Strength Map, and day-one
 * loads for any scheduled exercise that has none.
 *
 * `fillMissingOnly` matters — a lifter who chose BUILD may have already set a
 * weight by hand on the schedule screen, and a declared lift must never
 * silently overwrite a number they typed themselves.
 */
export function applyStartingLifts(
  state: AppState,
  lifts: readonly StartingLift[],
  unit: WeightUnit,
  now = new Date(),
): AppState {
  if (lifts.length === 0) return state;
  const loads = new Map(
    lifts.map((lift) => [lift.exerciseId, startingWorkingWeight(lift, unit)] as const),
  );
  const withLoads = applyProgrammeWeights(state, loads, { fillMissingOnly: true });
  return {
    ...withLoads,
    manualPRs: {
      ...(withLoads.manualPRs ?? {}),
      ...startingLiftRecords(lifts, now),
    },
  };
}
