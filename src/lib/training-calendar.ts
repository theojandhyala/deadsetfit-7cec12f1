import type { DayKey, Schedule, WorkoutSession } from "./types";

export type CalendarScale = "week" | "month" | "year" | "all";
export const CALENDAR_DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY = 86_400_000;
export function calendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function moveDays(day: string, amount: number): string {
  return dateKey(new Date(calendarDate(day)!.getTime() + amount * DAY));
}
export function weekday(day: string): DayKey {
  return CALENDAR_DAYS[(calendarDate(day)!.getUTCDay() + 6) % 7];
}
export function calendarRange(
  anchor: string,
  scale: "week" | "month" | "year",
): { start: string; end: string } {
  const date = calendarDate(anchor)!;
  if (scale === "week") {
    const start = moveDays(anchor, -((date.getUTCDay() + 6) % 7));
    return { start, end: moveDays(start, 6) };
  }
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth();
  return scale === "month"
    ? {
        start: dateKey(new Date(Date.UTC(year, month, 1, 12))),
        end: dateKey(new Date(Date.UTC(year, month + 1, 0, 12))),
      }
    : { start: `${year}-01-01`, end: `${year}-12-31` };
}
export function movePeriod(
  anchor: string,
  scale: "week" | "month" | "year",
  direction: number,
): string {
  if (scale === "week") return moveDays(anchor, direction * 7);
  const d = calendarDate(anchor)!;
  return dateKey(
    new Date(
      Date.UTC(
        d.getUTCFullYear() + (scale === "year" ? direction : 0),
        d.getUTCMonth() + (scale === "month" ? direction : 0),
        1,
        12,
      ),
    ),
  );
}
export function daysBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let day = start; day <= end; day = moveDays(day, 1)) dates.push(day);
  return dates;
}
export function monthCells(anchor: string): Array<string | null> {
  const { start, end } = calendarRange(anchor, "month");
  const offset = (calendarDate(start)!.getUTCDay() + 6) % 7;
  const cells: Array<string | null> = [
    ...Array.from({ length: offset }, () => null),
    ...daysBetween(start, end),
  ];
  while (cells.length % 7) cells.push(null);
  return cells;
}
export interface CalendarDay {
  date: string;
  sessions: WorkoutSession[];
  completed: boolean;
  volume: number;
  level: number;
}
/** Completed records only. Stable intensity across scales; no synthetic history. */
export function calendarHistory(
  sessions: WorkoutSession[],
  completedDates: string[],
  today: string,
): Map<string, CalendarDay> {
  const result = new Map<string, CalendarDay>();
  const get = (date: string) => {
    if (!result.has(date))
      result.set(date, { date, sessions: [], completed: true, volume: 0, level: 1 });
    return result.get(date)!;
  };
  for (const date of completedDates) if (calendarDate(date) && date <= today) get(date);
  const unique = new Map<string, WorkoutSession>();
  for (const session of sessions) {
    const day = session.date.slice(0, 10);
    if (!session.endedAt || !calendarDate(day) || day > today) continue;
    const previous = unique.get(session.id);
    if (!previous || session.endedAt > previous.endedAt!) unique.set(session.id, session);
  }
  for (const session of unique.values()) {
    const day = get(session.date.slice(0, 10));
    day.sessions.push(session);
    day.volume += Number.isFinite(session.totalVolume) ? Math.max(0, session.totalVolume) : 0;
  }
  const peak = Math.max(0, ...Array.from(result.values(), (d) => d.volume));
  for (const day of result.values())
    day.level = peak > 0 && day.volume > 0 ? Math.max(1, Math.ceil((day.volume / peak) * 4)) : 1;
  return result;
}
/** Today's recurring plan is not evidence of what was scheduled in past months. */
export function plannedWorkout(date: string, today: string, schedule?: Schedule | null) {
  if (date < today) return null;
  const day = schedule?.[weekday(date)];
  return day?.exerciseIds.length ? day : null;
}
