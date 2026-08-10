import type { WorkoutSession } from "./types";

// Time-of-day analysis — every session carries a start timestamp nobody was
// using. Morning lifter or evening lifter, the volume knows the truth.

export type SessionSlot = "MORNING" | "DAYTIME" | "EVENING";

export interface SlotStats {
  slot: SessionSlot;
  sessions: number;
  avgVolumeKg: number;
  prs: number;
}

export interface TimeOfDay {
  slots: SlotStats[];
  /** Highest average volume, minimum 3 sessions. */
  bestSlot: SessionSlot | null;
  advice: string | null;
}

const SLOT_ORDER: SessionSlot[] = ["MORNING", "DAYTIME", "EVENING"];
export const SLOT_NAME: Record<SessionSlot, string> = {
  MORNING: "morning",
  DAYTIME: "daytime",
  EVENING: "evening",
};
const DAY_MS = 86_400_000;
const MIN_SESSIONS = 8;
const MIN_SLOT_SESSIONS = 3;

function slotOf(startedAt: string): SessionSlot | null {
  const d = new Date(startedAt);
  const h = d.getHours(); // device-local hour — "morning" means the lifter's morning
  if (!Number.isFinite(h)) return null;
  if (h < 10) return "MORNING";
  if (h < 17) return "DAYTIME";
  return "EVENING";
}

export function timeOfDay(
  sessions: WorkoutSession[],
  todayIso: string,
  windowDays = 84,
): TimeOfDay | null {
  const since = new Date(`${todayIso}T00:00:00Z`).getTime() - windowDays * DAY_MS;

  const acc: Record<SessionSlot, { volume: number; sessions: number; prs: number }> = {
    MORNING: { volume: 0, sessions: 0, prs: 0 },
    DAYTIME: { volume: 0, sessions: 0, prs: 0 },
    EVENING: { volume: 0, sessions: 0, prs: 0 },
  };
  let total = 0;

  for (const s of sessions ?? []) {
    if (!s.endedAt) continue;
    const at = new Date(`${s.date}T00:00:00Z`).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    const slot = slotOf(s.startedAt);
    if (!slot) continue;
    let v = 0;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (set.kind === "warmup" || set.reps <= 0) continue;
        v += set.weight * set.reps;
      }
    }
    if (v <= 0) continue;
    acc[slot].volume += v;
    acc[slot].sessions += 1;
    acc[slot].prs += s.prCount || 0;
    total += 1;
  }

  if (total < MIN_SESSIONS) return null;

  const slots: SlotStats[] = SLOT_ORDER.map((slot) => ({
    slot,
    sessions: acc[slot].sessions,
    avgVolumeKg: acc[slot].sessions ? Math.round(acc[slot].volume / acc[slot].sessions) : 0,
    prs: acc[slot].prs,
  }));

  let bestSlot: SessionSlot | null = null;
  let bestAvg = 0;
  for (const s of slots) {
    if (s.sessions < MIN_SLOT_SESSIONS) continue;
    if (s.avgVolumeKg > bestAvg) {
      bestAvg = s.avgVolumeKg;
      bestSlot = s.slot;
    }
  }

  // Only speak when there's an actual choice being made (2+ used slots) and
  // the best slot's edge is real (10%+ over the runner-up).
  let advice: string | null = null;
  const used = slots.filter((s) => s.sessions >= MIN_SLOT_SESSIONS);
  if (bestSlot && used.length >= 2) {
    const runnerUp = Math.max(...used.filter((s) => s.slot !== bestSlot).map((s) => s.avgVolumeKg));
    if (bestAvg >= runnerUp * 1.1) {
      const prNote = slots.find((s) => s.slot === bestSlot)!.prs;
      advice = `Your ${SLOT_NAME[bestSlot]} sessions move ${Math.round(((bestAvg - runnerUp) / runnerUp) * 100)}% more weight${prNote > 0 ? ` and hold ${prNote} PR${prNote === 1 ? "" : "s"}` : ""} — protect that slot when life gets busy.`;
    }
  }

  return { slots, bestSlot, advice };
}
