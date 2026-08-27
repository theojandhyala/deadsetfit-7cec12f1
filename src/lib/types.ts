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
  /**
   * The actual weekdays the lifter trains. When absent the schedule falls back
   * to a Mon-first spread of `daysPerWeek`, which is how older profiles behave.
   */
  trainingDays?: DayKey[];
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
  /** Preferred number of movements in each scheduled workout. */
  exercisesPerSession?: 3 | 4 | 5 | 6 | 7 | 8;
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
  /** Search query used when a fixed demonstration video is not bundled. */
  youtubeQuery?: string;
  /** Specific equipment label used by the full exercise database. */
  equipmentLabel?: string;
  secondaryMuscles?: string[];
  proTip?: string;
  isCompound?: boolean;
  isCustom?: boolean;
  /**
   * How the movement is measured. Omitted means load x reps, which is also
   * what `trackingModeFor` infers for anything that isn't a hold or cardio.
   */
  tracking?: "WEIGHT" | "DURATION" | "DISTANCE";
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
  /** Exercise-specific rest interval used by the live workout timer. */
  restSeconds?: number;
  /** Target reps in reserve for working sets. */
  targetRir?: number;
  /** Progression rule shown during training and used to frame load decisions. */
  progression?: "DOUBLE" | "LINEAR" | "HOLD";
  /** Optional lifting tempo, for example 3-1-1. */
  tempo?: string;
  /** Private coaching cue shown during the live workout. */
  note?: string;
  /** Runs this exercise directly into the next movement before resting. */
  supersetWithNext?: boolean;
  /** Weight of the bar this movement is loaded on, in kg. Defaults to 20. */
  barKg?: number;
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
  meal?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  serving?: string;
  source?: "manual" | "barcode" | "search" | "quick";
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
  /**
   * Warm-up sets are excluded from volume and PRs. Drop sets and sets taken to
   * failure both count as volume but never set a record: the load was not the
   * limiting factor in either.
   */
  kind?: "warmup" | "drop" | "failure";
  /**
   * Set to measure this effort in time or distance instead of reps. Such sets
   * always store `reps: 0`, so every load x reps volume and PR calculation in
   * the app contributes nothing for them without needing to know they exist.
   */
  mode?: "duration" | "distance";
  /** Time under tension for a hold, or elapsed time for a distance effort. */
  seconds?: number;
  /** Distance covered, in metres. */
  meters?: number;
}

export interface WorkoutSessionExercise {
  exerciseId: string;
  name: string;
  primary_muscles: string[];
  targetSets: number;
  targetReps: string;
  /** Working weight allocated in the schedule, if any */
  plannedWeightKg?: number;
  restSeconds?: number;
  targetRir?: number;
  progression?: ExercisePlan["progression"];
  tempo?: string;
  note?: string;
  /** Stable within a session; exercises sharing an id are performed as one round. */
  supersetId?: string;
  /** How this movement is logged. Resolved once when the session is built. */
  tracking?: "WEIGHT" | "DURATION" | "DISTANCE";
  /** Target hold or effort length in seconds, for time-based movements. */
  targetSeconds?: number;
  /** Added mid-session rather than planned, so the plan can offer to keep it. */
  addedLive?: boolean;
  /** Bar this movement is loaded on, in kg, driving plate and warm-up maths. */
  barKg?: number;
  sets: CompletedSet[];
}

/** How the session felt, worst to best. */
export type SessionFeel = 1 | 2 | 3 | 4 | 5;

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
  /** Set only after the athlete confirms every load-based exercise before set one. */
  weightSetupConfirmedAt?: string;
  /** Post-session reflection: how it went, in the athlete's own words. */
  note?: string;
  /** Post-session rating, used to spot when training is drifting. */
  feel?: SessionFeel;
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

export interface StrengthGoal {
  exerciseId: string;
  /** Target estimated one-rep max in kilograms. */
  targetKg: number;
  createdAt: string;
}

export interface AppState {
  profile: Profile | null;
  schedule: Schedule | null;
  /** Full-library and custom exercises saved for plans and offline workouts. */
  savedExercises: Exercise[];
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
  /** Opt-in iOS notifications sent on scheduled training days. */
  deviceRemindersEnabled?: boolean;
  workoutReminderHour?: number;
  workoutReminderMinute?: number;
  /** Auto rest-timer duration after each logged set (seconds); 0 = off. Default 90. */
  restTimerSeconds?: number;
  /** Native haptics on set logs, PRs, rest and milestones. Default on. */
  hapticsEnabled?: boolean;
  /** Evening warning when an unlogged day would end the streak. Default on. */
  streakAlertsEnabled?: boolean;
  /** Local hour (0-23) the streak warning fires. Default 19. */
  streakAlertHour?: number;
  /** Nudges when a duel rival is ahead or a duel is running out. Default on. */
  rivalAlertsEnabled?: boolean;
  /** Auto-post finished workouts to the social feed. Explicit opt-in only. */
  autoShareWorkouts?: boolean;
  streakArmor?: StreakArmor;
  healthSync?: HealthSync;
  trainingAutopilot?: {
    enabled: boolean;
    strategy: "BALANCED" | "STRENGTH" | "HYPERTROPHY";
    lastAppliedAt?: string;
  };
  /** Pro PR Roadmap targets, derived from the athlete's logged lift history. */
  strengthGoals?: StrengthGoal[];
  /** Where this user came from, captured on their first visit (referrer/UTM). */
  signupSource?: {
    source: string;
    referrer?: string;
    landing?: string;
    capturedAt: string;
  };
}
