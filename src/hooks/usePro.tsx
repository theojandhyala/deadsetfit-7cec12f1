import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setIsPro(false);
        setLoading(false);
        return;
      }
      const env = getStripeEnvironment();
      const { data } = await supabase
        .from("subscriptions")
        .select("status,price_id,current_period_end,cancel_at_period_end")
        .eq("user_id", session.user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const active =
          (["active", "trialing", "past_due"].includes(data.status as string) &&
            (!data.current_period_end ||
              new Date(data.current_period_end as string) > new Date())) ||
          (data.status === "canceled" &&
            data.current_period_end &&
            new Date(data.current_period_end as string) > new Date());
        setIsPro(!!active);
        setStatus(data.status as string | null);
        setPriceId(data.price_id as string | null);
        setCurrentPeriodEnd(data.current_period_end as string | null);
        setCancelAtPeriodEnd(!!data.cancel_at_period_end);
      } else {
        setIsPro(false);
        setStatus(null);
        setPriceId(null);
        setCurrentPeriodEnd(null);
        setCancelAtPeriodEnd(false);
      }
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

    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      channel = supabase
        .channel(`sub-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "subscriptions",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => refresh(),
        )
        .subscribe();
    })();

    return () => {
      data.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <ProContext.Provider
      value={{ isPro, loading, status, priceId, currentPeriodEnd, cancelAtPeriodEnd, refresh }}
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
      loading: false,
      status: null,
      priceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      refresh: async () => {},
    };
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
    open: false,
    feature: "",
  });
  const open = useCallback((opts: { feature: string; description?: string }) => {
    setState({ open: true, feature: opts.feature, description: opts.description });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return (
    <PaywallContext.Provider value={{ open, close, state }}>{children}</PaywallContext.Provider>
  );
}
export function usePaywall(): PaywallCtx {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within PaywallProvider");
  return ctx;
}
