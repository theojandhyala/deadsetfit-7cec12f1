// Smart, frequency-capped "Go Pro" nudges.
// Fires at genuine high-intent moments (a fresh PR, a weekly check-in) but a
// single shared cap keeps it persistent without being spammy. Suppressed
// entirely on native iOS (App Store 3.1.1 — no external-purchase prompts).
import { isNativeIos } from "./platform";

const NUDGE_AT_KEY = "deadset_upgrade_nudge_at";
const MIN_INTERVAL_MS = 20 * 3_600_000; // ~once per day at most

export type NudgeTrigger = "pr" | "weekly" | "feature";

export interface NudgePayload {
  trigger: NudgeTrigger;
  title: string;
  message: string;
}

const COPY: Record<NudgeTrigger, { title: string; message: string }> = {
  pr: {
    title: "You're getting strong",
    message:
      "Pro's Strength Trajectory projects the exact date you'll hit your next milestone — and Plateau Breaker keeps the PRs coming when you stall.",
  },
  weekly: {
    title: "Train smarter this week",
    message:
      "Your Volume Optimizer, plateau alerts and muscle-balance score are one tap away — the science-based coaching other apps lock behind a subscription.",
  },
  feature: {
    title: "That's a Pro feature",
    message:
      "Unlock the full DEADSET arsenal — the intelligence engine, Streak Armor, leagues and more.",
  },
};

function canShow(now: number): boolean {
  if (isNativeIos()) return false;
  try {
    const last = Number(localStorage.getItem(NUDGE_AT_KEY) || "0");
    return now - last >= MIN_INTERVAL_MS;
  } catch {
    return true;
  }
}

function stamp(now: number) {
  try {
    localStorage.setItem(NUDGE_AT_KEY, String(now));
  } catch {
    /* ignore */
  }
}

/**
 * Try to fire an upgrade nudge. Honours the frequency cap + iOS suppression.
 * The listener (UpgradeNudge) is the final guard for Pro status.
 * Returns whether a nudge was dispatched.
 */
export function maybeNudge(trigger: NudgeTrigger, now = Date.now()): boolean {
  if (!canShow(now)) return false;
  stamp(now);
  window.dispatchEvent(
    new CustomEvent<NudgePayload>("deadset:upgrade-nudge", {
      detail: { trigger, ...COPY[trigger] },
    }),
  );
  return true;
}
