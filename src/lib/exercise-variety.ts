import type { Equipment, Exercise, WorkoutSession } from "./types";
import { toMuscleGroup, type MuscleGroup } from "./recovery";

// Fresh stimulus — spots muscle groups that have been fed the exact same
// movement for weeks and offers a concrete alternative from the library.
// Variation isn't novelty for its own sake: a stalled lift often moves again
// the week its stimulus changes.

export interface StaleMuscle {
  muscle: MuscleGroup;
  /** The single movement this muscle has been living on. */
  exerciseName: string;
  sessionsCount: number;
  suggestions: { id: string; name: string }[];
}

const MIN_SESSIONS = 6;
const DAY_MS = 86_400_000;

export function staleMuscles(
  sessions: WorkoutSession[],
  library: Exercise[],
  equipment: Equipment,
  todayIso: string,
  windowDays = 56,
): StaleMuscle[] {
  const since = new Date(`${todayIso}T00:00:00Z`).getTime() - windowDays * DAY_MS;

  const namesByMuscle = new Map<MuscleGroup, Set<string>>();
  const sessionsByMuscle = new Map<MuscleGroup, number>();

  for (const s of sessions ?? []) {
    if (!s.endedAt) continue;
    const at = new Date(`${s.date}T00:00:00Z`).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    const groupsThisSession = new Set<MuscleGroup>();
    for (const ex of s.exercises) {
      // A hold or a carry is real work even though it logs no reps.
      if (
        !ex.sets.some((set) => set.kind !== "warmup" && (set.reps > 0 || set.mode !== undefined))
      )
        continue;
      for (const raw of ex.primary_muscles ?? []) {
        const g = toMuscleGroup(raw);
        if (!g) continue;
        groupsThisSession.add(g);
        let names = namesByMuscle.get(g);
        if (!names) namesByMuscle.set(g, (names = new Set()));
        names.add(ex.name);
      }
    }
    for (const g of groupsThisSession) {
      sessionsByMuscle.set(g, (sessionsByMuscle.get(g) ?? 0) + 1);
    }
  }

  const out: StaleMuscle[] = [];
  for (const [muscle, names] of namesByMuscle) {
    const count = sessionsByMuscle.get(muscle) ?? 0;
    if (names.size !== 1 || count < MIN_SESSIONS) continue;
    const only = [...names][0];
    const suggestions = library
      .filter(
        (e) =>
          e.muscleGroup === muscle &&
          e.equipment.includes(equipment) &&
          e.name.toLowerCase() !== only.toLowerCase(),
      )
      .slice(0, 2)
      .map((e) => ({ id: e.id, name: e.name }));
    if (!suggestions.length) continue;
    out.push({ muscle, exerciseName: only, sessionsCount: count, suggestions });
  }

  // Worst offender first; two callouts max so the card nudges, not nags.
  return out.sort((a, b) => b.sessionsCount - a.sessionsCount).slice(0, 2);
}
