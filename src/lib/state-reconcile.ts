import type {
  AppState,
  CompletedSet,
  WorkoutSession,
  WorkoutSessionExercise,
} from "./types";

function newerSnapshot(local: AppState, remote: AppState) {
  const localAt = Date.parse(local.syncMeta?.updatedAt ?? "") || 0;
  const remoteAt = Date.parse(remote.syncMeta?.updatedAt ?? "") || 0;
  return localAt >= remoteAt ? local : remote;
}

function unionBy<T>(preferred: T[], other: T[], key: (item: T) => string): T[] {
  const result = new Map<string, T>();
  for (const item of other) result.set(key(item), item);
  for (const item of preferred) result.set(key(item), item);
  return [...result.values()];
}

function setKey(set: CompletedSet) {
  return [set.kind ?? "working", set.weight, set.reps, set.rpe ?? "", set.isAmrap ? 1 : 0].join(":");
}

function mergeSets(preferred: CompletedSet[], other: CompletedSet[]) {
  const result = [...preferred];
  const counts = new Map<string, number>();
  for (const set of preferred) counts.set(setKey(set), (counts.get(setKey(set)) ?? 0) + 1);
  const consumed = new Map<string, number>();
  for (const set of other) {
    const key = setKey(set);
    const seen = consumed.get(key) ?? 0;
    consumed.set(key, seen + 1);
    if (seen >= (counts.get(key) ?? 0)) result.push(set);
  }
  return result;
}

function mergeExercise(
  preferred: WorkoutSessionExercise,
  other: WorkoutSessionExercise,
): WorkoutSessionExercise {
  // Sets have no legacy id/timestamp. Preserve ordering from the most complete
  // device and append only distinct sets seen on the other device.
  const preferredSets = preferred.sets.length >= other.sets.length ? preferred.sets : other.sets;
  const otherSets = preferredSets === preferred.sets ? other.sets : preferred.sets;
  return {
    ...other,
    ...preferred,
    sets: mergeSets(preferredSets, otherSets),
  };
}

function sessionWork(session: WorkoutSession) {
  return session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

export function mergeWorkoutSession(
  preferred: WorkoutSession,
  other: WorkoutSession,
): WorkoutSession {
  const primary =
    Boolean(preferred.endedAt) !== Boolean(other.endedAt)
      ? preferred.endedAt
        ? preferred
        : other
      : sessionWork(preferred) >= sessionWork(other)
        ? preferred
        : other;
  const secondary = primary === preferred ? other : preferred;
  const byId = new Map(secondary.exercises.map((exercise) => [exercise.exerciseId, exercise]));
  const exercises = primary.exercises.map((exercise) => {
    const alternate = byId.get(exercise.exerciseId);
    byId.delete(exercise.exerciseId);
    return alternate ? mergeExercise(exercise, alternate) : exercise;
  });
  exercises.push(...byId.values());
  return {
    ...secondary,
    ...primary,
    exercises,
    endedAt: preferred.endedAt ?? other.endedAt,
    totalVolume: Math.max(preferred.totalVolume, other.totalVolume),
    prCount: Math.max(preferred.prCount, other.prCount),
  };
}

/**
 * Conflict-safe merge for the single-blob account payload.
 *
 * Editable preferences come from the newest snapshot, while training history
 * is append-only and merged by stable identity. This prevents an older phone
 * from erasing sessions, measurements or PRs created on a newer phone.
 */
export function mergeAppStates(local: AppState, remote: AppState): AppState {
  const preferred = newerSnapshot(local, remote);
  const other = preferred === local ? remote : local;

  const sessions = unionBy(preferred.sessions, other.sessions, (session) => session.id).map(
    (session) => {
      const left = local.sessions.find((item) => item.id === session.id);
      const right = remote.sessions.find((item) => item.id === session.id);
      return left && right ? mergeWorkoutSession(session, session === left ? right : left) : session;
    },
  );
  const sessionIds = new Set(sessions.map((session) => session.id));
  const preferredActive = preferred.activeSessionId;
  const otherActive = other.activeSessionId;
  const activeSessionId =
    (preferredActive && sessionIds.has(preferredActive) ? preferredActive : null) ??
    (otherActive && sessionIds.has(otherActive) ? otherActive : null);

  const manualPRs = { ...(other.manualPRs ?? {}) };
  for (const [exerciseId, record] of Object.entries(preferred.manualPRs ?? {})) {
    const existing = manualPRs[exerciseId];
    if (!existing || record.date >= existing.date || record.value > existing.value) {
      manualPRs[exerciseId] = record;
    }
  }

  return {
    ...other,
    ...preferred,
    sessions,
    activeSessionId,
    completedDates: [...new Set([...other.completedDates, ...preferred.completedDates])].sort(),
    logs: unionBy(preferred.logs, other.logs, (item) =>
      [item.date, item.exerciseId, item.weight, item.reps].join(":"),
    ),
    checkIns: unionBy(preferred.checkIns, other.checkIns, (item) => item.date),
    weights: unionBy(preferred.weights, other.weights, (item) => item.date),
    measurements: unionBy(preferred.measurements, other.measurements, (item) => item.date),
    foodLog: unionBy(preferred.foodLog, other.foodLog, (item) =>
      [item.date, item.name, item.calories, item.protein, item.carbs, item.fats].join(":"),
    ),
    water: unionBy(preferred.water, other.water, (item) => `${item.date}:${item.at}:${item.ml}`),
    programs: unionBy(preferred.programs, other.programs, (item) => item.id),
    programFolders: unionBy(
      preferred.programFolders ?? [],
      other.programFolders ?? [],
      (item) => item.id,
    ),
    savedExercises: unionBy(preferred.savedExercises, other.savedExercises, (item) => item.id),
    challengeRecords: unionBy(
      preferred.challengeRecords ?? [],
      other.challengeRecords ?? [],
      (item) => `${item.challengeId}:${item.date}:${item.value}`,
    ),
    strengthGoals: unionBy(
      preferred.strengthGoals ?? [],
      other.strengthGoals ?? [],
      (item) => item.exerciseId,
    ),
    manualPRs,
  };
}
