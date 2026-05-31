import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ProfileSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/).optional(),
  display_name: z.string().min(1).max(60).optional(),
  goal: z.enum(["BULK", "CUT", "MAINTAIN", "ATHLETIC"]).optional(),
  experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  age: z.number().int().min(13).max(100).optional(),
  weight_kg: z.number().min(30).max(300).optional(),
  height_cm: z.number().min(120).max(230).optional(),
  days_per_week: z.number().int().min(1).max(7).optional(),
  equipment: z.enum(["FULL_GYM", "HOME_GYM", "BODYWEIGHT"]).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().max(2_000_000).optional(),
  onboarded: z.boolean().optional(),
});

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.username) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", data.username)
        .neq("id", userId)
        .maybeSingle();
      if (existing) {
        throw new Error("Username is already taken");
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const resolveUsernameToEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();

    if (!profile) throw new Error("No account found for that username");

    const { data: userRes, error } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (error || !userRes?.user?.email) throw new Error("No account found for that username");

    return { email: userRes.user.email };
  });
