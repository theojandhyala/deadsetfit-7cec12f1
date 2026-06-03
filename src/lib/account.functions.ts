import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Permanently delete the authenticated user's account.
 *
 * Removes all profile and training data, then deletes the auth user. Required
 * by App Store Guideline 5.1.1(v).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // Best-effort cleanup of rows that don't auto-cascade.
    // Most tables already have ON DELETE CASCADE from auth.users, but we
    // delete defensively in case some FK is missing.
    const tables = [
      "post_likes",
      "post_comments",
      "posts",
      "follows",
      "user_blocks",
      "user_reports",
      "user_state",
      "user_roles",
      "referrals",
      "profiles",
    ];
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => {
        delete: () => {
          eq: (c: string, v: string) => Promise<unknown>;
          or: (filter: string) => Promise<unknown>;
        };
      };
    };
    for (const t of tables) {
      try {
        if (t === "follows") {
          await admin.from(t).delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
        } else if (t === "user_blocks") {
          await admin.from(t).delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
        } else if (t === "user_reports") {
          await admin.from(t).delete().or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`);
        } else if (t === "referrals") {
          await admin.from(t).delete().or(`referrer_id.eq.${userId},referred_id.eq.${userId}`);
        } else if (t === "profiles") {
          await admin.from(t).delete().eq("id", userId);
        } else if (t === "user_roles") {
          await admin.from(t).delete().eq("user_id", userId);
        } else {
          await admin.from(t).delete().eq("user_id", userId);
        }
      } catch {
        // Ignore — best-effort.
      }
    }


    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BlockInput = z.object({ userId: z.string().uuid() });
export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BlockInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("Can't block yourself");
    // Remove any mutual follow so the blocked user can't see this user's content either.
    await supabase.from("follows").delete().or(
      `and(follower_id.eq.${userId},following_id.eq.${data.userId}),and(follower_id.eq.${data.userId},following_id.eq.${userId})`,
    );
    const { error } = await supabase
      .from("user_blocks")
      .upsert({ blocker_id: userId, blocked_id: data.userId }, { onConflict: "blocker_id,blocked_id" });
    if (error) throw new Error(error.message);
    return { blocked: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BlockInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", data.userId);
    if (error) throw new Error(error.message);
    return { blocked: false };
  });

export const isBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BlockInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", userId)
      .eq("blocked_id", data.userId)
      .maybeSingle();
    return { blocked: !!row };
  });

const ReportInput = z.object({
  userId: z.string().uuid().optional(),
  postId: z.string().uuid().optional(),
  reason: z.string().min(1).max(500),
});
export const reportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReportInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.userId && !data.postId) throw new Error("Provide userId or postId");
    if (data.userId === userId) throw new Error("Can't report yourself");
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: userId,
      reported_user_id: data.userId ?? null,
      reported_post_id: data.postId ?? null,
      reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
