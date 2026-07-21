import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { redeemPendingRef } from "@/lib/referral";

/**
 * Redeems a captured referral code once the user is authenticated.
 * Runs on mount (if a session already exists) and on every SIGNED_IN event.
 * No-op when there's no pending code.
 */
export function ReferralRedeemer() {
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) void redeemPendingRef();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void redeemPendingRef();
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);
  return null;
}
