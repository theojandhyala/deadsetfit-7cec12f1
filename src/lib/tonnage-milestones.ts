// Lifetime-tonnage milestones — the long game made visible. Thresholds are
// far enough apart that each one is a genuine event.

export interface TonnageMilestone {
  kg: number;
  label: string;
  /** What you've now out-lifted — the point of the milestone. */
  flavor: string;
  emoji: string;
}

export const TONNAGE_MILESTONES: TonnageMilestone[] = [
  { kg: 10_000, label: "10 tonnes", flavor: "a loaded cement mixer", emoji: "🚛" },
  { kg: 25_000, label: "25 tonnes", flavor: "a humpback whale calf and its mother", emoji: "🐋" },
  { kg: 50_000, label: "50 tonnes", flavor: "a battle tank", emoji: "🛡️" },
  {
    kg: 100_000,
    label: "100 tonnes",
    flavor: "a blue whale — the largest animal ever",
    emoji: "🌊",
  },
  { kg: 250_000, label: "250 tonnes", flavor: "a fully loaded Boeing 747", emoji: "✈️" },
  { kg: 500_000, label: "500 tonnes", flavor: "a deep-sea trawler", emoji: "🚢" },
  { kg: 1_000_000, label: "1,000 tonnes", flavor: "a million kilos. A MILLION.", emoji: "🚀" },
];

/** Highest milestone at or below the lifetime total, or null before the first. */
export function currentTonnageMilestone(totalKg: number): TonnageMilestone | null {
  let hit: TonnageMilestone | null = null;
  for (const m of TONNAGE_MILESTONES) {
    if (totalKg >= m.kg) hit = m;
  }
  return hit;
}

/** The next milestone ahead with progress toward it, or null past the last. */
export function nextTonnageMilestone(
  totalKg: number,
): { milestone: TonnageMilestone; pct: number } | null {
  for (const m of TONNAGE_MILESTONES) {
    if (totalKg < m.kg) {
      return { milestone: m, pct: Math.max(0, Math.min(99, Math.floor((totalKg / m.kg) * 100))) };
    }
  }
  return null;
}
