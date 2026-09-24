import { countsForRecords, setVolume } from "./set-tracking";
import type { CompletedSet, WorkoutSession } from "./types";

type Best = { key: string; name: string; set: CompletedSet };
export type SessionComparisonRow = Best & {
  previous?: CompletedSet;
  previousDate?: string;
  status: "baseline" | "improved" | "matched" | "different";
};

function validSet(set: CompletedSet) {
  if (!countsForRecords(set) || !Number.isFinite(set.weight) || set.weight < 0) return false;
  if (set.mode === "duration")
    return set.reps === 0 && Number.isFinite(set.seconds) && set.seconds! > 0;
  if (set.mode === "distance")
    return set.reps === 0 && Number.isFinite(set.meters) && set.meters! > 0;
  return Number.isInteger(set.reps) && set.reps > 0;
}

/** Best recorded effort per movement/mode, combining repeat occurrences. */
function bests(session: WorkoutSession): Map<string, Best> {
  const result = new Map<string, Best>();
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (!validSet(set)) continue;
      const key = JSON.stringify([exercise.exerciseId, set.mode ?? "weight"]);
      const previous = result.get(key)?.set;
      const better =
        !previous ||
        (set.mode === "duration"
          ? set.seconds! > previous.seconds!
          : set.mode === "distance"
            ? set.meters! > previous.meters!
            : set.weight > previous.weight ||
              (set.weight === previous.weight && set.reps > previous.reps));
      if (better) result.set(key, { key, name: exercise.name, set: { ...set } });
    }
  }
  return result;
}

function previousSessions(current: WorkoutSession, history: WorkoutSession[]) {
  const start = Date.parse(current.startedAt);
  if (!Number.isFinite(start)) return [];
  return history
    .filter((item) => {
      const began = Date.parse(item.startedAt);
      const ended = Date.parse(item.endedAt ?? "");
      return (
        item.id !== current.id &&
        Number.isFinite(began) &&
        Number.isFinite(ended) &&
        began < start &&
        ended >= began &&
        ended <= start
      );
    })
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

function change(current: CompletedSet, previous: CompletedSet): SessionComparisonRow["status"] {
  if (current.mode) {
    if (current.weight !== previous.weight) return "different";
    const now = current.mode === "duration" ? current.seconds! : current.meters!;
    const before = current.mode === "duration" ? previous.seconds! : previous.meters!;
    return now > before ? "improved" : now === before ? "matched" : "different";
  }
  if (current.weight === previous.weight && current.reps === previous.reps) return "matched";
  // A heavier single isn't automatically an improvement on a lighter ten.
  return current.weight >= previous.weight && current.reps >= previous.reps
    ? "improved"
    : "different";
}

export function compareSessionLifts(
  current: WorkoutSession,
  history: WorkoutSession[],
): SessionComparisonRow[] {
  const end = Date.parse(current.endedAt ?? "");
  const start = Date.parse(current.startedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const currentBests = bests(current);
  const previousByKey = new Map<string, { set: CompletedSet; date: string }>();
  for (const session of previousSessions(current, history)) {
    for (const [key, best] of bests(session)) {
      if (currentBests.has(key) && !previousByKey.has(key))
        previousByKey.set(key, { set: best.set, date: session.date });
    }
    if (previousByKey.size === currentBests.size) break;
  }
  return [...currentBests.values()].map((best) => {
    const previous = previousByKey.get(best.key);
    return {
      ...best,
      previous: previous?.set,
      previousDate: previous?.date,
      status: previous ? change(best.set, previous.set) : "baseline",
    };
  });
}

/** Only show live tonnage pacing against the same prescription, never a
 * future workout, another routine sharing a label, or a longer Time Fit plan. */
export function comparablePreviousVolume(current: WorkoutSession, history: WorkoutSession[]) {
  const shape = (session: WorkoutSession) =>
    JSON.stringify(
      session.exercises.map((item) => [
        item.exerciseId,
        item.tracking ?? "WEIGHT",
        item.targetSets,
        item.targetReps,
        item.targetSeconds ?? null,
      ]),
    );
  const signature = shape(current);
  const previous = previousSessions(current, history).find(
    (item) => item.label === current.label && shape(item) === signature,
  );
  if (!previous) return null;
  const volume = previous.exercises.reduce(
    (sum, item) =>
      sum +
      item.sets.reduce(
        (total, set) => total + (validSet({ ...set, kind: undefined }) ? setVolume(set) : 0),
        0,
      ),
    0,
  );
  return Number.isFinite(volume) && volume > 0 ? { volume, date: previous.date } : null;
}
