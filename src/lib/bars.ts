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

export const BAR_TYPES: BarType[] = [
  { id: "olympic", name: "Olympic bar", kg: 20, note: "Standard 7ft, 20 kg" },
  { id: "womens", name: "Women's bar", kg: 15, note: "15 kg, thinner grip" },
  { id: "ez", name: "EZ curl bar", kg: 10, note: "Cambered, 10 kg" },
  { id: "trap", name: "Trap / hex bar", kg: 25, note: "Usually 25 kg" },
  { id: "safety-squat", name: "Safety squat bar", kg: 25, note: "Padded yoke, 25 kg" },
  { id: "swiss", name: "Swiss / football bar", kg: 17.5, note: "Neutral grips, 17.5 kg" },
  { id: "smith", name: "Smith machine", kg: 7, note: "Counterbalanced carriage" },
  { id: "none", name: "No bar", kg: 0, note: "Dumbbells, machines, cables" },
];

export const DEFAULT_BAR_KG = 20;

/** The bar whose weight this is, for showing the athlete what they picked. */
export function barTypeForKg(kg: number | undefined): BarType | undefined {
  if (kg == null) return undefined;
  return BAR_TYPES.find((bar) => bar.kg === kg);
}

/** Short label for a chip: "20 kg bar", "Trap bar", "No bar". */
export function barLabel(kg: number | undefined): string {
  const resolved = kg ?? DEFAULT_BAR_KG;
  if (resolved === 0) return "No bar";
  const type = barTypeForKg(resolved);
  // Prefer the name when it is unambiguous; two bars share 25 kg, so fall back
  // to the weight rather than claiming it is specifically a trap bar.
  const sharesWeight = BAR_TYPES.filter((bar) => bar.kg === resolved).length > 1;
  if (type && !sharesWeight) return `${type.name}`;
  return `${resolved} kg bar`;
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
