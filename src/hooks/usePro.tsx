import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { getSubscriptionStatus } from "@/lib/payments.functions";

type ProState = {
  isPro: boolean;
  loading: boolean;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  refresh: () => Promise<void>;
};

const ProContext = createContext<ProState | null>(null);

export function ProProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  const refresh = useCallback(async () => {
    if (!isPaymentsConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsPro(false); setLoading(false); return; }
      const env = getStripeEnvironment();
      const data = await getSubscriptionStatus({ data: { environment: env } });
      setIsPro(data.isPro);
      setStatus(data.status);
      setPriceId(data.priceId);
      setCurrentPeriodEnd(data.currentPeriodEnd);
      setCancelAtPeriodEnd(data.cancelAtPeriodEnd);
    } catch (e) {
      console.warn("usePro refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") refresh();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  return (
    <ProContext.Provider value={{ isPro, loading, status, priceId, currentPeriodEnd, cancelAtPeriodEnd, refresh }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro(): ProState {
  const ctx = useContext(ProContext);
  if (!ctx) return { isPro: false, loading: false, status: null, priceId: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, refresh: async () => {} };
  return ctx;
}

// ---- Paywall sheet context (for "locked feature" bottom sheet) ----
type PaywallCtx = {
  open: (opts: { feature: string; description?: string }) => void;
  close: () => void;
  state: { open: boolean; feature: string; description?: string };
};
const PaywallContext = createContext<PaywallCtx | null>(null);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; feature: string; description?: string }>({
    open: false, feature: "",
  });
  const open = useCallback((opts: { feature: string; description?: string }) => {
    setState({ open: true, feature: opts.feature, description: opts.description });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return <PaywallContext.Provider value={{ open, close, state }}>{children}</PaywallContext.Provider>;
}
export function usePaywall(): PaywallCtx {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within PaywallProvider");
  return ctx;
}
