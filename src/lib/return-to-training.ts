import type { WorkoutSession } from "./types";

const DAY_MS = 86_400_000;

function dayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(stamp) ? Math.floor(stamp / DAY_MS) : null;
}

export function trainingGapDays(sessions: WorkoutSession[], now = new Date()): number | null {
  const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
  const latest = sessions.reduce<number | null>((best, session) => {
    if (!session.endedAt || !session.exercises.some((exercise) => exercise.sets.length > 0)) {
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

function roundLoad(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return kg;
  return Math.max(0, Math.round((kg * 0.9) / 2.5) * 2.5);
}

/** A single conservative session; the source programme is never rewritten. */
export function applyReturnRamp(session: WorkoutSession, gapDays?: number | null): WorkoutSession {
  if (!gapDays || gapDays < 10) return session;
  return {
    ...session,
    returnRampGapDays: gapDays,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      targetSets: exercise.targetSets > 2 ? exercise.targetSets - 1 : exercise.targetSets,
      ...(exercise.plannedWeightKg != null && exercise.plannedWeightKg > 0
        ? { plannedWeightKg: roundLoad(exercise.plannedWeightKg) }
        : {}),
      targetRir: Math.max(3, exercise.targetRir ?? 0),
    })),
  };
}
