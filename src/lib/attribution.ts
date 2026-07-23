import { getState, setState } from "./storage";

const KEY = "deadset_attribution_v1";

type Captured = { source: string; referrer?: string; landing?: string; capturedAt: string };

function classify(referrer: string, utmSource: string | null): string {
  if (utmSource) return utmSource.toLowerCase().slice(0, 40);
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.includes("deadsetfit")) return "direct";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
    if (host.includes("google")) return "google";
    if (host.includes("t.co") || host.includes("twitter") || host.includes("x.com")) return "x";
    if (host.includes("facebook")) return "facebook";
    if (host.includes("snapchat")) return "snapchat";
    if (host.includes("reddit")) return "reddit";
    return host.slice(0, 40);
  } catch {
    return "unknown";
  }
}

/**
 * Capture where the visitor came from, once, on their first ever visit.
 * Later (once their profile exists) the source is merged into app state so
 * it syncs to the server for the admin dashboard.
 */
export function captureAttribution() {
  if (typeof window === "undefined") return;
  try {
    let captured: Captured | null = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!captured) {
      const params = new URLSearchParams(window.location.search);
      captured = {
        source: classify(document.referrer, params.get("utm_source") ?? params.get("ref")),
        referrer: document.referrer ? document.referrer.slice(0, 200) : undefined,
        landing: window.location.pathname.slice(0, 100),
        capturedAt: new Date().toISOString(),
      };
      localStorage.setItem(KEY, JSON.stringify(captured));
    }
    // Merge into app state once a profile exists and no source is stored yet.
    const state = getState();
    if (state.profile && !state.signupSource) {
      const src = captured;
      setState((s) => ({ ...s, signupSource: src }));
    }
  } catch {
    /* attribution must never break the app */
  }
}
