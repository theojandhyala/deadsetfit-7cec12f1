import type { WorkoutSession } from "./types";

// Week pace — cumulative volume so far this week vs where the athlete
// usually is by the same weekday. "Ahead of your usual Wednesday" is a
// mid-week motivator no end-of-week report can be.

export interface WeekPace {
  currentKg: number;
  usualKg: number;
  pct: number;
  verdict: "AHEAD" | "ON_PACE" | "BEHIND";
  advice: string;
}

const DAY_MS = 86_400_000;
const MIN_ACTIVE_WEEKS = 4;

function mondayUtc(t: number): number {
  const d = new Date(t);
  const idx = (d.getUTCDay() + 6) % 7;
  return t - idx * DAY_MS;
}

function workingVolume(s: WorkoutSession): number {
  let v = 0;
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      if (set.kind === "warmup" || set.reps <= 0) continue;
      v += set.weight * set.reps;
    }
  }
  return v;
}

export function weekPace(sessions: WorkoutSession[], todayIso: string, weeks = 8): WeekPace | null {
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(today)) return null;
  const weekdayIdx = (new Date(today).getUTCDay() + 6) % 7;
  // Monday and Tuesday comparisons are noise — pace needs a few days of week.
  if (weekdayIdx < 2) return null;

  const thisMonday = mondayUtc(today);
  const volumeByDate = new Map<string, number>();
  for (const s of sessions ?? []) {
    if (!s.endedAt) continue;
    const v = workingVolume(s);
    if (v <= 0) continue;
    const day = s.date.slice(0, 10);
    volumeByDate.set(day, (volumeByDate.get(day) ?? 0) + v);
  }

  const sumRange = (startMs: number, days: number): number => {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      const iso = new Date(startMs + i * DAY_MS).toISOString().slice(0, 10);
      sum += volumeByDate.get(iso) ?? 0;
    }
    return sum;
  };

  const currentKg = Math.round(sumRange(thisMonday, weekdayIdx + 1));

  // "Usual by this weekday" averages only weeks that saw any training at
  // all — comparing against holiday weeks would flatter every pace.
  let usualSum = 0;
  let activeWeeks = 0;
  for (let w = 1; w <= weeks; w++) {
    const monday = thisMonday - w * 7 * DAY_MS;
    const fullWeek = sumRange(monday, 7);
    if (fullWeek <= 0) continue;
    activeWeeks += 1;
    usualSum += sumRange(monday, weekdayIdx + 1);
  }
  if (activeWeeks < MIN_ACTIVE_WEEKS) return null;

  const usualKg = Math.round(usualSum / activeWeeks);
  if (usualKg <= 0) {
    // The athlete usually hasn't trained by this weekday — no meaningful pace.
    return null;
  }

  const pct = Math.round((currentKg / usualKg) * 100);
  const verdict: WeekPace["verdict"] = pct >= 115 ? "AHEAD" : pct <= 70 ? "BEHIND" : "ON_PACE";
  const advice =
    verdict === "AHEAD"
      ? `You're at ${pct}% of your usual pace by this point in the week — big week brewing.`
      : verdict === "BEHIND"
        ? `You're at ${pct}% of your usual pace for this point in the week — one session pulls it back.`
        : `Right on your usual pace (${pct}%). Steady weeks stack.`;

  return { currentKg, usualKg, pct, verdict, advice };
}
