export type Goal = "BULK" | "CUT" | "MAINTAIN" | "ATHLETIC";
export type Experience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type Equipment = "FULL_GYM" | "HOME_GYM" | "BODYWEIGHT";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type Weakness = "STRENGTH" | "CONSISTENCY" | "DIET" | "RECOVERY";

export type FocusMuscle = "CHEST" | "BACK" | "SHOULDERS" | "ARMS" | "LEGS" | "CORE";

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
  weakness?: Weakness;
  username?: string;
  /** Real/display name shown on the athlete card (distinct from @username) */
  displayName?: string;
  avatarDataUrl?: string;
  startingWeightKg?: number;
  /** Up to two muscle groups the lifter wants to prioritise */
  focusMuscles?: FocusMuscle[];
  /** Preferred session length — shapes how many exercises per day */
  sessionMinutes?: 30 | 45 | 60 | 90;
  /** Bodyweight goal, used for journey framing */
  targetWeightKg?: number;
  /** Onboarding depth — the "why" that drives them (motivation) */
  motivation?: string;
  /** Sleep quality band — informs recovery framing */
  sleepQuality?: "LOW" | "OK" | "GOOD" | "GREAT";
  /** The outcome they're chasing (their 12-week vision) */
  dreamOutcome?: string;
  /** Commitment: the target date they locked in (ISO yyyy-mm-dd) */
  commitmentDate?: string;
  /** Whether they completed the lock-in pledge */
  committed?: boolean;
}

export type MuscleGroup =
  | "CHEST"
  | "BACK"
  | "LEGS"
  | "SHOULDERS"
  | "ARMS"
  | "CORE"
  | "PUSH"
  | "PULL"
  | "UPPER"
  | "LOWER"
  | "FULL BODY"
  | "REST";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: "CHEST" | "BACK" | "LEGS" | "SHOULDERS" | "ARMS" | "CORE";
  equipment: Equipment[];
  skill: Experience;
  sets: number;
  reps: string;
  videoId: string;
  /** Start time in seconds for action clip (defaults to 5) */
  clipStart?: number;
  /** End time in seconds for action clip (defaults to clipStart + 6) */
  clipEnd?: number;
  instruction: string;
}

export type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface ExercisePlan {
  sets?: number;
  reps?: string;
  weightKg?: number;
}

export interface DaySchedule {
  label: string;
  exerciseIds: string[];
  sets?: number;
  reps?: string;
  /** Per-exercise allocation (sets / reps / working weight) overriding day defaults */
  exerciseConfig?: Record<string, ExercisePlan>;
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

export interface WeightEntry {
  date: string;
  weight: number;
}
export interface MeasurementEntry {
  date: string;
  chest: number;
  waist: number;
  arms: number;
  legs: number;
}

export interface FoodLogItem {
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  source?: "manual" | "barcode";
}

export interface WaterEntry {
  date: string;
  ml: number;
  at: string;
}

export interface CompletedSet {
  weight: number;
  reps: number;
  rpe?: number;
  isPR?: boolean;
  isAmrap?: boolean;
  /** Warm-up sets are excluded from volume and PRs; drop sets count as volume but never PR. */
  kind?: "warmup" | "drop";
}

export interface WorkoutSessionExercise {
  exerciseId: string;
  name: string;
  primary_muscles: string[];
  targetSets: number;
  targetReps: string;
  /** Working weight allocated in the schedule, if any */
  plannedWeightKg?: number;
  sets: CompletedSet[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  dayKey: DayKey;
  label: string;
  programId: string | null;
  startedAt: string;
  endedAt?: string;
  exercises: WorkoutSessionExercise[];
  totalVolume: number;
  prCount: number;
}

export interface ChallengeRecord {
  challengeId: string;
  value: number; // seconds for time-based, reps for rep-based
  date: string;
}

export interface HealthSync {
  /** Master switch — user connected Apple Health */
  enabled: boolean;
  /** Pull watch/Health workouts in as training days */
  importWorkouts: boolean;
  /** Push finished DEADSET sessions to Health (rings/watch) */
  exportWorkouts: boolean;
  lastImportIso?: string;
}

export interface StreakArmor {
  /** Shields remaining this month */
  shields: number;
  /** "YYYY-MM" of the last monthly refill */
  lastRefillMonth: string;
  /** ISO days that were saved by a shield */
  usedDates: string[];
}

export interface AppState {
  profile: Profile | null;
  schedule: Schedule | null;
  logs: SetLog[];
  checkIns: CheckIn[];
  weights: WeightEntry[];
  measurements: MeasurementEntry[];
  foodLog: FoodLogItem[];
  completedDates: string[];
  programs: Program[];
  activeProgramId: string | null;
  sessions: WorkoutSession[];
  activeSessionId: string | null;
  water: WaterEntry[];
  waterTargetMl: number;
  hydrationAlertsEnabled: boolean;
  challengeRecords?: ChallengeRecord[];
  manualPRs?: Record<string, { value: number; reps?: number; date: string }>;
  units?: "kg" | "lb";
  remindersEnabled?: boolean;
  /** Auto rest-timer duration after each logged set (seconds); 0 = off. Default 90. */
  restTimerSeconds?: number;
  /** Auto-post finished workouts to the social feed. Default on (undefined = on). */
  autoShareWorkouts?: boolean;
  streakArmor?: StreakArmor;
  healthSync?: HealthSync;
  /** Where this user came from, captured on their first visit (referrer/UTM). */
  signupSource?: {
    source: string;
    referrer?: string;
    landing?: string;
    capturedAt: string;
  };
}
