import type { AppState, WorkoutSession } from "./types";

export interface WorkoutImportMergeResult {
  state: AppState;
  addedSessions: number;
  duplicateSessions: number;
  addedSets: number;
}

function setCount(session: WorkoutSession) {
  return session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

/**
 * Append imported history without allowing a migration file to overwrite any
 * current plan, profile, live session or existing workout. Parser-generated
 * IDs are stable for a source workout/date pair, so re-importing the same file
 * is safely idempotent.
 */
export function mergeWorkoutImport(
  current: AppState,
  imported: WorkoutSession[],
): WorkoutImportMergeResult {
  const known = new Set(current.sessions.map((session) => session.id));
  const additions = imported.filter((session) => !known.has(session.id));
  const sessions = [...current.sessions, ...additions].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
  const completedDates = [
    ...new Set([
      ...current.completedDates,
      ...additions.filter((session) => session.endedAt).map((session) => session.date.slice(0, 10)),
    ]),
  ].sort();

  return {
    state: { ...current, sessions, completedDates },
    addedSessions: additions.length,
    duplicateSessions: imported.length - additions.length,
    addedSets: additions.reduce((total, session) => total + setCount(session), 0),
  };
}
