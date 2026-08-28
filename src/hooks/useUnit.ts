import { useAppState } from "@/lib/storage";
import { unitOf, type WeightUnit } from "@/lib/units";

/**
 * The athlete's chosen weight unit.
 *
 * Exists so no screen has to remember to read it off state, and so a `kg`
 * literal anywhere in the UI is visibly a bug rather than a plausible default.
 * Weight is always *stored* in kilograms — this only decides what is shown.
 */
export function useUnit(): WeightUnit {
  const [state] = useAppState();
  return unitOf(state);
}
