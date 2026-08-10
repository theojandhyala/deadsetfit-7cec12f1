import type { WorkoutSession } from "./types";

// Month ranking — session records at calendar scale. "July was your
// second-biggest month ever" turns a heavy block into a standing.

export interface MonthRank {
  /** The last completed month, e.g. "2026-07". */
  month: string;
  label: string;
  volumeKg: number;
  rank: number;
  totalMonths: number;
  bestMonth: { label: string; volumeKg: number };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MIN_MONTHS = 3;

function labelOf(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return `${MONTHS[idx] ?? month} ${month.slice(0, 4)}`;
}

export function monthRank(sessions: WorkoutSession[], todayIso: string): MonthRank | null {
  const currentMonth = todayIso.slice(0, 7);
  const volumeByMonth = new Map<string, number>();

  for (const s of sessions ?? []) {
    if (!s.endedAt) continue;
    const month = s.date.slice(0, 7);
    if (month >= currentMonth) continue; // only completed months compete
    let v = 0;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (set.kind === "warmup" || set.reps <= 0) continue;
        v += set.weight * set.reps;
      }
    }
    if (v > 0) volumeByMonth.set(month, (volumeByMonth.get(month) ?? 0) + v);
  }

  if (volumeByMonth.size < MIN_MONTHS) return null;

  const months = [...volumeByMonth.entries()].sort((a, b) => b[1] - a[1]);
  const lastCompleted = [...volumeByMonth.keys()].sort().pop()!;
  const rank = months.findIndex(([m]) => m === lastCompleted) + 1;
  const [bestM, bestV] = months[0];

  return {
    month: lastCompleted,
    label: labelOf(lastCompleted),
    volumeKg: Math.round(volumeByMonth.get(lastCompleted)!),
    rank,
    totalMonths: months.length,
    bestMonth: { label: labelOf(bestM), volumeKg: Math.round(bestV) },
  };
}
