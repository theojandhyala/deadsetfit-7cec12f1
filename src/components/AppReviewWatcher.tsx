import { useEffect, useMemo, useRef, useState } from "react";

import { requestAppReview, shouldRequestAppReview } from "@/lib/app-review";
import { useAppState } from "@/lib/storage";

const REVIEW_STATE_KEY = "deadset_native_review_state_v2";
const LEGACY_REQUESTED_KEY = "deadset_native_review_requested_v1";

type StoredReviewState = {
  attemptedMilestones: number[];
  lastAttemptAt?: string;
};

function readReviewState(): StoredReviewState {
  try {
    const stored = localStorage.getItem(REVIEW_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<StoredReviewState>;
      return {
        attemptedMilestones: Array.isArray(parsed.attemptedMilestones)
          ? parsed.attemptedMilestones.filter((value): value is number => Number.isFinite(value))
          : [],
        lastAttemptAt: parsed.lastAttemptAt,
      };
    }
    return {
      attemptedMilestones: localStorage.getItem(LEGACY_REQUESTED_KEY) === "1" ? [3] : [],
    };
  } catch {
    return { attemptedMilestones: [] };
  }
}

function markAttempted(milestone: number) {
  try {
    const current = readReviewState();
    localStorage.setItem(
      REVIEW_STATE_KEY,
      JSON.stringify({
        attemptedMilestones: Array.from(new Set([...current.attemptedMilestones, milestone])).sort(
          (a, b) => a - b,
        ),
        lastAttemptAt: new Date().toISOString(),
      } satisfies StoredReviewState),
    );
  } catch {
    /* StoreKit still prevents repeated system prompts. */
  }
}

export function AppReviewWatcher() {
  const [state] = useAppState();
  const [foregroundCheck, setForegroundCheck] = useState(0);
  const finishedSessions = useMemo(
    () => state.sessions.filter((session) => !!session.endedAt),
    [state.sessions],
  );
  const latestEndedAt = useMemo(
    () =>
      finishedSessions.reduce<string | null>((latest, session) => {
        if (!session.endedAt) return latest;
        if (!latest || Date.parse(session.endedAt) > Date.parse(latest)) return session.endedAt;
        return latest;
      }, null),
    [finishedSessions],
  );
  const requestInFlight = useRef(false);

  useEffect(() => {
    const checkAgain = () => {
      if (document.visibilityState === "visible") setForegroundCheck((value) => value + 1);
    };
    window.addEventListener("focus", checkAgain);
    document.addEventListener("visibilitychange", checkAgain);
    return () => {
      window.removeEventListener("focus", checkAgain);
      document.removeEventListener("visibilitychange", checkAgain);
    };
  }, []);

  useEffect(() => {
    const reviewState = readReviewState();
    const milestone = shouldRequestAppReview({
      finished: finishedSessions.length,
      latestEndedAt,
      attemptedMilestones: reviewState.attemptedMilestones,
      lastAttemptAt: reviewState.lastAttemptAt,
    });
    if (!milestone || requestInFlight.current) return;

    requestInFlight.current = true;
    const timer = window.setTimeout(() => {
      void requestAppReview()
        .then((requested) => {
          if (requested) markAttempted(milestone);
        })
        .catch((error) => console.warn("App Store review request failed", error))
        .finally(() => {
          requestInFlight.current = false;
        });
    }, 3000);
    return () => {
      window.clearTimeout(timer);
      requestInFlight.current = false;
    };
  }, [finishedSessions.length, foregroundCheck, latestEndedAt]);

  return null;
}
