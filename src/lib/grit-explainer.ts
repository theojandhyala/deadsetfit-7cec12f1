import { gritBadge, type GritBadge, type GritScoreBreakdown } from "./calc";

/**
 * Grit is the app's headline number, and until now it was shown as a bare
 * figure with nothing saying what it measured or how to move it. These helpers
 * turn the breakdown the scorer already returns into something readable, so the
 * number can explain itself instead of being decoration.
 *
 * Point values mirror calculateGritScore exactly. If that formula changes, the
 * test here fails rather than the app quietly lying about how to earn points.
 */
export const GRIT_POINTS = {
  streakDay: 15,
  pr: 25,
  calorieDay: 10,
  proteinDay: 10,
  checkIn: 50,
  measurement: 20,
  /** Deducted when nothing has been logged for 48 hours. */
  idlePenalty: 100,
} as const;

export const GRIT_MAX = 1000;

export interface GritSource {
  key: string;
  label: string;
  /** How the points were earned, in the athlete's own numbers. */
  detail: string;
  points: number;
}

/** Where this athlete's grit actually came from, biggest contribution first. */
export function gritSources(b: GritScoreBreakdown): GritSource[] {
  const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
  const rows: GritSource[] = [
    {
      key: "streak",
      label: "Training streak",
      detail: `${b.streak} ${plural(b.streak, "day")} × ${GRIT_POINTS.streakDay}`,
      points: b.streak * GRIT_POINTS.streakDay,
    },
    {
      key: "prs",
      label: "PRs this week",
      detail: `${b.prs} × ${GRIT_POINTS.pr}`,
      points: b.prs * GRIT_POINTS.pr,
    },
    {
      key: "checkIns",
      label: "Check-in photos",
      detail: `${b.checkIns} × ${GRIT_POINTS.checkIn}`,
      points: b.checkIns * GRIT_POINTS.checkIn,
    },
    {
      key: "measurements",
      label: "Measurements logged",
      detail: `${b.measurements} × ${GRIT_POINTS.measurement}`,
      points: b.measurements * GRIT_POINTS.measurement,
    },
    {
      key: "calories",
      label: "Calorie target hit",
      detail: `${b.caloriesHit} ${plural(b.caloriesHit, "day")} × ${GRIT_POINTS.calorieDay}`,
      points: b.caloriesHit * GRIT_POINTS.calorieDay,
    },
    {
      key: "protein",
      label: "Protein target hit",
      detail: `${b.proteinHit} ${plural(b.proteinHit, "day")} × ${GRIT_POINTS.proteinDay}`,
      points: b.proteinHit * GRIT_POINTS.proteinDay,
    },
  ].filter((r) => r.points > 0);

  rows.sort((a, z) => z.points - a.points);

  if (b.decay > 0) {
    rows.push({
      key: "idle",
      label: "Nothing logged in 48h",
      detail: "Log anything to clear it",
      points: -b.decay,
    });
  }
  return rows;
}

const TIERS: { badge: GritBadge; min: number }[] = [
  { badge: "RAW", min: 0 },
  { badge: "ROOKIE", min: 100 },
  { badge: "GRINDER", min: 250 },
  { badge: "BEAST", min: 500 },
  { badge: "ELITE", min: 750 },
  { badge: "DEADSET GOD", min: 1000 },
];

export interface NextTier {
  badge: GritBadge;
  at: number;
  remaining: number;
}

/** The next rank up, or null at the top. */
export function nextGritTier(score: number): NextTier | null {
  for (const tier of TIERS) {
    if (score < tier.min) {
      return { badge: tier.badge, at: tier.min, remaining: tier.min - score };
    }
  }
  return null;
}

export function currentGritBadge(score: number): GritBadge {
  return gritBadge(score);
}

/**
 * The single most useful next action, chosen from what actually pays most for
 * the effort. Someone with no streak gains most by training today.
 */
export function gritNextStep(b: GritScoreBreakdown): string {
  if (b.decay > 0) return "Log anything today to clear the 48-hour penalty.";
  if (b.streak === 0) return "Finish a workout today to start a streak — every day is 15 grit.";
  if (b.checkIns === 0) return "A check-in photo is worth 50 grit, the biggest single win.";
  if (b.prs === 0) return "Beat any lift you've done before — each PR is 25 grit.";
  if (b.proteinHit === 0) return "Hit your protein target today for 10 grit.";
  return `Keep the streak alive — another day is ${GRIT_POINTS.streakDay} grit.`;
}
