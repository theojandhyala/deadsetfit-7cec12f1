export interface HistoryCell {
  date: string;
  trained: boolean;
  volume: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface WorkoutHistoryYear {
  year: number;
  workoutCount: number;
  columns: Array<Array<HistoryCell | null>>;
}

const DAY = 86_400_000;

export function buildWorkoutHistory(
  sessions: { date: string; totalVolume?: number; endedAt?: string }[],
  completedDates: string[],
  todayIso: string,
): WorkoutHistoryYear[] {
  const volumeByDay = new Map<string, number>();
  for (const session of sessions) {
    if (!session.endedAt) continue;
    const day = session.date.slice(0, 10);
    volumeByDay.set(day, (volumeByDay.get(day) ?? 0) + (session.totalVolume ?? 0));
  }
  const trained = new Set([...completedDates, ...volumeByDay.keys()]);
  const years = [...new Set([...trained].map((day) => Number(day.slice(0, 4))))]
    .filter((year) => Number.isFinite(year) && year <= Number(todayIso.slice(0, 4)))
    .sort((a, b) => b - a);

  return years.map((year) => {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));
    const limit = year === Number(todayIso.slice(0, 4)) ? new Date(`${todayIso}T00:00:00Z`) : end;
    const mondayOffset = (start.getUTCDay() + 6) % 7;
    const cells: Array<HistoryCell | null> = Array.from({ length: mondayOffset }, () => null);
    const values: number[] = [];
    for (let time = start.getTime(); time <= limit.getTime(); time += DAY) {
      const date = new Date(time).toISOString().slice(0, 10);
      const volume = volumeByDay.get(date) ?? 0;
      if (trained.has(date)) values.push(volume);
      cells.push({ date, trained: trained.has(date), volume, level: 0 });
    }
    const peak = Math.max(0, ...values);
    for (const cell of cells) {
      if (!cell?.trained) continue;
      if (cell.volume <= 0 || peak === 0) cell.level = 1;
      else {
        const ratio = cell.volume / peak;
        cell.level = ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
      }
    }
    const columns: Array<Array<HistoryCell | null>> = [];
    for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));
    return { year, workoutCount: cells.filter((cell) => cell?.trained).length, columns };
  });
}
