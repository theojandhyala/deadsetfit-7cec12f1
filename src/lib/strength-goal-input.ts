import { parsePreviewNumber } from "./performance-lab";
import { toKg, type WeightUnit } from "./units";

/** Goal input uses display units; persistent goal values always remain kilograms. */
export function strengthGoalInput(
  raw: string,
  unit: WeightUnit,
  currentBestKg: number,
): number | null {
  const displayed = parsePreviewNumber(raw);
  if (!Number.isFinite(displayed) || displayed <= 0 || !Number.isFinite(currentBestKg)) return null;
  const kg = toKg(displayed, unit);
  return kg > Math.max(0, currentBestKg) ? kg : null;
}
