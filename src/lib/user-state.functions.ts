import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const loadUserState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ data: string | null }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_state")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { data: data?.data ? JSON.stringify(data.data) : null };
  });

export const saveUserState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ data: z.string().max(2_000_000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.data);
    } catch {
      throw new Error("Invalid JSON");
    }
    const { error } = await supabase
      .from("user_state")
      .upsert({ user_id: userId, data: parsed as never }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
