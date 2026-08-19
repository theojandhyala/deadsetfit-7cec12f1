import { achievementById, type Achievement, type AchievementRarity } from "./achievements";

/** Rarest first — when several badges land at once, that is the one to show. */
const RARITY_WEIGHT: Record<AchievementRarity, number> = {
  LEGENDARY: 4,
  EPIC: 3,
  RARE: 2,
  COMMON: 1,
};

/**
 * Ids that are unlocked now and were not already accounted for.
 *
 * Order follows the catalog, so a caller that shows only the first still shows
 * the same badge every time for a given crossing.
 */
export function newlyUnlocked(currentUnlocked: string[], seen: string[]): string[] {
  const already = new Set(seen);
  return currentUnlocked.filter((id) => !already.has(id));
}

/**
 * The badge worth interrupting for. A single session can complete several at
 * once (a PR that is also a plate milestone), and stacking modals for each one
 * would turn a reward into a chore.
 */
export function headlineUnlock(ids: string[]): Achievement | null {
  let best: Achievement | null = null;
  let bestWeight = -1;
  for (const id of ids) {
    const a = achievementById(id);
    if (!a) continue;
    const weight = RARITY_WEIGHT[a.rarity];
    if (weight > bestWeight) {
      best = a;
      bestWeight = weight;
    }
  }
  return best;
}
