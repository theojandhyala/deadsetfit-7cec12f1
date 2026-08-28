// Strength standards as bodyweight multiples for the big three, and
// estimated rep-max tables from a known/estimated 1RM.

export type StandardTier = "UNTRAINED" | "NOVICE" | "INTERMEDIATE" | "ADVANCED" | "ELITE";

export const TIER_ORDER: StandardTier[] = [
  "UNTRAINED",
  "NOVICE",
  "INTERMEDIATE",
  "ADVANCED",
  "ELITE",
];

export const TIER_COLORS: Record<StandardTier, string> = {
  UNTRAINED: "#8a8a8a",
  NOVICE: "#b8b8b0",
  INTERMEDIATE: "#fbbf24",
  ADVANCED: "#e63222",
  ELITE: "#e63222",
};

type LiftId = "bench-press" | "squat" | "deadlift";

/** Minimum bodyweight multiple to enter each tier (NOVICE and up). */
const MALE_STANDARDS: Record<LiftId, number[]> = {
  "bench-press": [0.75, 1.0, 1.5, 2.0],
  squat: [1.0, 1.5, 2.0, 2.5],
  deadlift: [1.25, 1.75, 2.25, 2.75],
};

const FEMALE_STANDARDS: Record<LiftId, number[]> = {
  "bench-press": [0.5, 0.75, 1.0, 1.25],
  squat: [0.75, 1.0, 1.5, 2.0],
  deadlift: [1.0, 1.25, 1.75, 2.25],
};

export interface StrengthStandard {
  tier: StandardTier;
  /** 1RM as a multiple of bodyweight */
  ratio: number;
  /** Next tier up, if any */
  nextTier: StandardTier | null;
  /** kg 1RM needed to enter the next tier */
  nextAtKg: number | null;
  /** 0-1 progress from current tier floor to next tier floor */
  progress: number;
}

export function strengthStandard(
  oneRmKg: number,
  bodyweightKg: number,
  liftId: LiftId,
  gender?: string | null,
): StrengthStandard | null {
  if (!oneRmKg || !bodyweightKg) return null;
  if (gender !== "MALE" && gender !== "FEMALE") return null;
  const table = gender === "FEMALE" ? FEMALE_STANDARDS[liftId] : MALE_STANDARDS[liftId];
  const ratio = oneRmKg / bodyweightKg;
  let tierIdx = 0;
  for (let i = 0; i < table.length; i++) {
    if (ratio >= table[i]) tierIdx = i + 1;
  }
  const tier = TIER_ORDER[tierIdx];
  const nextTier = tierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[tierIdx + 1] : null;
  const nextMultiple = tierIdx < table.length ? table[tierIdx] : null;
  const nextAtKg = nextMultiple ? Math.ceil((nextMultiple * bodyweightKg) / 2.5) * 2.5 : null;
  const floor = tierIdx === 0 ? 0 : table[tierIdx - 1];
  const ceil = nextMultiple ?? floor;
  const progress =
    nextMultiple === null ? 1 : Math.max(0, Math.min(1, (ratio - floor) / (ceil - floor)));
  return { tier, ratio: Math.round(ratio * 100) / 100, nextTier, nextAtKg, progress };
}

export interface RepMax {
  reps: number;
  weightKg: number;
}

/** Estimated rep maxes from a 1RM (inverse Epley, rounded to 2.5kg). */
export function repMaxTable(oneRmKg: number): RepMax[] {
  if (!oneRmKg) return [];
  return [1, 3, 5, 8, 12].map((reps) => ({
    reps,
    weightKg:
      reps === 1
        ? Math.round(oneRmKg / 2.5) * 2.5
        : Math.round(oneRmKg / (1 + reps / 30) / 2.5) * 2.5,
  }));
}
