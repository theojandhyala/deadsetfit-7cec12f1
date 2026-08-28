import { defaultSchedule, WEEK } from "./calc";
import { getExercise } from "./exercises";
import { trackingModeFor } from "./set-tracking";
import { DAY_FULL, describeDays } from "./training-days";
import type { DayKey, FocusMuscle, Profile, Schedule } from "./types";
import { requiresWorkingWeight } from "./workout-flow";

export type SetupMode = "GENERATE" | "BUILD";

export type SetupRequirement =
  | "GOAL"
  | "TRAINING_DAYS"
  | "EQUIPMENT"
  | "EXPERIENCE"
  | "SESSION"
  | "WORKOUT"
  | "STARTING_WEIGHTS";

export interface SetupBlueprintDay {
  dayKey: DayKey;
  dayLabel: string;
  label: string;
  shortLabel: string;
  exerciseCount: number;
  isTraining: boolean;
}

export interface SetupBlueprintRecovery {
  status: "OPEN" | "BALANCED" | "WATCH" | "HIGH_FREQUENCY";
  headline: string;
  detail: string;
  restDays: number;
  longestTrainingRun: number;
}

export interface SetupBlueprintFirstWorkout {
  ready: boolean;
  status: "BUILDING" | "ADD_WORKOUT" | "SET_WEIGHTS" | "READY";
  dayKey: DayKey | null;
  dayLabel: string | null;
  workoutLabel: string | null;
  exerciseCount: number;
  missingWeightCount: number;
  missingRequirements: SetupRequirement[];
  message: string;
}

export interface LiveSetupBlueprint {
  splitName: string;
  splitDetail: string;
  isProvisional: boolean;
  week: SetupBlueprintDay[];
  priorityMuscles: FocusMuscle[];
  priorityLabel: string;
  priorityDetail: string;
  coveredMuscles: FocusMuscle[];
  missingMuscles: FocusMuscle[];
  sessionMinutes: 30 | 45 | 60 | 90;
  exercisesPerSession: 3 | 4 | 5 | 6 | 7 | 8;
  sessionLabel: string;
  sessionDetail: string;
  recovery: SetupBlueprintRecovery;
  firstWorkout: SetupBlueprintFirstWorkout;
}

export interface SetupBlueprintOptions {
  /** BUILD stays empty until the athlete supplies a schedule; GENERATE previews the generated week. */
  mode?: SetupMode;
  /** A hand-edited or already-generated schedule always wins over the preview. */
  schedule?: Schedule | null;
}

const MUSCLES: FocusMuscle[] = ["CHEST", "BACK", "SHOULDERS", "ARMS", "LEGS", "CORE"];

const DEFAULT_DRAFT: Profile = {
  goal: "MAINTAIN",
  experience: "BEGINNER",
  age: 25,
  weightKg: 75,
  heightCm: 175,
  gender: "OTHER",
  daysPerWeek: 3,
  equipment: "FULL_GYM",
  exercisesPerSession: 4,
  sessionMinutes: 45,
};

function uniqueTrainingDays(days: DayKey[] | undefined): DayKey[] {
  return WEEK.filter((day) => days?.includes(day));
}

function chosenDayCount(draft: Partial<Profile>, days: DayKey[]): 3 | 4 | 5 | 6 {
  if (days.length >= 3) return Math.min(days.length, 6) as 3 | 4 | 5 | 6;
  const wanted = Number(draft.daysPerWeek);
  if (wanted >= 3 && wanted <= 6) return wanted as 3 | 4 | 5 | 6;
  return 3;
}

function exerciseCountFor(draft: Partial<Profile>): 3 | 4 | 5 | 6 | 7 | 8 {
  const count = Number(draft.exercisesPerSession);
  if (count >= 3 && count <= 8) return count as 3 | 4 | 5 | 6 | 7 | 8;
  if (draft.sessionMinutes === 30) return 3;
  if (draft.sessionMinutes === 60) return 5;
  if (draft.sessionMinutes === 90) return 7;
  return 4;
}

function sessionMinutesFor(draft: Partial<Profile>, exerciseCount: number): 30 | 45 | 60 | 90 {
  if (
    draft.sessionMinutes === 30 ||
    draft.sessionMinutes === 45 ||
    draft.sessionMinutes === 60 ||
    draft.sessionMinutes === 90
  ) {
    return draft.sessionMinutes;
  }
  if (exerciseCount <= 3) return 30;
  if (exerciseCount <= 4) return 45;
  if (exerciseCount <= 5) return 60;
  return 90;
}

