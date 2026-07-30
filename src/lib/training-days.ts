import type { DayKey } from "./types";
import { WEEK } from "./calc";

export const MIN_TRAINING_DAYS = 3;
export const MAX_TRAINING_DAYS = 6;

export const DAY_LETTER: Record<DayKey, string> = {
  MON: "M",
  TUE: "T",
  WED: "W",
  THU: "T",
  FRI: "F",
  SAT: "S",
  SUN: "S",
};

export const DAY_FULL: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

/** "Mon, Wed and Fri" — a plain-English read-back of the chosen days. */
export function describeDays(days: DayKey[]): string {
  const ordered = WEEK.filter((d) => days.includes(d)).map((d) => DAY_FULL[d].slice(0, 3));
  if (ordered.length === 0) return "no days yet";
  if (ordered.length === 1) return ordered[0];
  return `${ordered.slice(0, -1).join(", ")} and ${ordered[ordered.length - 1]}`;
}

/** Clamps a chosen-day count into the range the split generator supports. */
export function daysPerWeekFor(days: DayKey[]): 3 | 4 | 5 | 6 {
  return Math.min(MAX_TRAINING_DAYS, Math.max(MIN_TRAINING_DAYS, days.length)) as 3 | 4 | 5 | 6;
}
