import type { AppState } from "./types";

/**
 * Weight units.
 *
 * Everything in this app is *stored* in kilograms, always. Units are a display
 * concern applied at the boundary — the moment a pound value reaches storage,
 * every historical comparison, PR check and volume total silently becomes
 * wrong, and there is no way to tell afterwards which rows were which.
 *
 * So: `toDisplay` on the way out, `toKg` on the way in, and nothing in between
 * ever thinks about pounds.
 */
export type WeightUnit = "kg" | "lb";

export const KG_PER_LB = 0.45359237;

export function unitOf(state: Pick<AppState, "units"> | null | undefined): WeightUnit {
  return state?.units === "lb" ? "lb" : "kg";
}

/** Kilograms → the number shown to this athlete. */
export function toDisplay(kg: number, unit: WeightUnit): number {
  if (!Number.isFinite(kg)) return 0;
  if (unit === "kg") return round(kg, 1);
  return round(kg / KG_PER_LB, 0);
}

/** A number the athlete typed → kilograms for storage. */
export function toKg(value: number, unit: WeightUnit): number {
  if (!Number.isFinite(value)) return 0;
  if (unit === "kg") return round(value, 2);
  return round(value * KG_PER_LB, 2);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Trailing ".0" wastes width on a phone and reads like false precision. */
export function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(round(value, 1));
}

/** "60 kg" / "135 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${trimNumber(toDisplay(kg, unit))} ${unit}`;
}

/** Just the number, for places that label the unit separately. */
export function formatWeightValue(kg: number, unit: WeightUnit): string {
  return trimNumber(toDisplay(kg, unit));
}

/** Big totals: "12,400 kg" / "27,337 lb". */
export function formatVolume(kg: number, unit: WeightUnit): string {
  return `${Math.round(toDisplay(kg, unit)).toLocaleString()} ${unit}`;
}

/**
 * The smallest step that makes sense to nudge a weight by.
 *
 * 2.5 kg is a pair of the smallest common plates; 5 lb is the same idea in a
 * pound gym. Stepping a pound gym by 2.5 kg would offer weights nobody can
 * actually load.
 */
export function increment(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : 5;
}

/** Round a kg value to something loadable in the athlete's own gym. */
export function snapToLoadable(kg: number, unit: WeightUnit): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  const step = increment(unit);
  const displayed = toDisplay(kg, unit);
  const snapped = Math.round(displayed / step) * step;
  return toKg(snapped, unit);
}

/** Plates available per side, heaviest first, in the athlete's units. */
export function plateSizes(unit: WeightUnit): number[] {
  return unit === "kg" ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
}

/** The bars a gym in these units actually has, in kg for storage. */
export function defaultBarKg(unit: WeightUnit): number {
  // A pound gym's standard bar is 45 lb, which is 20.41 kg — close enough to
  // 20 that treating them as the same would be wrong by a pound on every set.
  return unit === "kg" ? 20 : toKg(45, "lb");
}

export interface PlateLoad {
  /** Plates per side, in display units, heaviest first. */
  perSide: number[];
  /** What could not be loaded, in display units. */
  remainder: number;
  /** The bar, in display units. */
  bar: number;
}

/**
 * Plates per side for a target weight, worked in the athlete's own units.
 *
 * Converting a kg breakdown into pounds afterwards produces numbers like
 * "20.4" that match no plate in any gym, which is why this computes in the
 * display unit from the start.
 */
export function plateLoad(totalKg: number, barKg: number, unit: WeightUnit): PlateLoad | null {
  if (!Number.isFinite(totalKg) || barKg <= 0 || totalKg < barKg) return null;
  const total = toDisplay(totalKg, unit);
  const bar = toDisplay(barKg, unit);
  let remaining = (total - bar) / 2;
  const perSide: number[] = [];
  for (const plate of plateSizes(unit)) {
    while (remaining >= plate - 1e-9) {
      perSide.push(plate);
      remaining -= plate;
    }
  }
  return { perSide, remainder: round(remaining * 2, 2), bar };
}
