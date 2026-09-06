import type { LibraryExercise } from "./library.functions";
import type { Equipment, Exercise, Experience } from "./types";

const MUSCLE_ALIASES: Array<[Exercise["muscleGroup"], string[]]> = [
  ["CHEST", ["CHEST", "PECTORAL"]],
  ["BACK", ["BACK", "LAT", "TRAP", "RHOMBOID", "ERECTOR"]],
  ["LEGS", ["QUAD", "HAMSTRING", "GLUTE", "CALF", "ADDUCTOR", "ABDUCTOR", "LEG"]],
  ["SHOULDERS", ["SHOULDER", "DELT", "ROTATOR"]],
  ["ARMS", ["BICEP", "TRICEP", "FOREARM", "BRACHIALIS", "ARM"]],
  ["CORE", ["ABS", "ABDOMINAL", "CORE", "OBLIQUE"]],
];

function muscleGroup(exercise: LibraryExercise): Exercise["muscleGroup"] {
  const haystack = [exercise.category, ...exercise.primary_muscles, ...exercise.secondary_muscles]
    .join(" ")
    .toUpperCase();
  return (
    MUSCLE_ALIASES.find(([, aliases]) => aliases.some((alias) => haystack.includes(alias)))?.[0] ??
    "CORE"
  );
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
