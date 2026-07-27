// Single source of truth for the Free vs Pro comparison — used by the
// upgrade page, the onboarding pro step, and any promo surface.
export const COMPARE_ROWS: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: "Workout logging", free: true, pro: true },
  { label: "Basic programs", free: true, pro: true },
  { label: "Social feed & kudos", free: true, pro: true },
  { label: "Challenges (basic)", free: true, pro: true },
  { label: "Custom split builder", free: "1 program", pro: "Unlimited" },
  { label: "Training Autopilot load prescriptions", free: false, pro: true },
  { label: "Automatic stall resets and deloads", free: false, pro: true },
  { label: "One-tap plan load updates", free: false, pro: true },
  { label: "Weekly plan audit + auto-balance", free: false, pro: true },
  { label: "Per-exercise progression rules", free: false, pro: true },
  { label: "Per-exercise rest timers", free: false, pro: true },
  { label: "RIR and tempo prescriptions", free: false, pro: true },
  { label: "Private workout cues", free: false, pro: true },
  { label: "Smart same-muscle exercise swaps", free: false, pro: true },
  { label: "Streak Armor", free: false, pro: true },
  { label: "Volume Optimizer (MEV/MAV/MRV)", free: false, pro: true },
  { label: "Plateau Breaker", free: false, pro: true },
  { label: "Strength trajectory + PR projections", free: false, pro: true },
  { label: "Muscle balance & injury-risk score", free: false, pro: true },
  { label: "Progression intelligence + Ghost Mode", free: false, pro: true },
  { label: "Weekly report card", free: false, pro: true },
  { label: "Advanced analytics", free: false, pro: true },
  { label: "Strength standards & rep maxes", free: false, pro: true },
  { label: "Muscle recovery tracking", free: false, pro: true },
  { label: "Advanced nutrition & macros", free: false, pro: true },
  { label: "Progress photo comparison", free: false, pro: true },
  { label: "Elite challenges & badges", free: false, pro: true },
  { label: "H2H Challenges", free: false, pro: true },
  { label: "Full rank ladder", free: true, pro: true },
  { label: "Featured programs", free: false, pro: true },
];

/** The shortlist shown on compact surfaces (onboarding, promos). */
export const PRO_HIGHLIGHTS = COMPARE_ROWS.filter((r) => r.free !== true).slice(0, 8);
