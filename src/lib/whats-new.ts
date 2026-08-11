// What's-new manifest — bump the version and prepend entries when features
// ship. The card hides once dismissed at the current version, so stale
// announcements never linger.

export const WHATS_NEW_VERSION = 20260810;
export const WHATS_NEW_SEEN_KEY = "deadset_whats_new_seen";

export interface WhatsNewEntry {
  title: string;
  body: string;
  /** Where to see it, as a plain hint — not a link, tabs handle their own nav. */
  where: string;
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    title: "Your Story",
    body: "Lifetime tonnage in real-world objects, best streak, heaviest set — plus milestone celebrations from 10 t to 1,000 t.",
    where: "Progress",
  },
  {
    title: "Session records",
    body: "Biggest day, most reps, longest session — with a banner when you break one.",
    where: "Progress",
  },
  {
    title: "Your rhythm",
    body: "Which weekday you lift heaviest, and which scheduled day keeps slipping.",
    where: "Progress",
  },
  {
    title: "Calorie cycling",
    body: "Training days eat more, rest days less — same weekly average as your goal.",
    where: "Diet → Insights",
  },
  {
    title: "Protein spread",
    body: "How many meals a day actually carry a muscle-building protein dose.",
    where: "Diet → Insights",
  },
  {
    title: "Fresh stimulus",
    body: "A heads-up when a muscle has lived on one movement too long, with alternatives.",
    where: "Progress",
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
