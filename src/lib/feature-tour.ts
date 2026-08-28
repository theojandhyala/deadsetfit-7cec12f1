export const FEATURE_TOUR_SEEN_KEY = "deadset_feature_tour_v1";
export const FEATURE_TOUR_REPLAY_EVENT = "deadset:feature-tour-replay";

export function resetFeatureTour() {
  try {
    localStorage.removeItem(FEATURE_TOUR_SEEN_KEY);
  } catch {
    /* Local storage can be unavailable in restricted browser modes. */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FEATURE_TOUR_REPLAY_EVENT));
  }
}
