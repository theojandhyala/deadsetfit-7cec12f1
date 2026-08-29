import { TIERS, type MuscleGrade, type StrengthTier } from "./strength-grades";
import type { MuscleGroup } from "./types";

/**
 * A muscle moving up a strength tier.
 *
 * This is the app's signature moment — the thing the whole Strength Map exists
 * to produce — and nothing was watching for it. Streaks, tonnage and badges
 * all interrupt to say well done; a chest going from Novice to Intermediate,
 * which takes months of work, changed a colour on a screen the athlete might
 * not open for another week.
 *
 * Pure and separately tested, because it decides when to interrupt somebody.
 * Interrupting for a climb that did not happen is worse than staying quiet.
 */

export interface TierClimb {
  muscle: MuscleGroup;
  from: StrengthTier;
  to: StrengthTier;
  /** How many tiers were crossed at once. */
  steps: number;
}

/** Position on the ladder. -1 for anything unrecognised. */
export function tierRank(tier: string): number {
  return TIERS.indexOf(tier as StrengthTier);
}

/** The tier each muscle was last seen at, keyed by muscle. */
export type SeenTiers = Partial<Record<string, StrengthTier>>;

/**
 * Which muscles climbed since they were last seen.
 *
 * Only upward moves count. A grade can fall — a bodyweight change alone moves
 * every ratio-based grade, since they are all relative to it — and announcing
 * that somebody got weaker because they gained mass would be both wrong and
 * cruel.
 *
 * A muscle with no recorded history is not a climb. Its first grade is a
 * starting point, and celebrating it would fire on every muscle at once the
 * first time somebody opens the screen.
 */
export function detectTierClimbs(current: MuscleGrade[], seen: SeenTiers): TierClimb[] {
  const climbs: TierClimb[] = [];
  for (const grade of current) {
    const before = seen[grade.muscle];
    if (!before) continue;
    const from = tierRank(before);
    const to = tierRank(grade.tier);
    if (from < 0 || to < 0 || to <= from) continue;
    climbs.push({ muscle: grade.muscle, from: before, to: grade.tier, steps: to - from });
  }
  // Biggest jump first: two tiers at once is the one worth showing.
  return climbs.sort((a, b) => b.steps - a.steps || tierRank(b.to) - tierRank(a.to));
}

/** The current tier of every graded muscle, for storing as the new baseline. */
export function snapshotTiers(current: MuscleGrade[]): SeenTiers {
  const snapshot: SeenTiers = {};
  for (const grade of current) snapshot[grade.muscle] = grade.tier;
  return snapshot;
}

/**
 * Merge a fresh snapshot over what was already recorded.
 *
 * Muscles missing from `current` keep their recorded tier rather than being
 * dropped: a week of push sessions does not mean the athlete's legs stopped
 * existing, and forgetting them would make the next leg session read as a
 * first grade and never celebrate.
 */
export function mergeSeen(seen: SeenTiers, current: MuscleGrade[]): SeenTiers {
  return { ...seen, ...snapshotTiers(current) };
}
