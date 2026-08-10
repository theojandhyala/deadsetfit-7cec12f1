import { isoDay } from "./calc";
import type { AppState } from "./types";

export interface WeeklyReport {
  /** Monday of the reported week (the most recent COMPLETED week) */
  weekStart: string;
  sessions: number;
  volumeKg: number;
  prs: number;
  setsLogged: number;
  daysTrained: number;
  /** Deltas vs the week before */
  volumeDelta: number | null;
  sessionsDelta: number | null;
  grade: "A" | "B" | "C" | "D" | "F";
  headline: string;
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface WeekTotals {
  sessions: number;
  volume: number;
  prs: number;
  sets: number;
  days: number;
}

function totalsFor(state: AppState, start: Date, end: Date): WeekTotals {
  const startIso = isoDay(start);
  const endIso = isoDay(end);
  const days = new Set<string>();
  let sessions = 0;
  let volume = 0;
  let prs = 0;
  let sets = 0;
  for (const s of state.sessions) {
    if (!s.endedAt) continue;
    const day = s.date.slice(0, 10);
    if (day < startIso || day > endIso) continue;
    sessions += 1;
    prs += s.prCount || 0;
    days.add(day);
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        // Warm-ups aren't working volume — same rule the live logger applies
        // when it computes a session's totalVolume.
        if (set.kind === "warmup" || set.reps <= 0) continue;
        volume += set.weight * set.reps;
        sets += 1;
      }
    }
  }
  return { sessions, volume, prs, sets, days: days.size };
}

function gradeFor(t: WeekTotals, plannedDays: number): WeeklyReport["grade"] {
  if (t.sessions === 0) return "F";
  const consistency = plannedDays > 0 ? t.days / plannedDays : t.days / 3;
  const score = consistency * 60 + Math.min(20, t.prs * 10) + Math.min(20, t.sets / 2);
  if (score >= 85) return "A";
  if (score >= 65) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

function currentGradeFor(
  totals: WeekTotals,
  plannedDays: number,
  now: Date,
): WeeklyReport["grade"] {
  if (totals.sessions === 0) return "F";
  const weekday = now.getDay();
  const daysElapsed = weekday === 0 ? 7 : weekday;
  const expectedDays = Math.max(1, Math.floor(plannedDays * (daysElapsed / 7)));
  const consistency = Math.min(1, totals.days / expectedDays);
  const score =
    consistency * 60 + Math.min(20, totals.prs * 10) + Math.min(20, totals.sets / 2);
  if (score >= 85) return "A";
  if (score >= 65) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

/** Report for the most recent COMPLETED Monday-to-Sunday week. */
export function weeklyReport(state: AppState): WeeklyReport {
  const thisMonday = mondayOf(new Date());
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(lastSunday.getDate() - 1);

  const prevMonday = new Date(lastMonday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevSunday = new Date(lastMonday);
  prevSunday.setDate(prevSunday.getDate() - 1);

  const week = totalsFor(state, lastMonday, lastSunday);
  const prev = totalsFor(state, prevMonday, prevSunday);

  const plannedDays = state.profile?.daysPerWeek ?? 3;
  const grade = gradeFor(week, plannedDays);

  const headline =
    week.sessions === 0
      ? "No sessions logged. This week is a clean slate."
      : week.prs > 0
        ? `${week.prs} PR${week.prs > 1 ? "s" : ""} and ${Math.round(week.volume).toLocaleString()}kg moved. Keep pressing.`
        : week.days >= plannedDays
          ? "Every planned day trained. Consistency is the whole game."
          : `${week.days}/${plannedDays} planned days trained — one more day changes the grade.`;

  return {
    weekStart: isoDay(lastMonday),
    sessions: week.sessions,
    volumeKg: Math.round(week.volume),
    prs: week.prs,
    setsLogged: week.sets,
    daysTrained: week.days,
    volumeDelta: prev.sessions > 0 ? Math.round(week.volume - prev.volume) : null,
    sessionsDelta: prev.sessions > 0 ? week.sessions - prev.sessions : null,
    grade,
    headline,
  };
}

/** Live Monday-to-now report used by the Pro Weekly Review. */
export function currentWeekReport(state: AppState, now = new Date()): WeeklyReport {
  const current = new Date(now);
  const thisMonday = mondayOf(current);
  const previousMonday = new Date(thisMonday);
  previousMonday.setDate(previousMonday.getDate() - 7);
  const previousSunday = new Date(thisMonday);
  previousSunday.setDate(previousSunday.getDate() - 1);

  const week = totalsFor(state, thisMonday, current);
  const previous = totalsFor(state, previousMonday, previousSunday);
  const plannedDays = state.profile?.daysPerWeek ?? 3;
  const grade = currentGradeFor(week, plannedDays, current);
  const headline =
    week.sessions === 0
      ? "The week is open. Start the first planned session."
      : week.prs > 0
        ? `${week.prs} PR${week.prs > 1 ? "s" : ""} already this week. Keep the next session controlled.`
        : week.days >= plannedDays
          ? "Every planned day is complete. Recover and protect the work."
          : `${week.days}/${plannedDays} planned days complete. Keep the week moving.`;

  return {
    weekStart: isoDay(thisMonday),
    sessions: week.sessions,
    volumeKg: Math.round(week.volume),
    prs: week.prs,
    setsLogged: week.sets,
    daysTrained: week.days,
    volumeDelta: previous.sessions > 0 ? Math.round(week.volume - previous.volume) : null,
    sessionsDelta: previous.sessions > 0 ? week.sessions - previous.sessions : null,
    grade,
    headline,
  };
}

export interface WeekGrade {
  weekStart: string;
  grade: WeeklyReport["grade"];
  sessions: number;
}

/**
 * Grades for the last `weeks` COMPLETED weeks, oldest first. Weeks before the
 * athlete's first-ever session are dropped — a two-week-old account gets two
 * grades, not six retroactive Fs.
 */
export function gradeHistory(state: AppState, weeks = 8, now = new Date()): WeekGrade[] {
  let firstSession: string | null = null;
  for (const s of state.sessions) {
    if (!s.endedAt) continue;
    const day = s.date.slice(0, 10);
    if (!firstSession || day < firstSession) firstSession = day;
  }
  if (!firstSession) return [];

  const plannedDays = state.profile?.daysPerWeek ?? 3;
  const thisMonday = mondayOf(now);
  const out: WeekGrade[] = [];
  for (let i = weeks; i >= 1; i--) {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - 7 * i);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    if (isoDay(end) < firstSession) continue;
    const totals = totalsFor(state, start, end);
    out.push({ weekStart: isoDay(start), grade: gradeFor(totals, plannedDays), sessions: totals.sessions });
  }
  return out;
}

export const GRADE_COLORS: Record<WeeklyReport["grade"], string> = {
  A: "#22c55e",
  B: "#a3e635",
  C: "#fbbf24",
  D: "#fb923c",
  F: "#e63222",
};
