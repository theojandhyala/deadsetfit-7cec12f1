export type OnboardingMode = "GENERATE" | "BUILD";

export type OnboardingActiveStep =
  | "mode"
  | "goal"
  | "units"
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
    // Units comes before anything is weighed. Every weight after this — the
    // athlete's own bodyweight, every load, every strength grade computed
    // against that bodyweight — is meaningless until the number has a unit
    // attached, and a pound athlete typing 180 into a kilogram field corrupts
    // the grade of every muscle they own.
    "units",
    "about",
    "days",
    "equipment",
    "preferences",
  ];
  return [...shared, "schedule", "notifications", "username", "blueprint"];
}

export function onboardingStageLabel(step: OnboardingActiveStep): string {
  if (step === "mode") return "START";
  if (["goal", "units", "about"].includes(step)) return "YOU";
  if (["days", "equipment", "preferences"].includes(step)) return "TRAINING";
  if (step === "schedule") return "YOUR WEEK";
  if (step === "notifications") return "STAY ON TRACK";
  if (step === "username") return "IDENTITY";
  return "READY";
}
