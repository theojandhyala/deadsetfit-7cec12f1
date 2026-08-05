/**
 * GitHub-style training heatmap: the last N weeks bucketed into a 7-row grid,
 * intensity from session volume. Built from local state only.
 */
export interface HeatCell {
  date: string;
  /** kg lifted that day (0 for a completed day with no logged volume). */
  volume: number;
  trained: boolean;
  /** 0 = untrained, 1–4 = volume quartile among trained days. */
  level: 0 | 1 | 2 | 3 | 4;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function buildHeatmap(
  sessions: { date: string; totalVolume?: number; endedAt?: string }[],
  completedDates: string[],
  todayIso: string,
  weeks = 12,
): { columns: HeatCell[][]; maxVolume: number } {
  const volumeByDay = new Map<string, number>();
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const day = s.date.slice(0, 10);
    volumeByDay.set(day, (volumeByDay.get(day) ?? 0) + (s.totalVolume ?? 0));
  }
  const completed = new Set(completedDates);

  // Grid ends on today's column; columns run Monday-first like the schedule.
  const end = new Date(`${todayIso}T00:00:00Z`);
  const endDow = (end.getUTCDay() + 6) % 7; // Mon=0
  const totalDays = (weeks - 1) * 7 + endDow + 1;

  const days: HeatCell[] = [];
  let maxVolume = 0;
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400000);
    const key = iso(d);
    const volume = volumeByDay.get(key) ?? 0;
    const trained = completed.has(key) || volume > 0;
    if (volume > maxVolume) maxVolume = volume;
    days.push({ date: key, volume, trained, level: 0 });
  }

  for (const cell of days) {
    if (!cell.trained) continue;
    if (cell.volume <= 0 || maxVolume === 0) {
      cell.level = 1;
      continue;
    }
    const q = cell.volume / maxVolume;
    cell.level = q > 0.75 ? 4 : q > 0.5 ? 3 : q > 0.25 ? 2 : 1;
  }

  // totalDays counts back to a Monday by construction (full weeks plus the
  // partial current week), so plain chunking keeps every column Monday-first
  // and leaves only the final, in-progress week short.
  const columns: HeatCell[][] = [];
  for (let c = 0; c < Math.ceil(days.length / 7); c++) {
    columns.push(days.slice(c * 7, c * 7 + 7));
  }
  return { columns, maxVolume };
}
