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

export const GRADE_COLORS: Record<WeeklyReport["grade"], string> = {
  A: "#22c55e",
  B: "#a3e635",
  C: "#fbbf24",
  D: "#fb923c",
  F: "#e63222",
};
