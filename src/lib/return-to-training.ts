import type { WorkoutSession } from "./types";
import { isWorkingSet } from "./set-tracking";
import { snapToLoadable, type WeightUnit } from "./units";

const DAY_MS = 86_400_000;

function dayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value) return null;
  return Math.floor(stamp / DAY_MS);
}

export function trainingGapDays(sessions: WorkoutSession[], now = new Date()): number | null {
  const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
  const latest = sessions.reduce<number | null>((best, session) => {
    if (
      !session.endedAt ||
      !session.exercises.some((exercise) =>
        exercise.sets.some((set) => {
          const effort =
            set.mode === "duration" ? set.seconds : set.mode === "distance" ? set.meters : set.reps;
          return (
            isWorkingSet(set) && typeof effort === "number" && Number.isFinite(effort) && effort > 0
          );
        }),
      )
    ) {
      return best;
    }
    const day = dayNumber(session.date);
    if (day == null || day > today) return best;
    return best == null || day > best ? day : best;
  }, null);
  return latest == null ? null : Math.max(0, today - latest);
}

export function eligibleReturnGap(
  sessions: WorkoutSession[],
  now = new Date(),
  thresholdDays = 10,
): number | null {
  const gap = trainingGapDays(sessions, now);
  return gap != null && gap >= thresholdDays ? gap : null;
}

function roundLoad(kg: number, barKg: number | undefined, unit: WeightUnit): number {
  if (!Number.isFinite(kg) || kg <= 0) return kg;
  const candidate = snapToLoadable(kg * 0.9, unit);
  // Unknown small-equipment increments must never turn a reduction into an
  // increase or turn a weighted movement into an unweighted one.
  if (candidate <= 0) return kg;
  const floor = barKg != null && Number.isFinite(barKg) && barKg > 0 ? barKg : 0;
  return Math.min(kg, Math.max(floor, candidate));
}

/** A single conservative session; the source programme is never rewritten. */
export function applyReturnRamp(
  session: WorkoutSession,
  gapDays?: number | null,
  unit: WeightUnit = "kg",
): WorkoutSession {
  if (
    !gapDays ||
    !Number.isFinite(gapDays) ||
    gapDays < 10 ||
    session.endedAt ||
    session.exercises.some((exercise) => exercise.sets.length > 0)
  )
    return session;
  return {
    ...session,
    returnRampGapDays: gapDays,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      targetSets: exercise.targetSets > 2 ? exercise.targetSets - 1 : exercise.targetSets,
      ...(exercise.plannedWeightKg != null && exercise.plannedWeightKg > 0
        ? { plannedWeightKg: roundLoad(exercise.plannedWeightKg, exercise.barKg, unit) }
        : {}),
      targetRir: Math.max(3, exercise.targetRir ?? 0),
    })),
  };
}
