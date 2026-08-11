import type { DayKey, WorkoutSession } from "./types";

// Training rhythm — what the calendar actually says about the lifter's week:
// which weekday carries the heaviest work, and which scheduled day keeps
// getting skipped. Pure arithmetic over logged sessions and completed dates.

export interface DayRhythm {
  day: DayKey;
  sessions: number;
  avgVolumeKg: number;
  scheduled: boolean;
  /** Of this weekday's occurrences in the window, how many were trained. 0–1; null when unscheduled. */
  completionRate: number | null;
}

export interface TrainingRhythm {
  days: DayRhythm[];
  strongestDay: DayKey | null;
  /** Scheduled weekday most often skipped — only called out when clearly missed. */
  mostSkippedDay: DayKey | null;
  advice: string | null;
}

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAME: Record<DayKey, string> = {
  MON: "Mondays",
  TUE: "Tuesdays",
  WED: "Wednesdays",
  THU: "Thursdays",
  FRI: "Fridays",
  SAT: "Saturdays",
  SUN: "Sundays",
};
const DAY_MS = 86_400_000;

function dayKeyOf(iso: string): DayKey | null {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return Number.isFinite(d) ? DAY_KEYS[(d + 6) % 7] : null;
}

const MIN_SESSIONS = 8;

export function trainingRhythm(
  sessions: WorkoutSession[],
  completedDates: string[],
  trainingDays: DayKey[] | undefined,
  todayIso: string,
  weeks = 12,
): TrainingRhythm | null {
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  const since = today - weeks * 7 * DAY_MS;

  const volume: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };
  const count: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };
  let total = 0;

  for (const s of sessions ?? []) {
    if (!s.endedAt) continue;
    const at = new Date(`${s.date}T00:00:00Z`).getTime();
    if (!Number.isFinite(at) || at < since || at > today) continue;
    const day = dayKeyOf(s.date);
    if (!day) continue;
    let vol = 0;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (set.kind === "warmup" || set.reps <= 0) continue;
        vol += set.weight * set.reps;
      }
    }
    volume[day] += vol;
    count[day] += 1;
    total += 1;
  }

  if (total < MIN_SESSIONS) return null;

  const trained = new Set(completedDates ?? []);
  const scheduled = new Set(trainingDays ?? []);

  // Hit rates start at the athlete's first trained day inside the window —
  // weeks before they ever showed up must not read as "skipped".
  let firstTrained = Infinity;
  for (const iso of trained) {
    const t = new Date(`${iso}T00:00:00Z`).getTime();
    if (Number.isFinite(t) && t >= since && t < today) firstTrained = Math.min(firstTrained, t);
  }
  const rateStart = Number.isFinite(firstTrained) ? firstTrained : since;

  // Walk every full day once to get per-weekday occurrence and hit counts —
  // DST-proof because everything is UTC-midnight arithmetic.
  const occurrences: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };
  const hits: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };
  for (let t = rateStart; t < today; t += DAY_MS) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const day = dayKeyOf(iso)!;
    occurrences[day] += 1;
    if (trained.has(iso)) hits[day] += 1;
  }

  const days: DayRhythm[] = DAY_KEYS.map((day) => ({
    day,
    sessions: count[day],
    avgVolumeKg: count[day] ? Math.round(volume[day] / count[day]) : 0,
    scheduled: scheduled.has(day),
    completionRate:
      scheduled.has(day) && occurrences[day] > 0 ? hits[day] / occurrences[day] : null,
  }));

  // Strongest day needs at least 2 sessions so one outlier workout can't claim it.
  let strongestDay: DayKey | null = null;
  for (const d of days) {
    if (d.sessions < 2 || d.avgVolumeKg <= 0) continue;
    if (!strongestDay || d.avgVolumeKg > days.find((x) => x.day === strongestDay)!.avgVolumeKg) {
      strongestDay = d.day;
    }
  }

  let mostSkippedDay: DayKey | null = null;
  let worstRate = 0.6; // only call out days genuinely missed, not near-misses
  for (const d of days) {
    if (d.completionRate === null) continue;
    if (d.completionRate < worstRate) {
      worstRate = d.completionRate;
      mostSkippedDay = d.day;
    }
  }

  let advice: string | null = null;
  if (strongestDay && mostSkippedDay && strongestDay !== mostSkippedDay) {
    advice = `You move the most weight on ${DAY_NAME[strongestDay]}. ${DAY_NAME[mostSkippedDay]} get skipped most (${Math.round(worstRate * 100)}% hit rate) — consider moving that session to a day you actually own.`;
  } else if (strongestDay) {
    advice = `You move the most weight on ${DAY_NAME[strongestDay]} — schedule your hardest lifts there.`;
  } else if (mostSkippedDay) {
    advice = `${DAY_NAME[mostSkippedDay]} get skipped most (${Math.round(worstRate * 100)}% hit rate) — try a shorter session or a different day.`;
  }

  return { days, strongestDay, mostSkippedDay, advice };
}

export const RHYTHM_DAY_NAME = DAY_NAME;
