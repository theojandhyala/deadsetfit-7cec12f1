import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { redeemPendingCrew } from "@/lib/crew-invite";

/**
 * Joins the crew from a `?crew=CODE` link once the athlete is signed in.
 * Mirrors ReferralRedeemer: the link almost always lands on someone who has
 * not signed up yet, so the join has to survive the whole sign-up flow.
 */
export function CrewInviteRedeemer() {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const res = await redeemPendingCrew();
      if (!cancelled && res.joined && res.name) toast.success(`Joined ${res.name}`);
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) void run();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void run();
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);
  return null;
}
