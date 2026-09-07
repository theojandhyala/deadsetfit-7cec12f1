import { registerPlugin } from "@capacitor/core";

import { isNativeIos } from "./platform";
import { isWorkingSet, trackingModeFor } from "./set-tracking";
import { getExercise } from "./exercises";
import { DEFAULT_BAR_KG } from "./bars";
import type { AppState, CompletedSet, WorkoutSession } from "./types";

/** What the phone publishes to the watch for one movement. */
export interface WatchExercisePayload {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  weight: number;
  tracking: "WEIGHT" | "DURATION" | "DISTANCE";
  targetSeconds?: number;
  restSeconds: number;
  /** Bar this movement is loaded on, so the wrist can show plates per side. */
  barKg: number;
  /** What was done last time, so the wrist knows the target too. */
  ghost: WatchSetPayload[];
  /** The last four completed performances for this movement, newest first. */
  history: WatchExerciseHistoryPayload[];
  sets: Array<{
    weight: number;
    reps: number;
    kind?: string;
    mode?: string;
    seconds?: number;
    meters?: number;
    isPR: boolean;
  }>;
}

export interface WatchExerciseHistoryPayload {
  /** Local workout date in YYYY-MM-DD form. */
  date: string;
  /** Working sets only; warm-ups and drop sets never become performance history. */
  sets: WatchSetPayload[];
}

/** One set, as the watch draws it. */
export interface WatchSetPayload {
  weight: number;
  reps: number;
  kind?: string;
  mode?: string;
  seconds?: number;
  meters?: number;
  isPR: boolean;
}

export interface WatchStatePayload {
  sessionId: string | null;
  label: string;
  exercises: WatchExercisePayload[];
}

/** Something the athlete did on the wrist, for the phone to apply. */
export interface WatchAction {
  id: string;
  kind: "logSet" | "undoSet" | "finish";
  sessionId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  mode?: "duration" | "distance";
  seconds?: number;
  meters?: number;
}

export interface WatchStatus {
  supported: boolean;
  paired: boolean;
  installed: boolean;
  reachable: boolean;
}

