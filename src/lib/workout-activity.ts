import { registerPlugin } from "@capacitor/core";

import { isNativeIos } from "./platform";
import { setVolume } from "./set-tracking";
import { completedWorkingSets } from "./workout-flow";
import type { WorkoutSession } from "./types";

/**
 * The live workout on the Lock Screen and Dynamic Island.
 *
 * Separate from the rest-timer activity: rest answers "how long until the next
 * set", this answers "where am I in this session", and both can be on screen
 * together.
 *
 * The elapsed clock is never sent. `startedAtMs` goes over once and iOS renders
 * the running time from it, so updates only happen when a set actually lands —
 * which matters, because Live Activity updates are rate-limited and the ones
 * over budget are simply dropped.
 */
export interface WorkoutActivityState {
  label: string;
  exerciseName: string;
  setsDone: number;
  setsPlanned: number;
  volumeKg: number;
  prCount: number;
  startedAtMs: number;
}

interface WorkoutActivityPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  start(state: WorkoutActivityState): Promise<{ started: boolean }>;
  update(state: WorkoutActivityState): Promise<{ updated: boolean }>;
  end(): Promise<{ ended: boolean }>;
}

const Native = registerPlugin<WorkoutActivityPlugin>("WorkoutActivity");

/**
 * Project a live session into what the activity shows.
 *
 * Pure and exported, because a Live Activity is invisible during development —
 * a wrong number here would ship and sit on people's Lock Screens unnoticed.
 */
export function projectActivity(
  session: WorkoutSession,
  activeIndex: number,
): WorkoutActivityState {
  let setsDone = 0;
  let setsPlanned = 0;
  let volumeKg = 0;
  let prCount = 0;

  for (const exercise of session.exercises) {
    const working = completedWorkingSets(exercise.sets);
    setsDone += working;
    // The plan never lags reality: extra sets past the target still count
    // toward the denominator, so progress can't read as 5/3.
    setsPlanned += Math.max(exercise.targetSets, working);
    for (const set of exercise.sets) {
      volumeKg += setVolume(set);
      if (set.isPR) prCount += 1;
    }
  }

  const current = session.exercises[activeIndex] ?? session.exercises[0];
  return {
    label: session.label || "WORKOUT",
    exerciseName: current?.name ?? "",
    setsDone,
    setsPlanned,
    volumeKg: Math.round(volumeKg),
    prCount,
    startedAtMs: new Date(session.startedAt).getTime() || Date.now(),
  };
}

export async function isWorkoutActivitySupported(): Promise<boolean> {
  if (!isNativeIos()) return false;
  try {
    const { supported } = await Native.isSupported();
    return supported === true;
  } catch {
    return false;
  }
}

/**
 * Start or refresh the activity for this session. Starting twice is safe — the
 * native side updates the existing activity rather than stacking a second card
 * on the Lock Screen.
 */
export async function syncWorkoutActivity(
  session: WorkoutSession,
  activeIndex: number,
): Promise<void> {
  if (!isNativeIos()) return;
  try {
    await Native.start(projectActivity(session, activeIndex));
  } catch {
    // Live Activities can be switched off per app. Failing to show one is
    // never a reason to interrupt a workout.
  }
}

export async function endWorkoutActivity(): Promise<void> {
  if (!isNativeIos()) return;
  try {
    await Native.end();
  } catch {
    // Same reasoning as above.
  }
}