function profileForPreview(draft: Partial<Profile>, selectedDays: DayKey[]): Profile {
  const exercisesPerSession = exerciseCountFor(draft);
  const daysPerWeek = chosenDayCount(draft, selectedDays);
  return {
    ...DEFAULT_DRAFT,
    ...draft,
    goal: draft.goal ?? DEFAULT_DRAFT.goal,
    experience: draft.experience ?? DEFAULT_DRAFT.experience,
    age: draft.age ?? DEFAULT_DRAFT.age,
    weightKg: draft.weightKg ?? DEFAULT_DRAFT.weightKg,
    heightCm: draft.heightCm ?? DEFAULT_DRAFT.heightCm,
    gender: draft.gender ?? DEFAULT_DRAFT.gender,
    equipment: draft.equipment ?? DEFAULT_DRAFT.equipment,
    daysPerWeek,
    // An unfinished one- or two-day selection must not quietly generate an
    // undersized week. Preview the safe spread until the answer is valid.
    trainingDays: selectedDays.length >= 3 ? selectedDays.slice(0, 6) : undefined,
    exercisesPerSession,
    sessionMinutes: sessionMinutesFor(draft, exercisesPerSession),
  };
}

function shortWorkoutLabel(label: string): string {
  const clean = label.trim();
  if (!clean || clean === "REST") return "REST";
  return clean.split(/\s+[—–-]\s+/)[0]!.trim();
}

function splitNameFor(mode: SetupMode, trainingCount: number): string {
  if (mode === "BUILD") return trainingCount ? "YOUR CUSTOM SPLIT" : "BUILD YOUR SPLIT";
  if (trainingCount === 3) return "FULL BODY";
  if (trainingCount === 4) return "UPPER / LOWER";
  if (trainingCount === 5) return "PUSH / PULL / LEGS";
  if (trainingCount >= 6) return "PPL + SPECIALISATION";
  return "YOUR TRAINING WEEK";
}

function longestTrainingRun(week: SetupBlueprintDay[]): number {
  const flags = week.map((day) => day.isTraining);
  if (flags.every(Boolean)) return flags.length;
  let longest = 0;
  let current = 0;
  // Doubling catches a Sat-Sun-Mon run while the cap prevents counting a week twice.
  for (const training of [...flags, ...flags]) {
    current = training ? Math.min(current + 1, flags.length) : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function recoveryFor(
  draft: Partial<Profile>,
  trainingCount: number,
  longestRun: number,
): SetupBlueprintRecovery {
  const restDays = Math.max(0, 7 - trainingCount);
  const restCopy = `${restDays} ${restDays === 1 ? "rest day" : "rest days"}`;

  if (trainingCount === 0) {
    return {
      status: "OPEN",
      headline: "RECOVERY SPACE OPEN",
      detail: "Add your training days and the setup will show where recovery fits.",
      restDays: 7,
      longestTrainingRun: 0,
    };
  }
  if (draft.sleepQuality === "LOW") {
    return {
      status: "WATCH",
      headline: "RECOVERY WATCH ON",
      detail: `Low sleep noted. Use the readiness check before hard sessions; your week keeps ${restCopy}.`,
      restDays,
      longestTrainingRun: longestRun,
    };
  }
  if (draft.weakness === "RECOVERY") {
    return {
      status: "WATCH",
      headline: "RECOVERY IS A PRIORITY",
      detail: `Recovery is marked as your weak point. Protect ${restCopy} and adjust effort when readiness drops.`,
      restDays,
      longestTrainingRun: longestRun,
    };
  }
  if (trainingCount >= 6 || longestRun >= 3) {
    return {
      status: "HIGH_FREQUENCY",
      headline: "HIGH-FREQUENCY WEEK",
      detail: `${longestRun} sessions land back-to-back. Keep ${restCopy} protected and watch muscle recovery before adding volume.`,
      restDays,
      longestTrainingRun: longestRun,
    };
  }
  return {
    status: "BALANCED",
    headline: "RECOVERY BALANCED",
    detail: `${restCopy} break up ${trainingCount} training ${trainingCount === 1 ? "day" : "days"}.`,
    restDays,
    longestTrainingRun: longestRun,
  };
}

function titleCaseMuscle(muscle: FocusMuscle): string {
  return muscle[0] + muscle.slice(1).toLowerCase();
}

function priorityCopy(priorityMuscles: FocusMuscle[]) {
  if (!priorityMuscles.length) {
    return {
      label: "BALANCED DEVELOPMENT",
      detail:
        "No single area is over-prioritised. The Strength Map will reveal any gaps in the week.",
    };
  }
  const labels = priorityMuscles.map(titleCaseMuscle);
  const readable =
    labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} + ${labels.at(-1)}`;
  return {
    label: `${readable.toUpperCase()} PRIORITY`,
    detail: `${readable} are pinned while the Strength Map keeps every other area visible.`,
  };
}

function knownWorkingWeights(schedule: Schedule): Map<string, number> {
  const known = new Map<string, number>();
  for (const day of Object.values(schedule)) {
    for (const exerciseId of day.exerciseIds) {
      const weightKg = day.exerciseConfig?.[exerciseId]?.weightKg ?? 0;
      if (weightKg > 0) known.set(exerciseId, weightKg);
    }
  }
  return known;
}

function missingWeightsForDay(schedule: Schedule, dayKey: DayKey): string[] {
  const day = schedule[dayKey];
  const known = knownWorkingWeights(schedule);
  return day.exerciseIds.filter((exerciseId, index, all) => {
    if (all.indexOf(exerciseId) !== index || (known.get(exerciseId) ?? 0) > 0) return false;
    const exercise = getExercise(exerciseId);
    if (!exercise) return false;
    const reps = day.exerciseConfig?.[exerciseId]?.reps ?? day.reps ?? exercise.reps;
    const tracking = trackingModeFor(exercise, reps);
    return requiresWorkingWeight({ tracking }, exercise.equipment);
  });
}

function missingProfileRequirements(
  draft: Partial<Profile>,
  selectedDays: DayKey[],
): SetupRequirement[] {
  const missing: SetupRequirement[] = [];
  if (!draft.goal) missing.push("GOAL");
  const hasValidDays =
    draft.trainingDays !== undefined ? selectedDays.length >= 3 : draft.daysPerWeek !== undefined;
  if (!hasValidDays) missing.push("TRAINING_DAYS");
  if (!draft.equipment) missing.push("EQUIPMENT");
  if (!draft.experience) missing.push("EXPERIENCE");
  if (!draft.exercisesPerSession && !draft.sessionMinutes) missing.push("SESSION");
  return missing;
}

function requirementLabel(requirement: SetupRequirement): string {
  const labels: Record<SetupRequirement, string> = {
    GOAL: "your goal",
    TRAINING_DAYS: "your training days",
    EQUIPMENT: "your equipment",
    EXPERIENCE: "your experience",
    SESSION: "your session style",
    WORKOUT: "at least one exercise",
    STARTING_WEIGHTS: "your starting weights",
  };
  return labels[requirement];
}

/**
 * Derives the live onboarding read-back from answers already supplied.
 *
 * It is intentionally deterministic: no system clock, storage or network state
 * is read, so the same setup answers always animate toward the same blueprint.
 */
export function deriveLiveSetupBlueprint(
  draft: Partial<Profile>,
  options: SetupBlueprintOptions = {},
): LiveSetupBlueprint {
  const mode = options.mode ?? "GENERATE";
  const selectedDays = uniqueTrainingDays(draft.trainingDays);
  const profile = profileForPreview(draft, selectedDays);
  // BUILD is editable, not empty. A safe scaffold guarantees that completing
  // onboarding always produces a first workout.
  const schedule = options.schedule ?? defaultSchedule(profile);
  const week: SetupBlueprintDay[] = WEEK.map((dayKey) => {
    const plan = schedule[dayKey];
    const exerciseCount = plan.exerciseIds.length;
    const reservedCustomDay = mode === "BUILD" && selectedDays.includes(dayKey);
    const isTraining = exerciseCount > 0 || reservedCustomDay;
    return {
      dayKey,
      dayLabel: DAY_FULL[dayKey],
      label: exerciseCount ? plan.label : reservedCustomDay ? "ADD WORKOUT" : "REST",
      shortLabel: exerciseCount
        ? shortWorkoutLabel(plan.label)
        : reservedCustomDay
          ? "BUILD"
          : "REST",
      exerciseCount,
      isTraining,
    };
  });
  const trainingDays = week.filter((day) => day.isTraining);
  const priorityMuscles = MUSCLES.filter((muscle) => draft.focusMuscles?.includes(muscle));
  const priority = priorityCopy(priorityMuscles);
  const covered = new Set<FocusMuscle>();
  for (const day of Object.values(schedule)) {
    for (const exerciseId of day.exerciseIds) {
      const muscle = getExercise(exerciseId)?.muscleGroup;
      if (muscle) covered.add(muscle);
    }
  }
  const coveredMuscles = MUSCLES.filter((muscle) => covered.has(muscle));
  const missingMuscles = MUSCLES.filter((muscle) => !covered.has(muscle));
  const exercisesPerSession = exerciseCountFor(draft);
  const sessionMinutes = sessionMinutesFor(draft, exercisesPerSession);
  const longestRun = longestTrainingRun(week);
  const recovery = recoveryFor(draft, trainingDays.length, longestRun);

  const first = trainingDays[0] ?? null;
  const missingRequirements = missingProfileRequirements(draft, selectedDays);
  if (!first || first.exerciseCount === 0) missingRequirements.push("WORKOUT");
  const missingWeightCount = first ? missingWeightsForDay(schedule, first.dayKey).length : 0;
  if (first && missingWeightCount > 0) missingRequirements.push("STARTING_WEIGHTS");

  let firstWorkout: SetupBlueprintFirstWorkout;
  if (missingRequirements.some((item) => !["WORKOUT", "STARTING_WEIGHTS"].includes(item))) {
    const nextRequirement = missingRequirements.find(
      (item) => item !== "WORKOUT" && item !== "STARTING_WEIGHTS",
    )!;
    firstWorkout = {
      ready: false,
      status: "BUILDING",
      dayKey: first?.dayKey ?? null,
      dayLabel: first?.dayLabel ?? null,
      workoutLabel: first?.shortLabel ?? null,
      exerciseCount: first?.exerciseCount ?? 0,
      missingWeightCount,
      missingRequirements,
      message: `Choose ${requirementLabel(nextRequirement)} to keep building your first workout.`,
    };
  } else if (!first || first.exerciseCount === 0) {
    firstWorkout = {
      ready: false,
      status: "ADD_WORKOUT",
      dayKey: first?.dayKey ?? null,
      dayLabel: first?.dayLabel ?? null,
      workoutLabel: first?.shortLabel ?? null,
      exerciseCount: 0,
      missingWeightCount: 0,
      missingRequirements,
      message: first
        ? `${first.dayLabel} is reserved. Add exercises to make that workout real.`
        : "Add at least one exercise to make your first workout real.",
    };
  } else if (missingWeightCount > 0) {
    firstWorkout = {
      ready: false,
      status: "SET_WEIGHTS",
      dayKey: first.dayKey,
      dayLabel: first.dayLabel,
      workoutLabel: first.shortLabel,
      exerciseCount: first.exerciseCount,
      missingWeightCount,
      missingRequirements,
      message: `Set ${missingWeightCount} starting ${missingWeightCount === 1 ? "weight" : "weights"} to finish ${first.dayLabel}.`,
    };
  } else {
    firstWorkout = {
      ready: true,
      status: "READY",
      dayKey: first.dayKey,
      dayLabel: first.dayLabel,
      workoutLabel: first.shortLabel,
      exerciseCount: first.exerciseCount,
      missingWeightCount: 0,
      missingRequirements,
      message: `${first.dayLabel} is ready: ${first.shortLabel} · ${first.exerciseCount} exercises.`,
    };
  }

  return {
    splitName: splitNameFor(mode, trainingDays.length),
    splitDetail: trainingDays.length
      ? `${trainingDays.length} days · ${describeDays(trainingDays.map((day) => day.dayKey))}`
      : "No training days configured yet",
    isProvisional:
      (draft.trainingDays !== undefined ? selectedDays.length < 3 : draft.daysPerWeek == null) ||
      (mode === "BUILD" && firstWorkout.status === "ADD_WORKOUT"),
    week,
    priorityMuscles,
    priorityLabel: priority.label,
    priorityDetail: priority.detail,
    coveredMuscles,
    missingMuscles,
    sessionMinutes,
    exercisesPerSession,
    sessionLabel: `${sessionMinutes}-MINUTE SESSIONS`,
    sessionDetail:
      firstWorkout.status === "SET_WEIGHTS"
        ? `${exercisesPerSession} movements per workout · starting loads are the next setup step.`
        : `${exercisesPerSession} movements per workout · targets are confirmed before you train.`,
    recovery,
    firstWorkout,
  };
}
