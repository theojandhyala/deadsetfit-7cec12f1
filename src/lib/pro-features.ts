// Single source of truth for the Free vs Pro comparison — used by the
// upgrade page, the onboarding pro step, and any promo surface.

/**
 * The one feature the pitch leads with.
 *
 * Streak Armor is the pick because it protects something the lifter has already
 * built rather than asking them to imagine a benefit, and because its value
 * grows the longer they use the app for free — which makes the free tier the
 * funnel rather than a leak.
 */
export const PRO_HERO = {
  label: "Streak Armor",
  headline: "One bad day shouldn't cost you the streak",
  detail:
    "Three shields a month. Miss a day and a shield quietly covers it, so the streak you spent weeks building survives a work trip, an illness, or a night that got away from you.",
};

export const COMPARE_ROWS: { label: string; free: boolean | string; pro: boolean | string }[] = [
  // The hero leads the table as well as the headline.
  { label: "Streak Armor", free: false, pro: "3 shields / month" },

  // Free. Everything social or competitive lives here deliberately: these
  // features need two people, so charging for them broke the feature for the
  // person who paid and throttled the friend-invites-friend loop.
  { label: "Workout logging", free: true, pro: true },
  { label: "Basic programs", free: true, pro: true },
  { label: "Social feed & kudos", free: true, pro: true },
  { label: "Challenges", free: true, pro: true },
  { label: "Head-to-head duels", free: true, pro: true },
  { label: "Full league ladder & leaderboards", free: true, pro: true },

  // Paid. Single-player depth, where locking costs no network effects, plus
  // Elite badges — status goods rather than shared features.
  { label: "Custom split builder", free: "1 program", pro: "Unlimited" },
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
  { label: "Featured programs", free: false, pro: true },
];

/** The shortlist shown on compact surfaces (onboarding, promos). */
export const PRO_HIGHLIGHTS = COMPARE_ROWS.filter((r) => r.free !== true).slice(0, 8);
