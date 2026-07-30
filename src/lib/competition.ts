import { isoDay } from "./calc";
import type { AppState } from "./types";

const DAY_MS = 86_400_000;
const SEASON_DAYS = 28;
const SEASON_EPOCH = new Date(2026, 0, 5);

function mondayOf(date: Date): Date {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function currentWeekStart(date = new Date()): string {
  return isoDay(mondayOf(date));
}

export interface SeasonInfo {
  number: number;
  label: string;
  startsAt: string;
  endsAt: string;
  daysLeft: number;
}

export function getSeasonInfo(date = new Date()): SeasonInfo {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);
  const elapsedDays = Math.max(0, Math.floor((today.getTime() - SEASON_EPOCH.getTime()) / DAY_MS));
  const seasonIndex = Math.floor(elapsedDays / SEASON_DAYS);
  const starts = new Date(SEASON_EPOCH);
  starts.setDate(starts.getDate() + seasonIndex * SEASON_DAYS);
  const ends = new Date(starts);
  ends.setDate(ends.getDate() + SEASON_DAYS - 1);
  return {
    number: seasonIndex + 1,
    label: `Season ${seasonIndex + 1}`,
    startsAt: isoDay(starts),
    endsAt: isoDay(ends),
    daysLeft: Math.max(1, Math.floor((ends.getTime() - today.getTime()) / DAY_MS) + 1),
  };
}

export interface WeeklyCompetitionStats {
  weekStart: string;
  score: number;
  sessions: number;
  days: number;
  sets: number;
  volumeKg: number;
  prs: number;
}

export function getWeeklyCompetitionStats(
  state: AppState,
  date = new Date(),
): WeeklyCompetitionStats {
  const weekStart = currentWeekStart(date);
  const today = isoDay(date);
  const sessions = (state.sessions ?? []).filter(
    (session) =>
      session.endedAt &&
      session.date.slice(0, 10) >= weekStart &&
      session.date.slice(0, 10) <= today,
  );
  const trainedDays = new Set<string>();
  let sets = 0;
  let volumeKg = 0;
  let prs = 0;

  for (const session of sessions) {
    trainedDays.add(session.date.slice(0, 10));
    prs += session.prCount || 0;
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (set.kind === "warmup") continue;
        sets += 1;
        volumeKg += Math.max(0, set.weight) * Math.max(0, set.reps);
      }
    }
  }

  const score =
    sessions.length * 100 +
    trainedDays.size * 40 +
    sets * 3 +
    prs * 50 +
    Math.min(500, Math.round(volumeKg / 100));

  return {
    weekStart,
    score,
    sessions: sessions.length,
    days: trainedDays.size,
    sets,
    volumeKg: Math.round(volumeKg),
    prs,
  };
}
