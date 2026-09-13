export type OnboardingMode = "GENERATE" | "BUILD";

/**
 * One decision per screen.
 *
 * Setup is deliberately gradual: every screen asks for exactly one thing, so
 * nothing ever presents a form. The cost is more screens; the payoff is that
 * each one is a single tap or a single number, the athlete is never staring at
 * four empty fields, and the read-back below the question can react to the
 * answer immediately.
 */
export type OnboardingActiveStep =
  | "welcome"
  | "name"
  | "goal"
  | "why"
  | "gender"
  | "age"
  | "units"
  | "weight"
  | "height"
  | "experience"
  | "days"
  | "equipment"
  | "focus"
  | "session"
  | "sleep"
  | "weakness"
  | "mode"
  | "analyzing"
  | "schedule"
  | "notifications"
  | "username"
  | "blueprint";

/** Named chapters, in the order they are walked. */
export type OnboardingChapter =
  | "START"
  | "YOU"
  | "BODY"
  | "TRAINING"
  | "RECOVERY"
  | "YOUR WEEK"
  | "READY";

export const ONBOARDING_CHAPTERS: OnboardingChapter[] = [
  "START",
  "YOU",
  "BODY",
  "TRAINING",
  "RECOVERY",
  "YOUR WEEK",
  "READY",
];

const CHAPTER_OF: Record<OnboardingActiveStep, OnboardingChapter> = {
  welcome: "START",
  name: "START",
  goal: "YOU",
  why: "YOU",
  gender: "BODY",
  age: "BODY",
  units: "BODY",
  weight: "BODY",
  height: "BODY",
  experience: "TRAINING",
  days: "TRAINING",
  equipment: "TRAINING",
  focus: "TRAINING",
  session: "TRAINING",
  sleep: "RECOVERY",
  weakness: "RECOVERY",
  mode: "YOUR WEEK",
  analyzing: "YOUR WEEK",
  schedule: "YOUR WEEK",
  notifications: "READY",
  username: "READY",
  blueprint: "READY",
};

/**
 * The walk itself.
 *
 * `mode` no longer gates the order — it is asked late, once the athlete has
 * already invested a dozen answers, because "generate it for me or let me
 * build it" is a real decision and it lands far better with their own data
 * already on screen than it does as the very first thing they ever see.
 */
export function onboardingOrder(_mode?: OnboardingMode | null): OnboardingActiveStep[] {
  return [
    "welcome",
    // Asked first so every screen after it can use the athlete's own name.
    "name",
    "goal",
    "why",
    "gender",
    "age",
    // Units comes before anything is weighed. Every weight after this — the
    // athlete's own bodyweight, every load, every strength grade computed
    // against that bodyweight — is meaningless until the number has a unit
    // attached, and a pound athlete typing 180 into a kilogram field corrupts
    // the grade of every muscle they own.
    "units",
    "weight",
    "height",
    "experience",
    "days",
    "equipment",
    "focus",
    "session",
    "sleep",
    "weakness",
    "mode",
    "analyzing",
    "schedule",
    "notifications",
    "username",
    "blueprint",
  ];
}

export function onboardingStageLabel(step: OnboardingActiveStep): OnboardingChapter {
  return CHAPTER_OF[step] ?? "START";
}

/** Index of a step's chapter, for the chapter rail in the header. */
export function onboardingChapterIndex(step: OnboardingActiveStep): number {
  return ONBOARDING_CHAPTERS.indexOf(onboardingStageLabel(step));
}

/**
 * Progress as a fraction of the whole walk.
 *
 * The welcome screen reads 0% and the last screen reads 100%, so the bar never
 * opens part-full (which reads as "you already missed something") and never
 * stops short of the end on the screen that says you are ready.
 */
export function onboardingProgress(step: OnboardingActiveStep): number {
  const order = onboardingOrder();
  const at = order.indexOf(step);
  if (at <= 0) return 0;
  return Math.round((at / (order.length - 1)) * 100);
}

/**
 * Steps that resolve on a single tap and advance themselves.
 *
 * Screens that need a typed value, a multi-select or a review keep an explicit
 * Continue button; these do not, and waiting for a second tap on them is what
 * makes a gradual flow feel slow.
 */
export function onboardingAutoAdvances(step: OnboardingActiveStep): boolean {
  return [
    "goal",
    "why",
    "gender",
    "equipment",
    "session",
    "sleep",
    "weakness",
    "experience",
  ].includes(step);
}