interface WatchBridgePlugin {
  status(): Promise<WatchStatus>;
  publish(state: WatchStatePayload): Promise<{ published: boolean }>;
  drain(): Promise<{ actions: WatchAction[] }>;
  addListener(
    event: "watchAction",
    handler: (action: WatchAction) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    event: "watchStatus",
    handler: (status: WatchStatus) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const WatchBridge = registerPlugin<WatchBridgePlugin>("WatchBridge");

const OFFLINE: WatchStatus = {
  supported: false,
  paired: false,
  installed: false,
  reachable: false,
};

/** The watch link only exists inside the native iOS shell. */
export function watchSupported(): boolean {
  return isNativeIos();
}

export async function watchStatus(): Promise<WatchStatus> {
  if (!watchSupported()) return OFFLINE;
  try {
    return await WatchBridge.status();
  } catch {
    return OFFLINE;
  }
}

/**
 * Shape a live session for the wrist.
 *
 * Exported and pure so the projection is testable without a device: it is the
 * one piece of watch logic that can be got wrong silently, because a wrong
 * field just renders as a plausible-looking zero on a screen no test can see.
 */
function projectSet(set: CompletedSet): WatchSetPayload {
  return {
    weight: set.weight,
    reps: set.reps,
    ...(set.kind ? { kind: set.kind } : {}),
    ...(set.mode ? { mode: set.mode } : {}),
    ...(set.seconds ? { seconds: set.seconds } : {}),
    ...(set.meters ? { meters: set.meters } : {}),
    isPR: set.isPR === true,
  };
}

/**
 * What this movement looked like the last time it was trained. The wrist gets
 * the target, not just the plan — beating last week is the whole point, and
 * having to check the phone for it defeats the watch.
 */
function ghostFor(
  sessions: WorkoutSession[],
  exerciseId: string,
  currentSessionId: string,
): WatchSetPayload[] {
  const previous = [...sessions]
    .filter((s) => s.endedAt && s.id !== currentSessionId)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const session of previous) {
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (exercise && exercise.sets.length > 0) return exercise.sets.map(projectSet);
  }
  return [];
}

/**
 * The four most recent completed performances for a movement.
 *
 * This is deliberately derived by the phone. The watch remains a display and
 * remote control, never a second owner of training history. Ordering uses the
 * completed timestamp when available so two workouts on one day still appear
 * in the order they actually finished.
 */
export function exerciseHistoryForWatch(
  sessions: WorkoutSession[],
  exerciseId: string,
  currentSessionId: string,
): WatchExerciseHistoryPayload[] {
  return [...sessions]
    .filter((session) => session.endedAt && session.id !== currentSessionId)
    .sort((a, b) => {
      const aAt = a.endedAt ?? a.startedAt ?? a.date;
      const bAt = b.endedAt ?? b.startedAt ?? b.date;
      return bAt.localeCompare(aAt);
    })
    .flatMap((session) => {
      const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
      if (!exercise) return [];
      const sets = exercise.sets.filter(isWorkingSet).map(projectSet);
      return sets.length ? [{ date: session.date, sets }] : [];
    })
    .slice(0, 4);
}

export function projectSession(
  state: Pick<AppState, "savedExercises" | "restTimerSeconds"> & { sessions?: WorkoutSession[] },
  session: WorkoutSession | null | undefined,
): WatchStatePayload {
  if (!session || session.endedAt) {
    return { sessionId: null, label: "", exercises: [] };
  }
  const defaultRest = state.restTimerSeconds ?? 90;
  return {
    sessionId: session.id,
    label: session.label,
    exercises: session.exercises.map((exercise) => {
      const definition = getExercise(exercise.exerciseId, state.savedExercises);
      const tracking =
        exercise.tracking ??
        trackingModeFor(
          { name: exercise.name, tracking: definition?.tracking },
          exercise.targetReps,
        );
      // The weight the watch should offer with one tap: the plan's, else the
      // last set actually performed on this movement today.
      const lastWorking = [...exercise.sets].reverse().find((set) => !set.kind && !set.mode);
      return {
        id: exercise.exerciseId,
        name: exercise.name,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
        weight: exercise.plannedWeightKg ?? lastWorking?.weight ?? 0,
        tracking,
        ...(exercise.targetSeconds ? { targetSeconds: exercise.targetSeconds } : {}),
        restSeconds: exercise.restSeconds ?? defaultRest,
        barKg: exercise.barKg ?? DEFAULT_BAR_KG,
        ghost: ghostFor(state.sessions ?? [], exercise.exerciseId, session.id),
        history: exerciseHistoryForWatch(
          state.sessions ?? [],
          exercise.exerciseId,
          session.id,
        ),
        sets: exercise.sets.map(projectSet),
      };
    }),
  };
}

/** Push the live session to the watch. Silently a no-op off native iOS. */
export async function publishToWatch(
  state: Pick<AppState, "savedExercises" | "restTimerSeconds"> & { sessions?: WorkoutSession[] },
  session: WorkoutSession | null | undefined,
): Promise<void> {
  if (!watchSupported()) return;
  try {
    await WatchBridge.publish(projectSession(state, session));
  } catch {
    // A failed publish must never interrupt training: the watch falls back to
    // whatever it last received, and the next set re-publishes.
  }
}

/** Clear the watch back to its idle screen. */
export async function clearWatch(): Promise<void> {
  if (!watchSupported()) return;
  try {
    await WatchBridge.publish({ sessionId: null, label: "", exercises: [] });
  } catch {
    // Same reasoning as publishToWatch.
  }
}

/**
 * Everything the watch sent while this web layer was suspended.
 *
 * iOS freezes the WKWebView when the app backgrounds, so sets logged on the
 * wrist with the phone in a pocket are buffered natively and collected here on
 * the next resume. Without this call they would be recorded natively and never
 * reach the app's state.
 */
export async function drainWatchActions(): Promise<WatchAction[]> {
  if (!watchSupported()) return [];
  try {
    const { actions } = await WatchBridge.drain();
    return actions ?? [];
  } catch {
    return [];
  }
}

/** Listen for sets logged on the wrist while the app is in the foreground. */
export async function onWatchAction(handler: (action: WatchAction) => void): Promise<() => void> {
  if (!watchSupported()) return () => {};
  try {
    const listener = await WatchBridge.addListener("watchAction", handler);
    return () => void listener.remove();
  } catch {
    return () => {};
  }
}
