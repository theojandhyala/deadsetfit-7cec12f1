import type { LibraryExercise } from "./library.functions";
import type { Equipment, Exercise, Experience } from "./types";

const MUSCLE_ALIASES: Array<[Exercise["muscleGroup"], string[]]> = [
  ["CHEST", ["CHEST", "PECTORAL"]],
  ["BACK", ["BACK", "LAT", "LATISSIMUS", "TRAP", "TRAPEZIUS", "RHOMBOID", "ERECTOR"]],
  [
    "LEGS",
    ["QUAD", "QUADRICEP", "HAMSTRING", "GLUTE", "CALF", "CALVES", "ADDUCTOR", "ABDUCTOR", "LEG"],
  ],
  ["SHOULDERS", ["SHOULDER", "DELT", "DELTOID", "ROTATOR"]],
  ["ARMS", ["BICEP", "TRICEP", "FOREARM", "BRACHIALIS", "ARM"]],
  ["CORE", ["ABS", "ABDOMINAL", "ABDOMINIS", "CORE", "OBLIQUE"]],
];

function muscleGroup(exercise: LibraryExercise): Exercise["muscleGroup"] {
  // Primary anatomy must win over a supporting muscle or broad push/pull category.
  for (const source of [
    exercise.primary_muscles,
    [exercise.category],
    exercise.secondary_muscles,
  ]) {
    for (const raw of source) {
      const label = raw.toUpperCase().replace(/[_-]+/g, " ");
      const match = MUSCLE_ALIASES.find(([, aliases]) =>
        aliases.some((alias) =>
          new RegExp(`\\b${alias}${alias === "LAT" ? "(?:S|ISSIMUS)?\\b" : ""}`).test(
            label,
          ),
        ),
      );
      if (match) return match[0];
    }
  }
  return "CORE";
}

function equipmentAccess(label: string): Equipment[] {
  const equipment = label.toUpperCase();
  if (equipment.includes("BODYWEIGHT") || equipment.includes("NONE")) {
    return ["BODYWEIGHT", "HOME_GYM", "FULL_GYM"];
  }
  if (
    equipment.includes("DUMBBELL") ||
    equipment.includes("KETTLEBELL") ||
    equipment.includes("BAND")
  ) {
    return ["HOME_GYM", "FULL_GYM"];
  }
  return ["FULL_GYM"];
}

function experience(difficulty: number): Experience {
  if (difficulty <= 2) return "BEGINNER";
  if (difficulty >= 5) return "ADVANCED";
  return "INTERMEDIATE";
}

export function libraryExerciseToExercise(exercise: LibraryExercise): Exercise {
  const compound = exercise.is_compound;
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: muscleGroup(exercise),
    equipment: equipmentAccess(exercise.equipment),
    equipmentLabel: exercise.equipment,
    primaryMuscles: exercise.primary_muscles,
    secondaryMuscles: exercise.secondary_muscles,
    skill: experience(exercise.difficulty),
    sets: compound ? 4 : 3,
    reps: compound ? "6-8" : "8-12",
    videoId: "",
    youtubeQuery: exercise.youtube_query || `${exercise.name} exercise form`,
    instruction: exercise.instructions || `Perform ${exercise.name} with controlled form.`,
    proTip: exercise.pro_tip,
    isCompound: compound,
  };
}
