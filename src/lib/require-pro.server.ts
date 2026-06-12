import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requirePro = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context;
    const env = process.env.STRIPE_ENV === "live" ? "live" : "sandbox";
    const { data } = await supabase
      .from("subscriptions")
      .select("status,current_period_end")
      .eq("user_id", userId)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isPro =
      data !== null &&
      ["active", "trialing", "past_due"].includes(data.status) &&
      (!data.current_period_end || new Date(data.current_period_end) > new Date());

    if (!isPro) throw new Error("Pro subscription required");
    return next({ context });
  });
