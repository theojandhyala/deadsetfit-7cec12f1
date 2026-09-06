import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { getSubscriptionStatus } from "@/lib/payments.functions";
import { withTimeout } from "@/lib/account-restore";
import { isNativeIos } from "@/lib/platform";
import { getAppleEntitlement, onAppleEntitlementChanged } from "@/lib/storekit";
import {
  getRevenueCatProEntitlement,
  notifyRevenueCatUpdated,
  syncRevenueCatPurchases,
} from "@/lib/revenuecat";

const PRO_CACHE_KEY = "deadset_pro_status_v1";

type ProState = {
  /** ENTITLEMENT — drives every feature gate across StoreKit and Stripe. */
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

type CachedProState = Omit<ProState, "loading" | "refresh"> & { checkedAt: number };

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
  const [isPaidPro, setIsPaidPro] = useState(cached?.isPaidPro ?? false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(cached?.status ?? null);
  const [priceId, setPriceId] = useState<string | null>(cached?.priceId ?? null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(
    cached?.currentPeriodEnd ?? null,
  );
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(cached?.cancelAtPeriodEnd ?? false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nativeIos = isNativeIos();
      const apple = nativeIos
        ? await getAppleEntitlement().catch(() => ({ active: false as const }))
        : { active: false as const };
      const {
        data: { session },
      } = await withTimeout(
        supabase.auth.getSession(),
        { data: { session: null }, error: null },
        3500,
      );
      if (!session && !apple.active) {
        setIsPro(false);
        setIsPaidPro(false);
        setStatus(null);
        setPriceId(null);
        setCurrentPeriodEnd(null);
        setCancelAtPeriodEnd(false);
        clearCachedPro();
        setLoading(false);
        return;
      }

      const revenueCat =
        nativeIos && session
          ? await getRevenueCatProEntitlement(session.user.id).catch(() => ({
              active: false,
              productId: null,
              expirationDate: null,
              willRenew: false,
            }))
          : { active: false, productId: null, expirationDate: null, willRenew: false };

      let webSubscription: Awaited<ReturnType<typeof getSubscriptionStatus>> | null = null;
      if (!nativeIos && session && isPaymentsConfigured()) {
        webSubscription = await rejectOnTimeout(
          getSubscriptionStatus({ data: { environment: getStripeEnvironment() } }),
          6500,
          "Subscription check timed out",
        ).catch(() => null);
      }

      const data = {
        isPro: apple.active || revenueCat.active || webSubscription?.isPro === true,
        isPaidPro: apple.active || revenueCat.active || webSubscription?.isPro === true,
        status: apple.active || revenueCat.active ? "active" : (webSubscription?.status ?? null),
        priceId: apple.active
          ? (apple.productId ?? null)
          : revenueCat.active
            ? revenueCat.productId
            : (webSubscription?.priceId ?? null),
        currentPeriodEnd: apple.active
          ? (apple.expirationDate ?? null)
          : revenueCat.active
            ? revenueCat.expirationDate
            : (webSubscription?.currentPeriodEnd ?? null),
        cancelAtPeriodEnd: revenueCat.active
          ? !revenueCat.willRenew
          : apple.active
            ? false
            : (webSubscription?.cancelAtPeriodEnd ?? false),
      };
      setIsPro(data.isPro);
      setIsPaidPro(data.isPaidPro);
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
    let appleListener: { remove: () => Promise<void> } | undefined;
    if (isNativeIos()) {
      onAppleEntitlementChanged((entitlement) => {
        if (entitlement.active) {
          void supabase.auth.getSession().then(({ data }) =>
            syncRevenueCatPurchases(data.session?.user.id).then((synced) => {
              if (synced) notifyRevenueCatUpdated();
            }),
          );
        }
        void refresh();
      }).then((listener) => {
        appleListener = listener;
      });
    }
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
      setIsPaidPro(false);
      setStatus(null);
      setPriceId(null);
      setCurrentPeriodEnd(null);
      setCancelAtPeriodEnd(false);
      clearCachedPro();
      setLoading(false);
    };
    const onFocus = () => refresh();
    const onRevenueCatUpdated = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("deadset:revenuecat-updated", onRevenueCatUpdated);
    window.addEventListener("deadset:explicit-logout", onExplicitLogout);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("deadset:revenuecat-updated", onRevenueCatUpdated);
      window.removeEventListener("deadset:explicit-logout", onExplicitLogout);
      document.removeEventListener("visibilitychange", onVisible);
      void appleListener?.remove();
    };
  }, [refresh]);

  return (
    <ProContext.Provider
      value={{
        isPro,
        isPaidPro,
        loading,
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
      isPro: false,
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
