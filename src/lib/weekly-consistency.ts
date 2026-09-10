import type { AppState, DayKey, Schedule } from "./types";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
export const WEEK_MILESTONES = [2, 4, 8, 12, 26, 52] as const;

/** ISO calendar arithmetic, not elapsed local hours (which vary across DST). */
function dayTime(day: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const time = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? time : null;
}

function monday(time: number): number {
  return time - ((new Date(time).getUTCDay() + 6) % 7) * DAY_MS;
}

function iso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function calendarDaysUntil(from: string, to: string): number | null {
  const start = dayTime(from);
  const end = dayTime(to);
  return start === null || end === null ? null : (end - start) / DAY_MS;
}

export interface ConsistencyWeek {
  start: string;
  end: string;
  dates: string[];
  current: boolean;
}

/**
 * An active week contains at least one distinct completed training date.
 * The open week never breaks a run. Weekly plan completion is separate:
 * we cannot infer what someone's historical plan target used to be.
 * No writes, shields, invented workouts, or changes to the daily streak.
 */
export function weeklyConsistency(completedDates: readonly string[], today: string) {
  const todayTime = dayTime(today);
  if (todayTime === null) throw new RangeError("Expected a valid ISO calendar day");
  const thisMonday = monday(todayTime);
  const byWeek = new Map<number, string[]>();
  for (const date of new Set(completedDates)) {
    const time = dayTime(date);
    if (time === null || time > todayTime) continue;
    const start = monday(time);
    const dates = byWeek.get(start) ?? [];
    dates.push(date);
    byWeek.set(start, dates);
  }
  let current = 0;
  let cursor = byWeek.has(thisMonday) ? thisMonday : thisMonday - WEEK_MS;
  while (byWeek.has(cursor)) {
    current++;
    cursor -= WEEK_MS;
  }
  let best = 0;
  let run = 0;
  let previous = -Infinity;
  for (const start of [...byWeek.keys()].sort((a, b) => a - b)) {
    run = start - previous === WEEK_MS ? run + 1 : 1;
    best = Math.max(best, run);
    previous = start;
  }
  const weeks: ConsistencyWeek[] = Array.from({ length: 8 }, (_, i) => {
    const start = thisMonday - (7 - i) * WEEK_MS;
    return {
      start: iso(start),
      end: iso(start + 6 * DAY_MS),
      dates: (byWeek.get(start) ?? []).sort(),
      current: start === thisMonday,
    };
  });
  const done = byWeek.get(thisMonday)?.length ?? 0;
  const nextMilestone =
    WEEK_MILESTONES.find((value) => value > current) ?? (Math.floor(current / 52) + 1) * 52;
  return {
    current,
    best,
    done,
    weeks,
    nextMilestone,
    milestoneRemaining: nextMilestone - current,
    achievedMilestones: WEEK_MILESTONES.filter((value) => best >= value),
    weekActive: done > 0,
  };
}

/** The active routine wins, including intentionally empty recovery weeks. */
export function weeklyPlanDays(
  state: Pick<AppState, "programs" | "activeProgramId">,
  schedule: Schedule | null,
): DayKey[] {
  const program = state.programs.find((item) => item.id === state.activeProgramId);
  return DAYS.filter((day) =>
    program
      ? (program.days[day]?.items.length ?? 0) > 0
      : (schedule?.[day]?.exerciseIds.length ?? 0) > 0,
  );
}
