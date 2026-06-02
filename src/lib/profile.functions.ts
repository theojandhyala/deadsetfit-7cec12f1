import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
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
  public_stats: z.record(z.string(), z.any()).optional(),
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

/**
 * Sign in with username + password without ever returning the user's email
 * to the client. Looks up the email server-side, then performs the password
 * sign-in against the public anon client and returns the session tokens so
 * the browser can call `supabase.auth.setSession(...)`.
 */
export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
      password: z.string().min(6).max(128),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (!profile) throw new Error("Invalid username or password");

    const { data: userRes, error: lookupErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (lookupErr || !userRes?.user?.email) throw new Error("Invalid username or password");

    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signIn, error } = await anon.auth.signInWithPassword({
      email: userRes.user.email,
      password: data.password,
    });
    if (error || !signIn.session) throw new Error("Invalid username or password");

    return {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });
