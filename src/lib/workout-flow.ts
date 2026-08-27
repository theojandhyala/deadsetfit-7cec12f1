import { isWorkingSet } from "@/lib/set-tracking";
import type { CompletedSet, ExercisePlan, WorkoutSessionExercise } from "@/lib/types";

type ExerciseConfig = Record<string, ExercisePlan> | undefined;

export function completedWorkingSets(sets: CompletedSet[]): number {
  return sets.filter(isWorkingSet).length;
}

/** Converts the schedule's visible, adjacent links into session-stable group ids. */
export function buildSupersetIds(
  exerciseIds: string[],
  exerciseConfig: ExerciseConfig,
): Array<string | undefined> {
  const groups: Array<string | undefined> = Array(exerciseIds.length).fill(undefined);
  let activeGroup: string | undefined;

  exerciseIds.forEach((exerciseId, index) => {
    const linksNext =
      !!exerciseConfig?.[exerciseId]?.supersetWithNext && index < exerciseIds.length - 1;
    if (activeGroup) groups[index] = activeGroup;
    if (linksNext) {
      activeGroup ??= `superset-${index + 1}`;
      groups[index] = activeGroup;
      groups[index + 1] = activeGroup;
    } else {
      activeGroup = undefined;
    }
  });

  return groups;
}

export function supersetPosition(
  exercises: WorkoutSessionExercise[],
  index: number,
): { position: number; total: number } | null {
  const id = exercises[index]?.supersetId;
  if (!id) return null;
  const members = exercises.flatMap((exercise, memberIndex) =>
    exercise.supersetId === id ? [memberIndex] : [],
  );
  const position = members.indexOf(index);
  return position < 0 ? null : { position: position + 1, total: members.length };
}

export interface WorkoutStep {
  nextIndex: number;
  shouldRest: boolean;
}

/** Timed, distance and bodyweight movements must never be forced to invent a load. */
export function requiresWorkingWeight(
  exercise: Pick<WorkoutSessionExercise, "tracking">,
  equipment: string | string[] | undefined,
): boolean {
  const bodyweight = Array.isArray(equipment)
    ? equipment.includes("BODYWEIGHT")
    : equipment?.includes("BODYWEIGHT");
  return (exercise.tracking ?? "WEIGHT") === "WEIGHT" && !bodyweight;
}

/**
 * Chooses what the athlete should see after logging a normal working set.
 * Superset members advance immediately; rest begins only after the final
 * movement in a round. The logged set is projected because the state update
 * and this decision happen in the same event.
 */
export function nextStepAfterWorkingSet(
  exercises: WorkoutSessionExercise[],
  currentIndex: number,
): WorkoutStep {
  const current = exercises[currentIndex];
  if (!current) return { nextIndex: currentIndex, shouldRest: false };

  const projectedCount = (index: number) =>
    completedWorkingSets(exercises[index]!.sets) + (index === currentIndex ? 1 : 0);

  if (current.supersetId) {
    const members = exercises.flatMap((exercise, index) =>
      exercise.supersetId === current.supersetId ? [index] : [],
    );
    const position = members.indexOf(currentIndex);
    if (position >= 0 && position < members.length - 1) {
      return { nextIndex: members[position + 1]!, shouldRest: false };
    }

    const incomplete = members.find(
      (index) => projectedCount(index) < exercises[index]!.targetSets,
    );
    const afterGroup = members.length ? members[members.length - 1]! + 1 : currentIndex + 1;
    return {
      nextIndex: incomplete ?? (afterGroup < exercises.length ? afterGroup : currentIndex),
      shouldRest: true,
    };
  }

  const complete = projectedCount(currentIndex) >= current.targetSets;
  return {
    nextIndex: complete && currentIndex < exercises.length - 1 ? currentIndex + 1 : currentIndex,
    shouldRest: true,
  };
}
