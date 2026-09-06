import { joinCrew } from "./crew.functions";

const PENDING_KEY = "deadset_pending_crew";

/** Crew codes are six characters from the unambiguous alphabet. */
export const CREW_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function crewInviteUrl(code: string, origin = "https://deadsetfit.org"): string {
  return `${origin}/?crew=${encodeURIComponent(code.toUpperCase())}`;
}

/**
 * Capture a `?crew=CODE` off the landing URL and strip it from the address bar.
 *
 * Captured rather than joined on the spot: the link usually lands on someone
 * who is not signed in yet, and the join has to survive sign-up.
 */
export function capturePendingCrew() {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("crew");
    if (code && CREW_CODE_PATTERN.test(code.toUpperCase())) {
      localStorage.setItem(PENDING_KEY, code.toUpperCase());
      url.searchParams.delete("crew");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch {
    /* a malformed URL must never block the app booting */
  }
}

export function pendingCrewCode(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearPendingCrew() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

let inFlight = false;

/**
 * Join the captured crew once the athlete is signed in.
 *
 * A business rejection — bad code, or already in a crew — clears the pending
 * code so it cannot retry forever; a network error keeps it for next time.
 */
export async function redeemPendingCrew(): Promise<{ joined: boolean; name?: string }> {
  if (inFlight) return { joined: false };
  const code = pendingCrewCode();
  if (!code) return { joined: false };
  inFlight = true;
  try {
    const res = await joinCrew({ data: { code } });
    clearPendingCrew();
    return { joined: true, name: res.crew?.name };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (/already in a crew|No crew with that code/i.test(message)) clearPendingCrew();
    return { joined: false };
  } finally {
    inFlight = false;
  }
}
