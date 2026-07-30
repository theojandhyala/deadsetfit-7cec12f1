import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { getSubscriptionStatus } from "@/lib/payments.functions";
import { withTimeout } from "@/lib/account-restore";
import { isNativeIos } from "@/lib/platform";

const PRO_CACHE_KEY = "deadset_pro_status_v1";

type ProState = {
  /**
   * ENTITLEMENT — drives every feature gate.
   * On native iOS this is always true: Pro can't be sold in the app (no IAP),
   * so gating features there would mean charging outside the App Store
   * (Guideline 3.1.1) and hiding advertised features from review (2.3).
   * Every feature is simply free on iOS.
   */
  isPro: boolean;
  /** Actual paid subscription — identity/badging and billing surfaces only. */
  isPaidPro: boolean;
  loading: boolean;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  refresh: () => Promise<void>;
};

type CachedProState = Omit<ProState, "loading" | "refresh" | "isPaidPro"> & { checkedAt: number };

const ProContext = createContext<ProState | null>(null);

function readCachedPro(): CachedProState | null {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PRO_CACHE_KEY) || "null",
    ) as CachedProState | null;
    if (!parsed || Date.now() - parsed.checkedAt > 10 * 60_000) return null;
    if (parsed.currentPeriodEnd && new Date(parsed.currentPeriodEnd) <= new Date()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedPro(status: Omit<CachedProState, "checkedAt">) {
  try {
    localStorage.setItem(PRO_CACHE_KEY, JSON.stringify({ ...status, checkedAt: Date.now() }));
  } catch {
    /* storage unavailable (private mode / quota) — cache is best-effort */
  }
}

function clearCachedPro() {
  try {
    localStorage.removeItem(PRO_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

async function rejectOnTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function ProProvider({ children }: { children: ReactNode }) {
  const cached = typeof window !== "undefined" ? readCachedPro() : null;
  const [isPro, setIsPro] = useState(cached?.isPro ?? false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(cached?.status ?? null);
  const [priceId, setPriceId] = useState<string | null>(cached?.priceId ?? null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(
    cached?.currentPeriodEnd ?? null,
  );
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(cached?.cancelAtPeriodEnd ?? false);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Native iOS never queries subscription/purchase state: there is nothing to
    // buy in the app and every feature is already unlocked, so the app makes no
    // payment-related requests at all (App Store Guideline 3.1.1).
    if (isNativeIos() || !isPaymentsConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const {
        data: { session },
      } = await withTimeout(
        supabase.auth.getSession(),
        { data: { session: null }, error: null },
        3500,
      );
      if (!session) {
        setIsPro(false);
        setStatus(null);
        setPriceId(null);
        setCurrentPeriodEnd(null);
        setCancelAtPeriodEnd(false);
        clearCachedPro();
        setLoading(false);
        return;
      }
      const env = getStripeEnvironment();
      const data = await rejectOnTimeout(
        getSubscriptionStatus({ data: { environment: env } }),
        6500,
        "Subscription check timed out",
      );
      setIsPro(data.isPro);
      setStatus(data.status);
      setPriceId(data.priceId);
      setCurrentPeriodEnd(data.currentPeriodEnd);
      setCancelAtPeriodEnd(data.cancelAtPeriodEnd);
      writeCachedPro(data);
      window.dispatchEvent(new CustomEvent("deadset:pro-status", { detail: data }));
    } catch (e) {
      console.warn("usePro refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reflect Pro status onto the document root so the whole app can pick up
  // the gold Pro identity via [data-pro="true"] CSS — makes the upgrade obvious.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.pro = isPro ? "true" : "false";
    }
  }, [isPro]);

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Supabase can emit SIGNED_OUT during transient token/storage failures.
        // Keep the cached Pro state unless the app performs an explicit logout.
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN") refresh();
    });
    const onExplicitLogout = () => {
      setIsPro(false);
      setStatus(null);
      setPriceId(null);
      setCurrentPeriodEnd(null);
      setCancelAtPeriodEnd(false);
      clearCachedPro();
      setLoading(false);
    };
    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("deadset:explicit-logout", onExplicitLogout);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("deadset:explicit-logout", onExplicitLogout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // On native iOS every feature is free (see ProState.isPro), and we must not
  // flash a locked state while the subscription check is in flight either.
  const iosFree = isNativeIos();

  return (
    <ProContext.Provider
      value={{
        isPro: isPro || iosFree,
        isPaidPro: isPro,
        loading: iosFree ? false : loading,
        status,
        priceId,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        refresh,
      }}
    >
      {children}
    </ProContext.Provider>
  );
}

export function usePro(): ProState {
  const ctx = useContext(ProContext);
  if (!ctx)
    return {
      // No provider: still unlock everything on iOS so no gate can ever appear there.
      isPro: isNativeIos(),
      isPaidPro: false,
      loading: false,
      status: null,
      priceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      refresh: async () => {},
    };
  return ctx;
}
