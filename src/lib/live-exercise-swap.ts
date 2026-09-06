import type { Equipment, Exercise } from "./types";

export interface LiveSwapOptions {
  currentExerciseId: string;
  targetMuscles: string[];
  availableEquipment?: Equipment;
  reservedExerciseIds?: string[];
  query?: string;
}

/**
 * Returns session-safe alternatives for a movement that is unavailable in the
 * gym. A replacement must train the same primary muscle, fit the athlete's
 * equipment, and not duplicate another movement already in this workout.
 */
export function liveExerciseSwapCandidates(
  exercises: Exercise[],
  {
    currentExerciseId,
    targetMuscles,
    availableEquipment,
    reservedExerciseIds = [],
    query = "",
  }: LiveSwapOptions,
): Exercise[] {
  const targetGroups = new Set(targetMuscles.map((muscle) => muscle.trim().toUpperCase()));
  const reserved = new Set(reservedExerciseIds);
  const search = query.trim().toLowerCase();
  const unique = new Map<string, Exercise>();

  for (const exercise of exercises) unique.set(exercise.id, exercise);

  return [...unique.values()]
    .filter((exercise) => {
      if (exercise.id === currentExerciseId || reserved.has(exercise.id)) return false;
      if (!targetGroups.has(exercise.muscleGroup)) return false;
      if (
        availableEquipment &&
        !exercise.equipment.includes(availableEquipment) &&
        !exercise.equipment.includes("BODYWEIGHT")
      )
        return false;
      if (!search) return true;
      return (
        exercise.name.toLowerCase().includes(search) ||
        exercise.equipmentLabel?.toLowerCase().includes(search) === true
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
