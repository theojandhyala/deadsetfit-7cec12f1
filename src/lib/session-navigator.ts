import { completedWorkingSets } from "./workout-flow";
import type { WorkoutSessionExercise } from "./types";

/** Read-only working-set progress. Warm-ups/drop sets never fill the plan. */
export function sessionNavigator(exercises: WorkoutSessionExercise[]) {
  const rows = exercises.map((exercise, index) => {
    const completed = completedWorkingSets(exercise.sets);
    const target = Number.isFinite(exercise.targetSets)
      ? Math.max(0, Math.floor(exercise.targetSets))
      : 0;
    const planned = Math.max(target, completed);
    const remaining = Math.max(0, target - completed);
    return {
      index,
      name: exercise.name,
      completed,
      planned,
      remaining,
      done: planned > 0 && remaining === 0,
      started: completed > 0,
      superset: Boolean(exercise.supersetId),
    };
  });
  return {
    rows,
    completed: rows.reduce((sum, row) => sum + row.completed, 0),
    planned: rows.reduce((sum, row) => sum + row.planned, 0),
    remaining: rows.reduce((sum, row) => sum + row.remaining, 0),
    finishedExercises: rows.filter((row) => row.done).length,
  };
}

/** Find another unfinished movement, wrapping without changing the workout order. */
export function nextUnfinishedExercise(exercises: WorkoutSessionExercise[], active: number) {
  const { rows } = sessionNavigator(exercises);
  if (!rows.length) return null;
  const start = Number.isInteger(active) && active >= 0 && active < rows.length ? active : -1;
  for (let offset = 1; offset <= rows.length; offset++) {
    const index = (start + offset) % rows.length;
    if (rows[index].remaining > 0) return index;
  }
  return null;
}

/** Wall-clock elapsed time, including lock-screen time. Invalid/future starts are safe. */
export function sessionElapsedSeconds(startedAt: string, now = Date.now()) {
  const start = Date.parse(startedAt);
  return Number.isFinite(start) && Number.isFinite(now)
    ? Math.max(0, Math.floor((now - start) / 1000))
    : 0;
}

export function formatSessionClock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = String(safe % 60).padStart(2, "0");
  return hours ? `${hours}:${String(mins).padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
}
