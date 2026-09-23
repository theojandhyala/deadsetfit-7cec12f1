export type OnboardingMode = "GENERATE" | "BUILD";

export type OnboardingActiveStep =
  | "mode"
  | "goal"
  | "about"
  | "days"
  | "equipment"
  | "preferences"
  | "schedule"
  | "notifications"
  | "username"
  | "blueprint";

/** One decision at a time, followed by a real read-back of what will be saved. */
export function onboardingOrder(mode: OnboardingMode | null): OnboardingActiveStep[] {
  if (!mode) return ["mode"];
  const shared: OnboardingActiveStep[] = [
    "mode",
    "goal",
    "about",
    "days",
    "equipment",
    "preferences",
  ];
  return [...shared, "schedule", "notifications", "username", "blueprint"];
}

export function onboardingStageLabel(step: OnboardingActiveStep): string {
  if (step === "mode") return "START";
  if (["goal", "about"].includes(step)) return "YOU";
  if (["days", "equipment", "preferences"].includes(step)) return "TRAINING";
  if (step === "schedule") return "YOUR WEEK";
  if (step === "notifications") return "STAY ON TRACK";
  if (step === "username") return "IDENTITY";
  return "READY";
}

/** Editing a plan input must pass through the real schedule review again. */
export function onboardingReviewDestination(
  step: OnboardingActiveStep,
  scheduleNeedsReview: boolean,
): "schedule" | "blueprint" {
  return step !== "schedule" && scheduleNeedsReview ? "schedule" : "blueprint";
}

export const SETUP_CHAPTERS = ["YOU", "YOUR PLAN", "READY"] as const;

export function onboardingChapter(step: OnboardingActiveStep): number {
  if (["mode", "goal", "about"].includes(step)) return 0;
  if (["days", "equipment", "preferences", "schedule"].includes(step)) return 1;
  return 2;
}
