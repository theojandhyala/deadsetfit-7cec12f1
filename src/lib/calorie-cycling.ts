import type { DayKey } from "./types";

// Calorie cycling — same weekly average the goal already set, redistributed
// so training days get more fuel and rest days get less. Pure arithmetic.

export interface CalorieCycle {
  kind: "TRAINING" | "REST";
  todayTarget: number;
  baseTarget: number;
  /** Signed difference between today's cycled target and the flat target. */
  delta: number;
  trainingTarget: number;
  restTarget: number;
}

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** Total gap between a training day and a rest day, as a fraction of base. */
const SWING = 0.16;

function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

export function calorieCycle(
  baseCalories: number,
  trainingDays: DayKey[],
  todayIso: string,
): CalorieCycle | null {
  const t = new Set(trainingDays).size;
  // All-training or all-rest weeks have nothing to cycle between.
  if (!baseCalories || baseCalories <= 0 || t <= 0 || t >= 7) return null;

  const dow = new Date(`${todayIso}T00:00:00Z`).getUTCDay();
  if (!Number.isFinite(dow)) return null;
  const todayKey = DAY_KEYS[(dow + 6) % 7];

  // Split the swing so the weekly average stays exactly the flat target:
  // t days at +a and (7−t) days at −b average out when t·a = (7−t)·b.
  const bump = baseCalories * SWING * ((7 - t) / 7);
  const cut = baseCalories * SWING * (t / 7);
  const trainingTarget = round10(baseCalories + bump);
  const restTarget = round10(baseCalories - cut);

  const kind: CalorieCycle["kind"] = new Set(trainingDays).has(todayKey) ? "TRAINING" : "REST";
  const todayTarget = kind === "TRAINING" ? trainingTarget : restTarget;

  return {
    kind,
    todayTarget,
    baseTarget: baseCalories,
    delta: todayTarget - baseCalories,
    trainingTarget,
    restTarget,
  };
}
