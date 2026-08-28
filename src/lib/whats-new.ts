// What's-new manifest — bump the version and prepend entries when features
// ship. The card hides once dismissed at the current version, so stale
// announcements never linger.

export const WHATS_NEW_VERSION = 20260828;
export const WHATS_NEW_SEEN_KEY = "deadset_whats_new_seen";

export interface WhatsNewEntry {
  title: string;
  body: string;
  /** Where to see it, as a plain hint — not a link, tabs handle their own nav. */
  where: string;
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    title: "Build the muscle you choose",
    body: "Pick a development target, see its volume and recovery, then add matched exercises straight into your week.",
    where: "Strength",
  },
  {
    title: "A smarter Strength Map",
    body: "See every trained area, find grey coverage gaps and understand which real logged lifts move each muscle grade.",
    where: "Strength",
  },
  {
    title: "A clearer training day",
    body: "See the next workout, food, recovery and first steps without mixing them into analytics.",
    where: "Train",
  },
  {
    title: "Build your whole week",
    body: "Choose training days, exercises, sets and rep targets, then edit any day whenever plans change.",
    where: "Plan",
  },
  {
    title: "Smarter live workouts",
    body: "Swap an unavailable exercise, use supersets and keep targets and history visible while logging.",
    where: "Workout",
  },
  {
    title: "Apple Fitness and Pro sync",
    body: "Bring in Watch activity, send finished sessions to Apple Fitness and restore Pro across devices.",
    where: "Settings",
  },
];

export function readWhatsNewSeen(): number {
  try {
    return Number(localStorage.getItem(WHATS_NEW_SEEN_KEY) || "0");
  } catch {
    return 0;
  }
}

export function dismissWhatsNew(): void {
  try {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, String(WHATS_NEW_VERSION));
  } catch {
    /* ignore */
  }
}
