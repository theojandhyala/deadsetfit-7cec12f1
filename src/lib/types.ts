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
  label: string; // e.g. "PUSH — CHEST / SHOULDERS / TRICEPS" or "REST"
  exerciseIds: string[];
}

export type Schedule = Record<DayKey, DaySchedule>;

export interface SetLog {
  exerciseId: string;
  weight: number;
  reps: number;
  date: string; // ISO
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
  completedDates: string[]; // ISO yyyy-mm-dd days where workout was completed
}
