import { getState, setState } from "./storage";
import { attributionFromUrl, isCampaignTouch, type AttributionTouch } from "./attribution-values";

const KEY = "deadset_attribution_v1";
const LAST_KEY = "deadset_attribution_last_v1";

function storedTouch(key: string): AttributionTouch | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || !("source" in value) || !("capturedAt" in value))
      return null;
    const touch = value as AttributionTouch;
    return typeof touch.source === "string" && Number.isFinite(Date.parse(touch.capturedAt))
      ? touch
      : null;
  } catch {
    return null;
  }
}

/** First touch survives later campaigns; last marketing touch is tracked separately. */
export function captureAttribution() {
  if (typeof window === "undefined") return;
  try {
    const current = attributionFromUrl(
      window.location.href,
      document.referrer,
      new Date().toISOString(),
    );
    let first = storedTouch(KEY);
    if (!first) {
      first = current;
      localStorage.setItem(KEY, JSON.stringify(first));
    }
    let last = storedTouch(LAST_KEY);
    if (isCampaignTouch(current)) {
      last = current;
      localStorage.setItem(LAST_KEY, JSON.stringify(last));
    }
    const state = getState();
    if (
      state.profile &&
      (!state.signupSource || (last && state.lastMarketingTouch?.capturedAt !== last.capturedAt))
    ) {
      const firstTouch = first;
      const lastTouch = last;
      setState((s) => ({
        ...s,
        signupSource: s.signupSource ?? firstTouch,
        ...(lastTouch ? { lastMarketingTouch: lastTouch } : {}),
      }));
    }
  } catch {
    /* Analytics must never interrupt onboarding or workout logging. */
  }
}
