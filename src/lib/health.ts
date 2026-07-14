import { registerPlugin } from "@capacitor/core";
import { isNativeIos } from "./platform";
import { isoDay } from "./calc";
import type { AppState, WorkoutSession } from "./types";

export interface HealthWorkout {
  id: string;
  start: string;
  end: string;
  activityType: string;
  calories: number;
  source: string;
}

interface HealthKitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<{ granted: boolean }>;
  queryWorkouts(options: { sinceIso?: string }): Promise<{ workouts: HealthWorkout[] }>;
  todayActiveEnergy(): Promise<{ kcal: number }>;
  saveWorkout(options: { startIso: string; endIso: string; calories?: number }): Promise<{ saved: boolean }>;
}

const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");

/** Health features only exist inside the native iOS shell. */
export function healthSupported(): boolean {
  return isNativeIos();
}

export async function connectHealth(): Promise<boolean> {
  if (!healthSupported()) return false;
  try {
    const { available } = await HealthKit.isAvailable();
    if (!available) return false;
    const { granted } = await HealthKit.requestAuthorization();
    return granted;
  } catch {
    return false;
  }
}

export async function todayActiveBurn(): Promise<number | null> {
  if (!healthSupported()) return null;
  try {
    const { kcal } = await HealthKit.todayActiveEnergy();
    return Math.round(kcal);
  } catch {
    return null;
  }
}

/** Write a finished DEADSET session to Apple Health (closes rings, shows on watch). */
export async function exportSessionToHealth(session: WorkoutSession): Promise<void> {
  if (!healthSupported() || !session.endedAt) return;
  try {
    await HealthKit.saveWorkout({ startIso: session.startedAt, endIso: session.endedAt });
  } catch {
    /* best effort — never block the finish flow */
  }
}

const HK_SESSION_PREFIX = "hk-";

/**
 * Import Apple Watch / Health workouts as finished DEADSET sessions.
 * Idempotent: sessions are keyed by the HealthKit UUID; DEADSET's own
 * exported workouts are skipped so they don't ping-pong back in.
 */
export async function importHealthWorkouts(state: AppState): Promise<AppState | null> {
  if (!healthSupported()) return null;
  const sync = state.healthSync;
  if (!sync?.enabled || !sync.importWorkouts) return null;
  try {
    const since =
      sync.lastImportIso ?? new Date(Date.now() - 7 * 86400000).toISOString();
    const { workouts } = await HealthKit.queryWorkouts({ sinceIso: since });
    if (!workouts.length) return null;

    const known = new Set(state.sessions.map((s) => s.id));
    const fresh = workouts.filter(
      (w) =>
        !known.has(HK_SESSION_PREFIX + w.id) &&
        !w.source.toUpperCase().includes("DEADSET") &&
        new Date(w.end).getTime() <= Date.now(),
    );
    if (!fresh.length) {
      return {
        ...state,
        healthSync: { ...sync, lastImportIso: new Date().toISOString() },
      };
    }

    const sessions = [...state.sessions];
    const completed = new Set(state.completedDates);
    for (const w of fresh) {
      const day = isoDay(new Date(w.start));
      sessions.push({
        id: HK_SESSION_PREFIX + w.id,
        date: day,
        dayKey: "MON", // display-only; watch imports aren't tied to the split
        label: `WATCH — ${w.activityType}`,
        programId: null,
        startedAt: w.start,
        endedAt: w.end,
        exercises: [],
        totalVolume: 0,
        prCount: 0,
      });
      completed.add(day);
    }
    return {
      ...state,
      sessions,
      completedDates: [...completed],
      healthSync: { ...sync, lastImportIso: new Date().toISOString() },
    };
  } catch {
    return null;
  }
}
