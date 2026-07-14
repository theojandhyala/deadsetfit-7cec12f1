import type { AppState } from "./types";

export type MuscleGroup = "CHEST" | "BACK" | "SHOULDERS" | "ARMS" | "LEGS" | "CORE";

export const MUSCLE_GROUPS: MuscleGroup[] = ["CHEST", "BACK", "SHOULDERS", "ARMS", "LEGS", "CORE"];

export interface MuscleRecovery {
  muscle: MuscleGroup;
  /** 0-100, 100 = fully recovered */
  pct: number;
  /** ISO timestamp of the last session that hit this muscle, null if never */
  lastTrained: string | null;
  /** Sets that hit this muscle in that session */
  lastSets: number;
  /** Recovery window used, in hours */
  windowHours: number;
}

/** Map a free-form muscle name (program refs, static groups) to a group. */
export function toMuscleGroup(raw: string): MuscleGroup | null {
  const m = raw.trim().toLowerCase();
  if (!m) return null;
  if (m.includes("chest") || m.includes("pec")) return "CHEST";
  if (m.includes("lat") || m.includes("back") || m.includes("trap") || m.includes("rhomboid")) return "BACK";
  if (m.includes("delt") || m.includes("shoulder")) return "SHOULDERS";
  if (m.includes("bicep") || m.includes("tricep") || m.includes("forearm") || m.includes("arm")) return "ARMS";
  if (
    m.includes("quad") ||
    m.includes("hamstring") ||
    m.includes("glute") ||
    m.includes("calf") ||
    m.includes("calves") ||
    m.includes("leg")
  )
    return "LEGS";
  if (m.includes("ab") || m.includes("core") || m.includes("oblique")) return "CORE";
  return null;
}

/**
 * Per-muscle recovery from real session history.
 *
 * Model: the most recent session that hit a muscle starts a recovery window
 * of 48h plus 3h per set (capped at 72h total) — more volume, longer window.
 * Recovery climbs linearly across the window. Untrained muscles are fresh.
 */
export function muscleRecovery(state: AppState, now = Date.now()): MuscleRecovery[] {
  type Hit = { at: number; iso: string; sets: number };
  const latest = new Map<MuscleGroup, Hit>();

  for (const session of state.sessions) {
    const at = new Date(session.startedAt).getTime();
    if (!Number.isFinite(at)) continue;
    const perMuscle = new Map<MuscleGroup, number>();
    for (const ex of session.exercises) {
      const logged = ex.sets.length;
      if (logged === 0) continue;
      for (const raw of ex.primary_muscles ?? []) {
        const group = toMuscleGroup(raw);
        if (!group) continue;
        perMuscle.set(group, (perMuscle.get(group) ?? 0) + logged);
      }
    }
    for (const [group, sets] of perMuscle) {
      const existing = latest.get(group);
      if (!existing || at > existing.at) {
        latest.set(group, { at, iso: session.startedAt, sets });
      }
    }
  }

  return MUSCLE_GROUPS.map((muscle) => {
    const hit = latest.get(muscle);
    if (!hit) return { muscle, pct: 100, lastTrained: null, lastSets: 0, windowHours: 48 };
    const windowHours = Math.min(72, 48 + hit.sets * 3);
    const hoursSince = (now - hit.at) / 3_600_000;
    const pct = Math.max(0, Math.min(100, Math.round((hoursSince / windowHours) * 100)));
    return { muscle, pct, lastTrained: hit.iso, lastSets: hit.sets, windowHours };
  });
}

export function recoveryLabel(pct: number): { label: string; color: string } {
  if (pct >= 85) return { label: "FRESH", color: "#22c55e" };
  if (pct >= 50) return { label: "RECOVERING", color: "#fbbf24" };
  return { label: "FATIGUED", color: "#e63222" };
}
