import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
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

/**
 * Sign up a new user using the admin API so the account is immediately
 * confirmed and the user can sign in straight away without checking email.
 * Returns session tokens on success.
 */
export const signUpUser = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6).max(128),
        display_name: z.string().min(1).max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const displayName =
      data.display_name?.trim() ||
      data.email.split("@")[0]?.replace(/[^a-zA-Z0-9_ -]/g, "").slice(0, 60) ||
      "DEADSET Athlete";

    // Create user with email pre-confirmed so they can sign in immediately
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error) {
      const message = error.message.toLowerCase().includes("already")
        ? "An account with this email already exists"
        : error.message;
      throw new Error(message);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, display_name: displayName }, { onConflict: "id" });
    if (profileError) throw new Error(profileError.message);

    // Sign in immediately and return session tokens
    const anon = createClient(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
      (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (signInErr || !signIn.session) throw new Error("Account created but sign-in failed — try signing in manually");

    return {
      ok: true as const,
      userId: created.user.id,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.username) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      .upsert({ id: userId, ...data }, { onConflict: "id" });

    if (error) {
      if (error.code === "23505") throw new Error("Username is already taken");
      throw new Error(error.message);
    }
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
    z
      .object({
        username: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z0-9_]+$/),
        password: z.string().min(6).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const fail = { ok: false as const, error: "Invalid username or password" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (!profile) return fail;

    const { data: userRes, error: lookupErr } = await supabaseAdmin.auth.admin.getUserById(
      profile.id,
    );
    if (lookupErr || !userRes?.user?.email) return fail;

    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error } = await anon.auth.signInWithPassword({
      email: userRes.user.email,
      password: data.password,
    });
    if (error || !signIn.session) return fail;

    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });
