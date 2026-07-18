// Single source of truth for the Free vs Pro comparison — used by the
// upgrade page, the onboarding pro step, and any promo surface.
export const COMPARE_ROWS: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: "Workout logging", free: true, pro: true },
  { label: "Basic programs", free: true, pro: true },
  { label: "Social feed & kudos", free: true, pro: true },
  { label: "Challenges (basic)", free: true, pro: true },
  { label: "Custom split builder", free: "1 program", pro: "Unlimited" },
  { label: "Streak Armor", free: false, pro: true },
  { label: "Progression intelligence + Ghost Mode", free: false, pro: true },
  { label: "Weekly report card", free: false, pro: true },
  { label: "Advanced analytics", free: false, pro: true },
  { label: "Strength standards & rep maxes", free: false, pro: true },
  { label: "Muscle recovery tracking", free: false, pro: true },
  { label: "Advanced nutrition & macros", free: false, pro: true },
  { label: "Progress photo comparison", free: false, pro: true },
  { label: "Elite challenges & badges", free: false, pro: true },
  { label: "H2H Challenges", free: false, pro: true },
  { label: "Full Weekly Leagues", free: false, pro: true },
  { label: "Featured programs", free: false, pro: true },
];

/** The shortlist shown on compact surfaces (onboarding, promos). */
export const PRO_HIGHLIGHTS = COMPARE_ROWS.filter((r) => r.free !== true).slice(0, 8);
