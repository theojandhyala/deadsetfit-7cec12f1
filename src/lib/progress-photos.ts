import type { CheckIn, WeightEntry } from "./types";

/**
 * Progress photos, as a story rather than a pile of thumbnails.
 *
 * The camera is the only honest record of a body changing. Scale weight moves
 * for reasons that have nothing to do with training, and nobody can see their
 * own change in a mirror they look into daily. Two photos eight weeks apart
 * settle it — which is why this is the one thing in the app most worth putting
 * in front of somebody, and why it used to sit in a small grid near the bottom
 * of a very long screen.
 *
 * Pure and separately tested: everything here decides what a person is told
 * about their own progress, and getting "12 weeks apart" wrong on a card they
 * post is worse than not showing it.
 */

/** How often a check-in is worth taking. Weekly change is visible; daily is noise. */
export const CHECK_IN_INTERVAL_DAYS = 7;

/**
 * A comparison is only worth showing once there is enough time between the two
 * shots for a body to have actually changed. Below this it reads as "same
 * photo twice" and undersells the feature.
 */
export const MEANINGFUL_GAP_DAYS = 14;

const DAY_MS = 86_400_000;

export interface PhotoJourney {
  /** The earliest check-in, or null when there are none. */
  first: CheckIn | null;
  /** The most recent check-in. Same object as `first` when only one exists. */
  latest: CheckIn | null;
  count: number;
  /** Whole days between first and latest. */
  daysApart: number;
  /** Bodyweight change across the span, in kilograms, when both ends are known. */
  weightDeltaKg: number | null;
  /** Two distinct shots far enough apart to be worth showing side by side. */
  meaningful: boolean;
}

function time(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Bodyweight recorded nearest a given moment, in kilograms. */
export function weightNear(weights: WeightEntry[], iso: string): number | null {
  if (weights.length === 0) return null;
  const target = time(iso);
  let best: { diff: number; weight: number } | null = null;
  for (const entry of weights) {
    const diff = Math.abs(time(entry.date) - target);
    if (!best || diff < best.diff) best = { diff, weight: entry.weight };
  }
  return best?.weight ?? null;
}

/** First shot, latest shot, and what changed between them. */
export function photoJourney(state: {
  checkIns?: CheckIn[];
  weights?: WeightEntry[];
}): PhotoJourney {
  const checkIns = [...(state.checkIns ?? [])]
    .filter((entry) => !!entry?.photoDataUrl)
    .sort((a, b) => time(a.date) - time(b.date));

  if (checkIns.length === 0) {
    return {
      first: null,
      latest: null,
      count: 0,
      daysApart: 0,
      weightDeltaKg: null,
      meaningful: false,
    };
  }

  const first = checkIns[0]!;
  const latest = checkIns[checkIns.length - 1]!;
  const daysApart = Math.round((time(latest.date) - time(first.date)) / DAY_MS);

  const weights = state.weights ?? [];
  const startWeight = weightNear(weights, first.date);
  const nowWeight = weightNear(weights, latest.date);
  const weightDeltaKg =
    startWeight !== null && nowWeight !== null
      ? Math.round((nowWeight - startWeight) * 10) / 10
      : null;

  return {
    first,
    latest,
    count: checkIns.length,
    daysApart,
    weightDeltaKg,
    meaningful: checkIns.length >= 2 && daysApart >= MEANINGFUL_GAP_DAYS,
  };
}

/** Whole days since the most recent check-in, or null when there are none. */
export function daysSinceLastCheckIn(
  state: { checkIns?: CheckIn[] },
  now: Date = new Date(),
): number | null {
  const checkIns = state.checkIns ?? [];
  if (checkIns.length === 0) return null;
  const newest = Math.max(...checkIns.map((entry) => time(entry.date)));
  // Clamped at zero: a check-in dated slightly in the future (a device clock a
  // few minutes fast) must not read as "-1 days ago".
  return Math.max(0, Math.floor((now.getTime() - newest) / DAY_MS));
}

/** Whether it is time to prompt for the next shot. */
export function isCheckInDue(state: { checkIns?: CheckIn[] }, now: Date = new Date()): boolean {
  const since = daysSinceLastCheckIn(state, now);
  // No photos at all is not "due" — that is an empty state with its own, much
  // better, pitch. A nag is the wrong first thing to say to somebody.
  if (since === null) return false;
  return since >= CHECK_IN_INTERVAL_DAYS;
}

/** Plain-language span for a card: "8 weeks apart", "5 days apart". */
export function spanLabel(days: number): string {
  if (days >= 14) return `${Math.round(days / 7)} weeks apart`;
  if (days === 1) return "1 day apart";
  return `${days} days apart`;
}
