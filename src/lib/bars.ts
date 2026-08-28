import { formatWeight, toKg, type WeightUnit } from "./units";

/**
 * Barbells.
 *
 * The plate calculator assumed every bar weighs 20 kg. On a trap bar that is
 * 5 kg of silently wrong load, and on an EZ bar it is 10 — enough to make the
 * plate maths hand you the wrong plates, and enough to skew a logged weight
 * against a lift's history. Strong lets you set the bar per exercise; so does
 * this, and the choice is remembered on the plan.
 */

export interface BarType {
  id: string;
  name: string;
  kg: number;
  /** Shown in the picker so nobody has to remember which bar is which. */
  note: string;
}

/**
 * The bars in front of the athlete, in the units they read.
 *
 * Every note used to be written in kilograms, so a pound gym was told its
 * bench bar weighs "20 kg". The masses themselves are real and stay in
 * kilograms — a bar does not change weight because of a setting — with one
 * exception: a pound gym's standard bar genuinely is 45 lb, not a converted
 * 20 kg, and `defaultBarKg` already treats them as different bars. Treating
 * them as the same would be wrong by a pound on every single set.
 *
 * The specialty bars keep their metric masses converted rather than being
 * given invented imperial equivalents. Guessing at a trap bar's weight makes
 * every set logged on it wrong, which is worse than an unfamiliar number.
 */
export function barTypes(unit: WeightUnit): BarType[] {
  const olympicKg = unit === "lb" ? toKg(45, "lb") : 20;
  const womensKg = unit === "lb" ? toKg(35, "lb") : 15;
  const show = (kg: number) => formatWeight(kg, unit);
  return [
    {
      id: "olympic",
      name: "Olympic bar",
      kg: olympicKg,
      note: `Standard 7ft, ${show(olympicKg)}`,
    },
    { id: "womens", name: "Women's bar", kg: womensKg, note: `${show(womensKg)}, thinner grip` },
    { id: "ez", name: "EZ curl bar", kg: 10, note: `Cambered, ${show(10)}` },
    { id: "trap", name: "Trap / hex bar", kg: 25, note: `Usually ${show(25)}` },
    { id: "safety-squat", name: "Safety squat bar", kg: 25, note: `Padded yoke, ${show(25)}` },
    {
      id: "swiss",
      name: "Swiss / football bar",
      kg: 17.5,
      note: `Neutral grips, ${show(17.5)}`,
    },
    { id: "smith", name: "Smith machine", kg: 7, note: "Counterbalanced carriage" },
    { id: "none", name: "No bar", kg: 0, note: "Dumbbells, machines, cables" },
  ];
}

/** The metric bar set, for logic that does not display anything. */
export const BAR_TYPES: BarType[] = barTypes("kg");

export const DEFAULT_BAR_KG = 20;

/** The bar whose weight this is, for showing the athlete what they picked. */
export function barTypeForKg(kg: number | undefined): BarType | undefined {
  if (kg == null) return undefined;
  return BAR_TYPES.find((bar) => bar.kg === kg);
}

/** Short label for a chip: "20 kg bar", "Trap bar", "No bar". */
export function barLabel(kg: number | undefined, unit: WeightUnit): string {
  const resolved = kg ?? DEFAULT_BAR_KG;
  if (resolved === 0) return "No bar";
  const bars = barTypes(unit);
  const type = bars.find((bar) => Math.abs(bar.kg - resolved) < 0.01);
  // Prefer the name when it is unambiguous; two bars share 25 kg, so fall back
  // to the weight rather than claiming it is specifically a trap bar.
  const sharesWeight = bars.filter((bar) => Math.abs(bar.kg - resolved) < 0.01).length > 1;
  if (type && !sharesWeight) return `${type.name}`;
  return `${formatWeight(resolved, unit)} bar`;
}

/**
 * Which movements are loaded on a bar at all. Used to decide whether the plate
 * calculator and the bar picker are worth showing: offering a bar weight for a
 * cable fly is noise.
 */
const BARBELL_NAMES =
  /\b(barbell|bench|squat|deadlift|press|row|curl|clean|snatch|jerk|thruster|lunge|shrug|rack pull|good ?morning|hip thrust|pendlay|zercher|floor press|overhead)\b/i;
const NOT_BARBELL =
  /\b(dumbbell|db|cable|machine|smith|kettlebell|band|bodyweight|push ?up|pull ?up|chin ?up|dip|fly|flye|raise|pulldown|pushdown|extension|curl machine|leg press|hack)\b/i;

export function usesBarbell(name: string): boolean {
  if (NOT_BARBELL.test(name)) return false;
  return BARBELL_NAMES.test(name);
}
