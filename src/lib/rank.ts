// Fortnite-style rank system with divisions mapped to grit points (0-1000)
export type RankTier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "DEADSET";

export type RankDivision = "I" | "II" | "III";

export interface Rank {
  tier: RankTier;
  division: RankDivision | null; // null for DEADSET
  label: string; // e.g. "GOLD II"
  color: string;
  glowColor: string;
  gradient: [string, string];
  icon: string; // emoji emblem
  minPoints: number;
  maxPoints: number;
  nextTier: RankTier | null;
}

const TIERS: Array<{
  tier: RankTier;
  min: number;
  max: number;
  color: string;
  glowColor: string;
  gradient: [string, string];
  icon: string;
}> = [
  {
    tier: "IRON",
    min: 0,
    max: 99,
    color: "#9ca3af",
    glowColor: "#6b7280",
    gradient: ["#374151", "#9ca3af"],
    icon: "🔩",
  },
  {
    tier: "BRONZE",
    min: 100,
    max: 249,
    color: "#cd7f32",
    glowColor: "#92400e",
    gradient: ["#451a03", "#cd7f32"],
    icon: "🥉",
  },
  {
    tier: "SILVER",
    min: 250,
    max: 499,
    color: "#cbd5e1",
    glowColor: "#94a3b8",
    gradient: ["#1e293b", "#cbd5e1"],
    icon: "⚔️",
  },
  {
    tier: "GOLD",
    min: 500,
    max: 749,
    color: "#fbbf24",
    glowColor: "#d97706",
    gradient: ["#431407", "#fbbf24"],
    icon: "👑",
  },
  {
    tier: "PLATINUM",
    min: 750,
    max: 899,
    color: "#67e8f9",
    glowColor: "#0891b2",
    gradient: ["#0c4a6e", "#67e8f9"],
    icon: "💎",
  },
  {
    tier: "DIAMOND",
    min: 900,
    max: 999,
    color: "#a78bfa",
    glowColor: "#7c3aed",
    gradient: ["#2e1065", "#a78bfa"],
    icon: "💜",
  },
  {
    tier: "DEADSET",
    min: 1000,
    max: 1000,
    color: "#E10600",
    glowColor: "#E10600",
    gradient: ["#450a0a", "#E10600"],
    icon: "🔥",
  },
];

function divisionForPoints(min: number, max: number, points: number): RankDivision {
  const range = max - min;
  const progress = points - min;
  if (progress >= range * 0.67) return "III";
  if (progress >= range * 0.34) return "II";
  return "I";
}

export function getRank(gritPoints: number): Rank {
  const clamped = Math.max(0, Math.min(1000, gritPoints));

  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i];
    if (clamped >= t.min) {
      const isDeadset = t.tier === "DEADSET";
      const division = isDeadset ? null : divisionForPoints(t.min, t.max, clamped);
      const nextTierDef = i < TIERS.length - 1 ? TIERS[i + 1] : null;
      return {
        tier: t.tier,
        division,
        label: isDeadset ? "DEADSET" : `${t.tier} ${division}`,
        color: t.color,
        glowColor: t.glowColor,
        gradient: t.gradient,
        icon: t.icon,
        minPoints: t.min,
        maxPoints: t.max,
        nextTier: nextTierDef?.tier ?? null,
      };
    }
  }

  // Fallback (shouldn't happen)
  return {
    tier: "IRON",
    division: "I",
    label: "IRON I",
    color: "#9ca3af",
    glowColor: "#6b7280",
    gradient: ["#374151", "#9ca3af"],
    icon: "🔩",
    minPoints: 0,
    maxPoints: 99,
    nextTier: "BRONZE",
  };
}

export function rankProgress(gritPoints: number): number {
  const rank = getRank(gritPoints);
  if (rank.tier === "DEADSET") return 1;
  const range = rank.maxPoints - rank.minPoints;
  if (range === 0) return 1;
  return Math.min(1, (gritPoints - rank.minPoints) / range);
}

export function pointsToNextTier(gritPoints: number): number {
  const rank = getRank(gritPoints);
  if (rank.tier === "DEADSET") return 0;
  return rank.maxPoints + 1 - gritPoints;
}
