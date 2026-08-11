import type { WorkoutSession } from "./types";
import { estimate1RM } from "./calc";

// Throwback — the receipts of progress. Finds a lift logged months ago and
// shows how far its estimated 1RM has come since. Only speaks when the
// story is good; nobody needs an anniversary card about regression.

export interface Throwback {
  exercise: string;
  daysAgo: number;
  thenWeight: number;
  thenReps: number;
  thenE1rm: number;
  nowE1rm: number;
  gainKg: number;
}

const DAY_MS = 86_400_000;
/** Anchors oldest-first: a year beats a quarter when both exist. */
const ANCHORS: { days: number; tolerance: number }[] = [
  { days: 365, tolerance: 14 },
  { days: 180, tolerance: 10 },
  { days: 90, tolerance: 7 },
];
const RECENT_DAYS = 21;
const MIN_GAIN_KG = 2.5;

interface BestSet {
  weight: number;
  reps: number;
  e1rm: number;
}

/** Best (highest-e1RM) working set per exercise across the given sessions. */
function bestByExercise(sessions: WorkoutSession[]): Map<string, BestSet> {
  const best = new Map<string, BestSet>();
  for (const s of sessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        // e1RM formulas lose meaning past ~12 reps; skip endurance sets.
        if (set.kind === "warmup" || set.weight <= 0 || set.reps <= 0 || set.reps > 12) continue;
        const e1rm = estimate1RM(set.weight, set.reps);
        const cur = best.get(ex.name);
        if (!cur || e1rm > cur.e1rm) best.set(ex.name, { weight: set.weight, reps: set.reps, e1rm });
      }
    }
  }
  return best;
}

export function throwback(sessions: WorkoutSession[], todayIso: string): Throwback | null {
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(today)) return null;
  const finished = (sessions ?? []).filter((s) => s.endedAt);
  if (!finished.length) return null;

  const inRange = (fromMs: number, toMs: number) =>
    finished.filter((s) => {
      const at = new Date(`${s.date}T00:00:00Z`).getTime();
      return Number.isFinite(at) && at >= fromMs && at <= toMs;
    });

  const nowBest = bestByExercise(inRange(today - RECENT_DAYS * DAY_MS, today));
  if (!nowBest.size) return null;

  for (const anchor of ANCHORS) {
    const center = today - anchor.days * DAY_MS;
    const thenSessions = inRange(
      center - anchor.tolerance * DAY_MS,
      center + anchor.tolerance * DAY_MS,
    );
    if (!thenSessions.length) continue;
    const thenBest = bestByExercise(thenSessions);

    let pick: Throwback | null = null;
    for (const [name, then] of thenBest) {
      const now = nowBest.get(name);
      if (!now) continue;
      const gain = now.e1rm - then.e1rm;
      if (gain < MIN_GAIN_KG) continue;
      if (!pick || gain > pick.gainKg) {
        pick = {
          exercise: name,
          daysAgo: anchor.days,
          thenWeight: then.weight,
          thenReps: then.reps,
          thenE1rm: then.e1rm,
          nowE1rm: now.e1rm,
          gainKg: gain,
        };
      }
    }
    if (pick) return pick;
  }
  return null;
}
