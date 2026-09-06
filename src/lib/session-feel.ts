import type { SessionFeel, WorkoutSession } from "./types";

export const FEEL_LABEL: Record<SessionFeel, string> = {
  1: "Rough",
  2: "Flat",
  3: "Solid",
  4: "Strong",
  5: "Unstoppable",
};

export const FEEL_EMOJI: Record<SessionFeel, string> = {
  1: "🥴",
  2: "😮‍💨",
  3: "🙂",
  4: "💪",
  5: "🔥",
};

export interface FeelTrend {
  /** Mean rating over the recent window, or null when nothing is rated. */
  recent: number | null;
  /** Mean rating over the window before it, for comparison. */
  previous: number | null;
  /** How many rated sessions the recent window is based on. */
  rated: number;
  direction: "up" | "down" | "flat" | "unknown";
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * Compare how the last `window` rated sessions felt against the `window`
 * before them.
 *
 * Only rated sessions count. Someone who rates one session in ten should not
 * be told their training is declining on the strength of a single bad day, so
 * the trend stays "unknown" until both windows have at least two ratings.
 */
export function feelTrend(sessions: WorkoutSession[], window = 5): FeelTrend {
  const rated = sessions
    .filter((s) => s.endedAt && s.feel != null)
    .sort((a, b) => (a.startedAt || a.date).localeCompare(b.startedAt || b.date));

  const recentSlice = rated.slice(-window);
  const previousSlice = rated.slice(-window * 2, -window);
  const recent = mean(recentSlice.map((s) => s.feel as number));
  const previous = mean(previousSlice.map((s) => s.feel as number));

  let direction: FeelTrend["direction"] = "unknown";
  if (recent != null && previous != null && recentSlice.length >= 2 && previousSlice.length >= 2) {
    const delta = recent - previous;
    // A quarter-point swing is noise on a five-point scale.
    direction = Math.abs(delta) < 0.25 ? "flat" : delta > 0 ? "up" : "down";
  }

  return { recent, previous, rated: recentSlice.length, direction };
}
