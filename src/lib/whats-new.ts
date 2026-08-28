// What's-new manifest — bump the version and prepend entries when features
// ship. The card hides once dismissed at the current version, so stale
// announcements never linger.

export const WHATS_NEW_VERSION = 202608288;
export const WHATS_NEW_SEEN_KEY = "deadset_whats_new_seen";

export interface WhatsNewEntry {
  title: string;
  body: string;
  /** Where to see it, as a plain hint — not a link, tabs handle their own nav. */
  where: string;
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    title: "Friend search and nearby now work end to end",
    body: "Find athletes by name or @username, discover lifters in your city and manage sent, incoming, accepted, declined and removed requests with clear recovery when the network drops.",
    where: "Friends",
  },
  {
    title: "Lock Screen alerts you can prove",
    body: "Notification setup now happens in context, shows the real iPhone permission state and includes a five-second test for workout, streak and rival alerts.",
    where: "Setup · Settings",
  },
  {
    title: "Weight and reps stay together",
    body: "The weekly Strength Sync now keeps both fields fully visible side by side without horizontal scrolling, even while the number keyboard is open.",
    where: "Strength",
  },
  {
    title: "A real friends hub and fuller profiles",
    body: "Crew, requests and athlete discovery now have dedicated views, with richer public cards for bios, city, training history, streaks, PRs and Strength Map comparisons.",
    where: "Friends · Profile",
  },
  {
    title: "Your setup now always ends with a plan",
    body: "Both guided and build-your-own setup now review a complete editable week before membership, while the Pro reveal brings your Strength Map and programme to life.",
    where: "Setup · Pro",
  },
  {
    title: "A smoother start every time",
    body: "The new launch experience stays in place until your account, training data and real destination are ready—no blank screen or half-loaded dashboard.",
    where: "App launch",
  },
  {
    title: "Keep every lift and muscle current",
    body: "A guided weekly sync confirms one exercise at a time, updates repeated plan loads together and immediately refreshes the Strength Map from the records you enter.",
    where: "Strength",
  },
  {
    title: "See your weekly set pattern",
    body: "The new square map connects every planned working set to its muscle and day, so gaps and overloaded areas are obvious.",
    where: "Plan · Strength",
  },
  {
    title: "Earn your next weight",
    body: "Muscle Lab now reads completed sets and tells you when to add load or repeat the weight until every target rep is secured.",
    where: "Strength",
  },
  {
    title: "Add friends and compare maps",
    body: "Send and accept friend requests, then compare bodyweight-adjusted muscle scores and PRs side by side.",
    where: "Friends",
  },
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
