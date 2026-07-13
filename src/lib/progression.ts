import type { AppState } from "./types";

export interface TopSet {
  /** Session date (ISO day) */
  date: string;
  weight: number;
  reps: number;
}

/**
 * Top set per completed session for an exercise, oldest → newest.
 * A "top set" is the heaviest set (ties broken by reps).
 */
export function topSetHistory(state: AppState, exerciseId: string, limit = 6): TopSet[] {
  const rows: TopSet[] = [];
  for (const session of state.sessions) {
    if (!session.endedAt) continue;
    for (const ex of session.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      let best: { weight: number; reps: number } | null = null;
      for (const s of ex.sets) {
        if (s.weight <= 0) continue;
        if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) {
          best = { weight: s.weight, reps: s.reps };
        }
      }
      if (best) rows.push({ date: session.date, ...best });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows.slice(-limit);
}

/** Lifts that progress in 5kg jumps; everything else moves 2.5kg. */
const BIG_JUMP = new Set(["squat", "deadlift", "leg-press", "rdl", "hip-thrust"]);

export interface Suggestion {
  weightKg: number;
  /** "up" = add weight, "hold" = repeat weight, "start" = first prescription */
  kind: "up" | "hold";
  reason: string;
}

/** Minimum rep target from strings like "8-12", "5", "AMRAP". */
export function minTargetReps(targetReps: string): number {
  const n = parseInt(targetReps, 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

/**
 * Deterministic double-progression: if every working set of the most recent
 * session hit the rep target, add a plate increment; otherwise repeat the
 * weight and chase the reps.
 */
export function suggestNextWeight(
  state: AppState,
  exerciseId: string,
  targetReps: string,
): Suggestion | null {
  const sessions = [...state.sessions]
    .filter((s) => s.endedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sessions) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const working = ex.sets.filter((s) => s.weight > 0);
    if (working.length === 0) continue;
    const top = Math.max(...working.map((s) => s.weight));
    const target = minTargetReps(targetReps);
    const allHit = working.every((s) => s.reps >= target);
    if (allHit) {
      const jump = BIG_JUMP.has(exerciseId) ? 5 : 2.5;
      return {
        weightKg: top + jump,
        kind: "up",
        reason: `All sets hit ${target}+ reps at ${top}kg last time`,
      };
    }
    return {
      weightKg: top,
      kind: "hold",
      reason: `Chase ${target} reps on every set at ${top}kg first`,
    };
  }
  return null;
}
