export function isPersonalRecord({
  weight,
  reps,
  bestWeight,
  bestBodyweightReps,
  supportsBodyweight,
  specialSet = false,
}: {
  weight: number;
  reps: number;
  bestWeight: number;
  bestBodyweightReps: number;
  supportsBodyweight: boolean;
  specialSet?: boolean;
}): boolean {
  if (specialSet || reps <= 0) return false;
  if (weight > 0) return weight > bestWeight;
  return supportsBodyweight && reps > bestBodyweightReps;
}
