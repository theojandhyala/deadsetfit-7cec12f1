import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Checks the user's newest subscription row. Deliberately does NOT filter on
// the `environment` column — older live databases don't have it, and querying
// a missing column errors, which would lock out paying users.
export async function hasActivePro(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[requirePro] subscription lookup failed:", error.message);
    return false;
  }

  return (
    data !== null &&
    ["active", "trialing", "past_due"].includes(data.status) &&
    (!data.current_period_end || new Date(data.current_period_end) > new Date())
  );
}

export async function assertPro(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<void> {
  if (!(await hasActivePro(supabase, userId))) {
    throw new Error("Pro subscription required");
  }
}

export const requirePro = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    await assertPro(context.supabase, context.userId);
    return next({ context });
  });
