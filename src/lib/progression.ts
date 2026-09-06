import type { AppState, ExercisePlan } from "./types";
import { getExercise } from "./exercises";

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
        if (s.weight <= 0 || s.kind) continue;
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
  /** Exactly one next-session decision, derived from logged performance. */
  kind: "up" | "reps" | "hold" | "reduce";
  reason: string;
  /** Concrete rep target for the next working sets when applicable. */
  targetReps?: number;
  /** True when the lift is clearly ready to progress (hit reps with reps in reserve). */
  ready?: boolean;
}

/** Average RPE of the working sets that recorded one (undefined if none did). */
function avgRpe(sets: { rpe?: number }[]): number | undefined {
  const rated = sets.map((s) => s.rpe).filter((r): r is number => typeof r === "number" && r > 0);
  if (rated.length === 0) return undefined;
  return rated.reduce((a, b) => a + b, 0) / rated.length;
}

/** Minimum rep target from strings like "8-12", "5", "AMRAP". */
export function minTargetReps(targetReps: string): number {
  const n = parseInt(targetReps, 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function maxTargetReps(targetReps: string): number {
  const numbers = targetReps.match(/\d+/g)?.map(Number).filter((value) => value > 0) ?? [];
  return numbers.length ? Math.max(...numbers) : minTargetReps(targetReps);
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
  progression: ExercisePlan["progression"] = "DOUBLE",
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
    const minimum = minTargetReps(targetReps);
    const maximum = maxTargetReps(targetReps);
    const allHitMinimum = working.every((s) => s.reps >= minimum);
    const allHitMaximum = working.every((s) => s.reps >= maximum);
    const jump = BIG_JUMP.has(exerciseId) ? 5 : 2.5;
    const effort = avgRpe(working);

    if (progression === "HOLD") {
      return {
        weightKg: top,
        kind: "hold",
        reason: `Manual progression — repeat ${top}kg until you choose to move it`,
      };
    }

    if (progression === "LINEAR") {
      if (effort !== undefined && effort >= 9) {
        return {
          weightKg: top,
          kind: "hold",
          reason: `${top}kg reached RPE ${effort.toFixed(0)} — consolidate before the next linear jump`,
        };
      }
      return {
        weightKg: top + jump,
        kind: "up",
        reason: `Linear progression — add ${jump}kg after the completed session`,
        ready: true,
      };
    }

    if (allHitMaximum) {
      // Autoregulation: hitting the reps AT RPE 9+ (grinding) means the weight
      // is already near-max — consolidate before adding. Reps in reserve
      // (RPE ≤ 8) means it moved well; progress with confidence.
      if (effort !== undefined && effort >= 9) {
        return {
          weightKg: top,
          kind: "hold",
          reason: `Hit ${maximum}+ reps but at RPE ${effort.toFixed(0)} — lock in ${top}kg before adding`,
          targetReps: maximum,
        };
      }
      const reason =
        effort !== undefined
          ? `All sets hit ${maximum}+ reps at RPE ${effort.toFixed(0)} — range complete, move up`
          : `All sets reached the top of the ${minimum}–${maximum} rep range at ${top}kg`;
      return { weightKg: top + jump, kind: "up", reason, targetReps: minimum, ready: true };
    }
    if (allHitMinimum) {
      if (effort !== undefined && effort >= 9) {
        return {
          weightKg: top,
          kind: "hold",
          targetReps: Math.min(...working.map((set) => set.reps)),
          reason: `${top}kg averaged RPE ${effort.toFixed(1)} — repeat it before adding reps`,
        };
      }
      const achieved = Math.min(...working.map((set) => set.reps));
      const nextReps = Math.min(maximum, achieved + 1);
      return {
        weightKg: top,
        kind: "reps",
        targetReps: nextReps,
        reason: `Keep ${top}kg and reach ${nextReps} reps on every set before adding load`,
      };
    }
    return {
      weightKg: top,
      kind: "hold",
      targetReps: minimum,
      reason: `Chase at least ${minimum} reps on every set at ${top}kg first`,
    };
  }
  return null;
}

export interface GhostSet {
  weight: number;
  reps: number;
}

/**
 * Ghost Mode: the full set list from the most recent finished session that
 * contained this exercise — the "ghost" the lifter races set-by-set.
 */
export function ghostSets(
  state: AppState,
  exerciseId: string,
  currentSessionId: string,
): GhostSet[] {
  const sessions = [...state.sessions]
    .filter((s) => s.endedAt && s.id !== currentSessionId)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sessions) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex && ex.sets.length > 0) {
      return ex.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
    }
  }
  return [];
}

/** Did the lifter beat the ghost set? Weight first, reps as tiebreak. */
export function beatsGhost(set: GhostSet, ghost: GhostSet): boolean {
  if (set.weight !== ghost.weight) return set.weight > ghost.weight;
  return set.reps > ghost.reps;
}

export interface ProgressionEntry {
  exerciseId: string;
  name: string;
  suggestion: Suggestion;
  lastWeight: number;
}

/**
 * Scan every lift the user has trained (>=2 completed sessions with working
 * sets) and return its progression call, "ready to move up" first. Powers the
 * Progression Ready coaching board — turns the RPE-aware engine into an
 * at-a-glance "what do I load next" answer across the whole programme.
 */
export function progressionBoard(state: AppState): ProgressionEntry[] {
  // Collect every weighted exercise id + its most recent target-rep string.
  const targetByExercise = new Map<string, string>();
  const sessionCount = new Map<string, number>();
  for (const s of [...state.sessions]
    .filter((x) => x.endedAt)
    .sort((a, b) => b.date.localeCompare(a.date))) {
    for (const e of s.exercises) {
      if (!e.sets.some((set) => set.weight > 0)) continue;
      sessionCount.set(e.exerciseId, (sessionCount.get(e.exerciseId) ?? 0) + 1);
      if (!targetByExercise.has(e.exerciseId)) {
        targetByExercise.set(e.exerciseId, e.targetReps || "8");
      }
    }
  }

  const entries: ProgressionEntry[] = [];
  for (const [exerciseId, targetReps] of targetByExercise) {
    if ((sessionCount.get(exerciseId) ?? 0) < 2) continue;
    const suggestion = suggestNextWeight(state, exerciseId, targetReps);
    if (!suggestion) continue;
    const hist = topSetHistory(state, exerciseId, 1);
    entries.push({
      exerciseId,
      name: getExercise(exerciseId)?.name ?? exerciseId,
      suggestion,
      lastWeight: hist[0]?.weight ?? 0,
    });
  }
  // Load increases first, then rep progress, then holds.
  return entries.sort((a, b) => {
    const rank = { up: 0, reps: 1, hold: 2, reduce: 3 } as const;
    const ra = rank[a.suggestion.kind];
    const rb = rank[b.suggestion.kind];
    if (ra !== rb) return ra - rb;
    return b.lastWeight - a.lastWeight;
  });
}
