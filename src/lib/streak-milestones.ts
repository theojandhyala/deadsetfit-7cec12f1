// Streak milestones — deterministic rewards for consecutive training days.
// No AI, no server needed; computed from completedDates.

export interface StreakMilestone {
  days: number;
  label: string;
  emoji: string;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, label: "Warming Up", emoji: "🔥" },
  { days: 7, label: "One Week Strong", emoji: "🔥" },
  { days: 14, label: "Two Weeks Deep", emoji: "⚡" },
  { days: 30, label: "One Month Locked", emoji: "🏅" },
  { days: 50, label: "Half Century", emoji: "🥉" },
  { days: 75, label: "Relentless", emoji: "🥈" },
  { days: 100, label: "Century Club", emoji: "🥇" },
  { days: 150, label: "Unbreakable", emoji: "💎" },
  { days: 200, label: "Double Century", emoji: "👑" },
  { days: 365, label: "One Year DEADSET", emoji: "🏆" },
];

/** The highest milestone the streak has reached (or null if below the first). */
export function currentMilestone(streak: number): StreakMilestone | null {
  let hit: StreakMilestone | null = null;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m.days) hit = m;
    else break;
  }
  return hit;
}

/** The next milestone to chase (or null once every milestone is reached). */
export function nextMilestone(streak: number): StreakMilestone | null {
  for (const m of STREAK_MILESTONES) {
    if (streak < m.days) return m;
  }
  return null;
}

/** Progress 0–1 toward the next milestone from the previous one. */
export function milestoneProgress(streak: number): number {
  const next = nextMilestone(streak);
  if (!next) return 1;
  const prev = currentMilestone(streak)?.days ?? 0;
  const span = next.days - prev;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (streak - prev) / span));
}
