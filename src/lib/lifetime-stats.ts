import type { WorkoutSession } from "./types";

// Lifetime training story — every number computed from sessions the athlete
// already finished. No AI, no server, $0 per user.

export interface LifetimeStats {
  sessions: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  hoursTrained: number;
  longestStreakDays: number;
  daysActive: number;
  firstSessionDate: string | null;
  topExercise: { name: string; sets: number } | null;
  heaviestSet: { name: string; weight: number; reps: number } | null;
  /** Fun scale: total tonnage expressed in real-world objects. */
  equivalent: { count: number; label: string } | null;
}

/**
 * Real-world objects, ascending. Tonnage is shown as the largest object the
 * athlete has out-lifted at least once — "3 family cars" lands harder than
 * "4,512 kg".
 */
const OBJECTS: { kg: number; label: string; plural: string }[] = [
  { kg: 180, label: "silverback gorilla", plural: "silverback gorillas" },
  { kg: 450, label: "grand piano", plural: "grand pianos" },
  { kg: 1500, label: "family car", plural: "family cars" },
  { kg: 6000, label: "African elephant", plural: "African elephants" },
  { kg: 41_000, label: "Boeing 737", plural: "Boeing 737s" },
  { kg: 140_000, label: "blue whale", plural: "blue whales" },
];

export function tonnageEquivalent(totalKg: number): { count: number; label: string } | null {
  for (let i = OBJECTS.length - 1; i >= 0; i--) {
    const o = OBJECTS[i];
    const count = Math.floor(totalKg / o.kg);
    if (count >= 1) return { count, label: count === 1 ? o.label : o.plural };
  }
  return null;
}

/** Longest run of consecutive calendar days in `completedDates`. */
export function longestStreak(completedDates: string[]): number {
  const days = [...new Set(completedDates)].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    const t = new Date(`${d}T00:00:00Z`).getTime();
    if (!Number.isFinite(t)) continue;
    run = prev !== null && t - prev === 86_400_000 ? run + 1 : 1;
    prev = t;
    if (run > best) best = run;
  }
  return best;
}

// A session accidentally left running overnight would otherwise dominate
// "hours trained" forever — clamp each session to a plausible ceiling.
const MAX_SESSION_MS = 4 * 3_600_000;

export function lifetimeStats(
  sessions: WorkoutSession[],
  completedDates: string[],
): LifetimeStats | null {
  const finished = (sessions ?? []).filter((s) => s.endedAt);
  if (!finished.length) return null;

  let volume = 0;
  let sets = 0;
  let reps = 0;
  let ms = 0;
  let firstDate: string | null = null;
  const setsByExercise = new Map<string, number>();
  let heaviest: { name: string; weight: number; reps: number } | null = null;

  for (const s of finished) {
    if (!firstDate || s.date < firstDate) firstDate = s.date;
    const started = new Date(s.startedAt).getTime();
    const ended = new Date(s.endedAt!).getTime();
    if (Number.isFinite(started) && Number.isFinite(ended) && ended > started) {
      ms += Math.min(ended - started, MAX_SESSION_MS);
    }
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (set.kind === "warmup" || set.reps <= 0) continue;
        sets += 1;
        reps += set.reps;
        volume += set.weight * set.reps;
        setsByExercise.set(ex.name, (setsByExercise.get(ex.name) ?? 0) + 1);
        if (set.weight > 0 && (!heaviest || set.weight > heaviest.weight)) {
          heaviest = { name: ex.name, weight: set.weight, reps: set.reps };
        }
      }
    }
  }

  let topExercise: { name: string; sets: number } | null = null;
  for (const [name, n] of setsByExercise) {
    if (!topExercise || n > topExercise.sets) topExercise = { name, sets: n };
  }

  return {
    sessions: finished.length,
    totalVolumeKg: Math.round(volume),
    totalSets: sets,
    totalReps: reps,
    hoursTrained: Math.round((ms / 3_600_000) * 10) / 10,
    longestStreakDays: longestStreak(completedDates ?? []),
    daysActive: new Set(completedDates ?? []).size,
    firstSessionDate: firstDate,
    topExercise,
    heaviestSet: heaviest,
    equivalent: tonnageEquivalent(volume),
  };
}
