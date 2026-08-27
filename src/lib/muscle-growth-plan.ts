import { defaultSchedule } from "./calc";
import { libraryExerciseToExercise } from "./exercise-library";
import { getExercise } from "./exercises";
import type { LibraryExercise } from "./library.functions";
import type { AppState, DayKey, ProgramExerciseRef } from "./types";

export interface GrowthPlanPrescription {
  exercise: LibraryExercise;
  sets: number;
  reps: string;
  restSeconds?: number;
}

export interface GrowthPlanResult {
  state: AppState;
  status: "ADDED" | "ALREADY_ADDED" | "NO_PLAN";
  destination: "PROGRAM" | "SCHEDULE" | null;
}

function saveExercise(state: AppState, prescription: GrowthPlanPrescription) {
  if (
    getExercise(prescription.exercise.id) ||
    state.savedExercises.some((exercise) => exercise.id === prescription.exercise.id)
  ) {
    return state.savedExercises;
  }
  const converted = libraryExerciseToExercise(prescription.exercise);
  return [
    ...state.savedExercises,
    { ...converted, sets: prescription.sets, reps: prescription.reps },
  ];
}

function normalisedName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function programRef(
  { exercise, sets, reps, restSeconds }: GrowthPlanPrescription,
  weightKg?: number,
): ProgramExerciseRef {
  return {
    id: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    primary_muscles:
      exercise.primary_muscles.length > 0 ? exercise.primary_muscles : [exercise.category],
    youtube_query: exercise.youtube_query || `${exercise.name} exercise form`,
    sets,
    reps,
    ...(restSeconds && restSeconds > 0 ? { restSeconds } : {}),
    ...(weightKg && weightKg > 0 ? { weightKg } : {}),
  };
}

/**
 * Adds one deterministic recommendation to the athlete's real training week.
 * An active programme owns the week, exactly as it does in Train; otherwise we
 * write to the custom schedule. No session/log is created here, so duration
 * movements still flow through the live logger and store `reps: 0` per set.
 */
export function addGrowthRecommendationToDay(
  state: AppState,
  dayKey: DayKey,
  prescription: GrowthPlanPrescription,
): GrowthPlanResult {
  const active = state.programs.find((program) => program.id === state.activeProgramId);
  if (active) {
    const day = active.days[dayKey] ?? { label: "REST", items: [] };
    const name = normalisedName(prescription.exercise.name);
    if (
      day.items.some(
        (item) => item.id === prescription.exercise.id || normalisedName(item.name) === name,
      )
    ) {
      return { state, status: "ALREADY_ADDED", destination: "PROGRAM" };
    }
    const knownWeight = Object.values(active.days)
      .flatMap((candidate) => candidate.items)
      .find((item) => item.id === prescription.exercise.id && (item.weightKg ?? 0) > 0)?.weightKg;
    const item = programRef(prescription, knownWeight);
    const converted = libraryExerciseToExercise(prescription.exercise);
    return {
      status: "ADDED",
      destination: "PROGRAM",
      state: {
        ...state,
        savedExercises: saveExercise(state, prescription),
        programs: state.programs.map((program) =>
          program.id === active.id
            ? {
                ...program,
                days: {
                  ...program.days,
                  [dayKey]: {
                    ...day,
                    label: day.label === "REST" ? converted.muscleGroup : day.label,
                    items: [...day.items, item],
                  },
                },
              }
            : program,
        ),
      },
    };
  }

  const schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
  if (!schedule) return { state, status: "NO_PLAN", destination: null };
  const day = schedule[dayKey] ?? { label: "REST", exerciseIds: [] };
  const name = normalisedName(prescription.exercise.name);
  if (
    day.exerciseIds.some((id) => {
      const existing = getExercise(id, state.savedExercises);
      return id === prescription.exercise.id || normalisedName(existing?.name ?? id) === name;
    })
  ) {
    return { state, status: "ALREADY_ADDED", destination: "SCHEDULE" };
  }
  const converted = libraryExerciseToExercise(prescription.exercise);
  const knownWeight = Object.values(schedule)
    .map((candidate) => candidate.exerciseConfig?.[prescription.exercise.id]?.weightKg)
    .find((weightKg) => (weightKg ?? 0) > 0);
  return {
    status: "ADDED",
    destination: "SCHEDULE",
    state: {
      ...state,
      savedExercises: saveExercise(state, prescription),
      schedule: {
        ...schedule,
        [dayKey]: {
          ...day,
          label: day.label === "REST" ? converted.muscleGroup : day.label,
          exerciseIds: [...day.exerciseIds, prescription.exercise.id],
          exerciseConfig: {
            ...(day.exerciseConfig ?? {}),
            [prescription.exercise.id]: {
              ...(day.exerciseConfig?.[prescription.exercise.id] ?? {}),
              sets: prescription.sets,
              reps: prescription.reps,
              ...(prescription.restSeconds && prescription.restSeconds > 0
                ? { restSeconds: prescription.restSeconds }
                : {}),
              ...(knownWeight ? { weightKg: knownWeight } : {}),
            },
          },
        },
      },
    },
  };
}

export function growthExerciseIsOnDay(
  state: AppState,
  dayKey: DayKey,
  exerciseId: string,
  exerciseName?: string,
) {
  const name = normalisedName(exerciseName ?? "");
  const active = state.programs.find((program) => program.id === state.activeProgramId);
  if (active) {
    return (
      active.days[dayKey]?.items.some(
        (item) => item.id === exerciseId || (name && normalisedName(item.name) === name),
      ) ?? false
    );
  }
  const schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
  return (
    schedule?.[dayKey]?.exerciseIds.some((id) => {
      const existing = getExercise(id, state.savedExercises);
      return id === exerciseId || (name && normalisedName(existing?.name ?? id) === name);
    }) ?? false
  );
}
