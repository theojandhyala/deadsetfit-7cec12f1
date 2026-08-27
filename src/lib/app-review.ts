import { Capacitor, registerPlugin } from "@capacitor/core";

type ReviewPlugin = {
  request(): Promise<void>;
  open(): Promise<void>;
};

const NativeReview = registerPlugin<ReviewPlugin>("DeadSetReview");

export const APP_STORE_REVIEW_URL =
  "https://apps.apple.com/app/deadset/id6783511541?action=write-review";

export const REVIEW_MILESTONES = [3, 10, 25] as const;
export const REVIEW_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export function reviewMilestoneFor(finished: number, attemptedMilestones: number[]) {
  const milestone = REVIEW_MILESTONES.filter((candidate) => finished >= candidate).at(-1) ?? null;
  return milestone && !attemptedMilestones.includes(milestone) ? milestone : null;
}

export function shouldRequestAppReview({
  finished,
  latestEndedAt,
  attemptedMilestones,
  lastAttemptAt,
  now = Date.now(),
}: {
  finished: number;
  latestEndedAt: string | null;
  attemptedMilestones: number[];
  lastAttemptAt?: string;
  now?: number;
}) {
  const milestone = reviewMilestoneFor(finished, attemptedMilestones);
  if (!milestone || !latestEndedAt) return null;

  const endedAt = Date.parse(latestEndedAt);
  if (!Number.isFinite(endedAt)) return null;

  // Hydrating an established account must not look like a newly completed
  // workout. Only ask while the success moment is still fresh.
  const age = now - endedAt;
  if (age < 0 || age > 10 * 60 * 1000) return null;

  if (lastAttemptAt) {
    const lastAttempt = Date.parse(lastAttemptAt);
    if (Number.isFinite(lastAttempt) && now - lastAttempt < REVIEW_COOLDOWN_MS) return null;
  }
  return milestone;
}

export async function requestAppReview() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return false;
  await NativeReview.request();
  return true;
}

export async function openAppStoreReviewPage() {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
    await NativeReview.open();
    return;
  }
  window.open(APP_STORE_REVIEW_URL, "_blank", "noopener,noreferrer");
}
