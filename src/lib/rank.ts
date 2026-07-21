// Ranked ladder mapped to DEADSET grit points (0-1000).
// Inspired by the familiar competitive game ladder feel: clear tiers,
// divisions, glow colours, and a clean "one more session" progression loop.
export type RankTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "ELITE"
  | "CHAMPION"
  | "UNREAL"
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
    tier: "BRONZE",
    min: 0,
    max: 119,
    color: "#cd7f32",
    glowColor: "#92400e",
    gradient: ["#451a03", "#cd7f32"],
    icon: "🥉",
  },
  {
    tier: "SILVER",
    min: 120,
    max: 249,
    color: "#cbd5e1",
    glowColor: "#94a3b8",
    gradient: ["#1e293b", "#cbd5e1"],
    icon: "⚔️",
  },
  {
    tier: "GOLD",
    min: 250,
    max: 419,
    color: "#fbbf24",
    glowColor: "#d97706",
    gradient: ["#431407", "#fbbf24"],
    icon: "👑",
  },
  {
    tier: "PLATINUM",
    min: 420,
    max: 599,
    color: "#67e8f9",
    glowColor: "#0891b2",
    gradient: ["#0c4a6e", "#67e8f9"],
    icon: "💎",
  },
  {
    tier: "DIAMOND",
    min: 600,
    max: 759,
    color: "#a78bfa",
    glowColor: "#7c3aed",
    gradient: ["#2e1065", "#a78bfa"],
    icon: "💜",
  },
  {
    tier: "ELITE",
    min: 760,
    max: 849,
    color: "#f97316",
    glowColor: "#ea580c",
    gradient: ["#431407", "#fb923c"],
    icon: "⚡",
  },
  {
    tier: "CHAMPION",
    min: 850,
    max: 939,
    color: "#f43f5e",
    glowColor: "#e11d48",
    gradient: ["#4c0519", "#fb7185"],
    icon: "🏆",
  },
  {
    tier: "UNREAL",
    min: 940,
    max: 989,
    color: "#22d3ee",
    glowColor: "#06b6d4",
    gradient: ["#083344", "#67e8f9"],
    icon: "🌌",
  },
  {
    tier: "DEADSET",
    min: 990,
    max: 1000,
    color: "#e63222",
    glowColor: "#e63222",
    gradient: ["#450a0a", "#e63222"],
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
      const hasDivision = !["ELITE", "CHAMPION", "UNREAL", "DEADSET"].includes(t.tier);
      const division = hasDivision ? divisionForPoints(t.min, t.max, clamped) : null;
      const nextTierDef = i < TIERS.length - 1 ? TIERS[i + 1] : null;
      return {
        tier: t.tier,
        division,
        label: division ? `${t.tier} ${division}` : t.tier,
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
    tier: "BRONZE",
    division: "I",
    label: "BRONZE I",
    color: "#cd7f32",
    glowColor: "#92400e",
    gradient: ["#451a03", "#cd7f32"],
    icon: "🥉",
    minPoints: 0,
    maxPoints: 119,
    nextTier: "SILVER",
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
