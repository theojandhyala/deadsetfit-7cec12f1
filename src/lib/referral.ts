// Referral capture + redemption. Invite links look like https://deadsetfit.org/?ref=CODE.
// We capture the code on first load (before any auth), then redeem it once the
// user is signed in — both people get 30 days of Pro. Closes the viral loop that
// was previously dropped (the ?ref param was never read).
import { redeemReferral, getMyReferralInfo } from "./social.functions";
import { toast } from "sonner";

const PENDING_KEY = "deadset_pending_ref";
const CODE_KEY = "deadset_my_ref_code";
const ORIGIN = "https://deadsetfit.org";

/**
 * The current user's invite URL (…/?ref=CODE), used when sharing cards so shares
 * drive installs and both people earn Pro. Caches the code; falls back to the
 * plain site URL when signed out / offline.
 */
export async function getInviteUrl(): Promise<string> {
  let code: string | null = null;
  try {
    code = localStorage.getItem(CODE_KEY);
  } catch {
    /* ignore */
  }
  if (!code) {
    try {
      const info = await getMyReferralInfo();
      code = info?.code ?? null;
      if (code) localStorage.setItem(CODE_KEY, code);
    } catch {
      /* signed out or offline */
    }
  }
  return code ? `${ORIGIN}/?ref=${encodeURIComponent(code)}` : ORIGIN;
}

/** Read ?ref= off the URL, stash it, and strip it from the address bar. */
export function capturePendingRef() {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref && /^[A-Za-z0-9_-]{3,32}$/.test(ref)) {
      localStorage.setItem(PENDING_KEY, ref);
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch {
    /* non-fatal */
  }
}

let inFlight = false;

/**
 * Redeem a captured referral code. Safe to call repeatedly / on every sign-in —
 * a business rejection (self-referral, already redeemed) clears the pending code,
 * while a transient network error keeps it for the next attempt.
 */
export async function redeemPendingRef() {
  if (inFlight) return;
  let code: string | null = null;
  try {
    code = localStorage.getItem(PENDING_KEY);
  } catch {
    return;
  }
  if (!code) return;
  inFlight = true;
  try {
    const res = await redeemReferral({ data: { code } });
    // Got a definitive answer from the server → don't try again.
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    if (res?.ok) toast.success("Referral applied — 30 days of Pro unlocked 🔥");
  } catch {
    // Network/transient error — leave the code pending to retry on next sign-in.
  } finally {
    inFlight = false;
  }
}
