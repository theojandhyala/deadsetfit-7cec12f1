export type Goal = "BULK" | "CUT" | "MAINTAIN" | "ATHLETIC";
export type Experience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type Equipment = "FULL_GYM" | "HOME_GYM" | "BODYWEIGHT";
export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface Profile {
  goal: Goal;
  experience: Experience;
  age: number;
  weightKg: number;
  heightCm: number;
  gender: Gender;
  daysPerWeek: 3 | 4 | 5 | 6;
  equipment: Equipment;
  injuries?: string;
}

export type MuscleGroup =
  | "CHEST" | "BACK" | "LEGS" | "SHOULDERS" | "ARMS" | "CORE"
  | "PUSH" | "PULL" | "UPPER" | "LOWER" | "FULL BODY" | "REST";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: "CHEST" | "BACK" | "LEGS" | "SHOULDERS" | "ARMS" | "CORE";
  equipment: Equipment[];
  skill: Experience;
  sets: number;
  reps: string;
  videoId: string;
  instruction: string;
}

export type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface DaySchedule {
  label: string;
  exerciseIds: string[];
}

export type Schedule = Record<DayKey, DaySchedule>;

export type SplitType = "PPL" | "UPPER_LOWER" | "BRO" | "FULL_BODY" | "CUSTOM";

export interface ProgramExerciseRef {
  /** Library exercise UUID */
  id: string;
  name: string;
  equipment: string;
  primary_muscles: string[];
  youtube_query: string;
  sets: number;
  reps: string;
}

export interface ProgramDay {
  label: string;
  items: ProgramExerciseRef[];
}

export interface Program {
  id: string;
  name: string;
  splitType: SplitType;
  days: Record<DayKey, ProgramDay>;
  createdAt: string;
}

export interface SetLog {
  exerciseId: string;
  weight: number;
  reps: number;
  date: string;
}

export interface CheckIn {
  date: string;
  photoDataUrl: string;
}

export interface WeightEntry { date: string; weight: number; }
export interface MeasurementEntry { date: string; chest: number; waist: number; arms: number; legs: number; }

export interface Meal {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface MealPlan {
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
  snack: Meal;
}

export interface FoodLogItem {
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface AppState {
  profile: Profile | null;
  schedule: Schedule | null;
  logs: SetLog[];
  checkIns: CheckIn[];
  weights: WeightEntry[];
  measurements: MeasurementEntry[];
  foodLog: FoodLogItem[];
  mealPlan: MealPlan | null;
  completedDates: string[];
  programs: Program[];
  activeProgramId: string | null;
}
