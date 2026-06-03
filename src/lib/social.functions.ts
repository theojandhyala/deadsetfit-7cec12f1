import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gritLevel } from "@/lib/calc";

// === Feed ===
export const getFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Hide posts authored by users this user has blocked or who have blocked them.
    const { data: blocks } = await supabase
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const hidden = new Set<string>();
    (blocks ?? []).forEach((b) => {
      hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
    });

    let query = supabase
      .from("posts")
      .select("id, user_id, kind, content, image_url, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (hidden.size > 0) {
      query = query.not("user_id", "in", `(${Array.from(hidden).join(",")})`);
    }
    const { data: posts, error } = await query;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((posts ?? []).map(p => p.user_id)));
    const postIds = (posts ?? []).map(p => p.id);

    const [{ data: authors }, { data: likes }, { data: myLikes }, { data: commentCounts }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, username, avatar_url, grit_points").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_likes").select("post_id").in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_comments").select("post_id").in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const authorMap = new Map((authors ?? []).map(a => [a.id, { ...a, level: gritLevel(a.grit_points ?? 0) }]));
    const likeCount = new Map<string, number>();
    (likes ?? []).forEach(l => likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1));
    const mine = new Set((myLikes ?? []).map(l => l.post_id));
    const cmCount = new Map<string, number>();
    (commentCounts ?? []).forEach(c => cmCount.set(c.post_id, (cmCount.get(c.post_id) ?? 0) + 1));

    return (posts ?? []).map(p => ({
      ...p,
      author: authorMap.get(p.user_id) ?? { id: p.user_id, display_name: "Athlete", username: null, avatar_url: null, grit_points: 0, level: "BEGINNER" as const },
      likeCount: likeCount.get(p.id) ?? 0,
      commentCount: cmCount.get(p.id) ?? 0,
      liked: mine.has(p.id),
    }));
  });

// === Create post ===
const PostInput = z.object({
  kind: z.enum(["workout", "pr", "progress", "text"]),
  content: z.string().max(500).default(""),
  image_url: z.string().url().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});
export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PostInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error, data: row } = await supabase
      .from("posts")
      .insert({ user_id: userId, kind: data.kind, content: data.content, image_url: data.image_url ?? null, metadata: data.metadata })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// === Toggle like ===
const LikeInput = z.object({ postId: z.string().uuid() });
export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LikeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("post_likes")
      .select("post_id").eq("post_id", data.postId).eq("user_id", userId).maybeSingle();
    if (existing) {
      await supabase.from("post_likes").delete().eq("post_id", data.postId).eq("user_id", userId);
      return { liked: false };
    }
    await supabase.from("post_likes").insert({ post_id: data.postId, user_id: userId });
    return { liked: true };
  });

// === Comments ===
const CommentInput = z.object({ postId: z.string().uuid(), content: z.string().min(1).max(500) });
export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("post_comments").insert({ post_id: data.postId, user_id: userId, content: data.content });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const GetCommentsInput = z.object({ postId: z.string().uuid() });
export const getComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetCommentsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("post_comments")
      .select("id, user_id, content, created_at")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map(r => r.user_id)));
    const { data: authors } = await supabaseAdmin
      .from("profiles").select("id, display_name, username")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const am = new Map((authors ?? []).map(a => [a.id, a]));
    return (rows ?? []).map(r => ({ ...r, author: am.get(r.user_id) }));
  });

// === Leaderboard / Leagues ===
// League tiers based on grit_points
function leagueOf(pts: number): "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "ELITE" {
  if (pts >= 10000) return "ELITE";
  if (pts >= 5000) return "DIAMOND";
  if (pts >= 2000) return "GOLD";
  if (pts >= 500) return "SILVER";
  return "BRONZE";
}

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase: _supabase, userId } = context;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, avatar_url, grit_points")
      .order("grit_points", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const me = (data ?? []).find(p => p.id === userId);
    const myPts = me?.grit_points ?? 0;
    const myLeague = leagueOf(myPts);
    return {
      top: (data ?? []).map((p, i) => ({ ...p, rank: i + 1, league: leagueOf(p.grit_points ?? 0), level: gritLevel(p.grit_points ?? 0) })),
      me: me ? { ...me, rank: (data ?? []).findIndex(p => p.id === userId) + 1, league: myLeague, level: gritLevel(myPts) } : null,
    };
  });

// === Follow ===
const FollowInput = z.object({ userId: z.string().uuid() });
export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FollowInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("Can't follow self");
    const { data: existing } = await supabase
      .from("follows").select("follower_id").eq("follower_id", userId).eq("following_id", data.userId).maybeSingle();
    if (existing) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", data.userId);
      return { following: false };
    }
    await supabase.from("follows").insert({ follower_id: userId, following_id: data.userId });
    return { following: true };
  });

// === Search athletes (for adding friends) ===
const SearchInput = z.object({ q: z.string().trim().min(1).max(40) });
export const searchAthletes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = data.q.replace(/[%_]/g, "");
    const { data: blocks } = await supabase
      .from("user_blocks").select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const hidden = new Set<string>();
    (blocks ?? []).forEach((b) => hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id));
    const { data: rows, error } = await supabaseAdmin
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, level")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq("id", userId)
      .limit(20);
    if (error) throw new Error(error.message);
    const filtered = (rows ?? []).filter(r => r.id && !hidden.has(r.id as string));
    const ids = filtered.map(r => r.id).filter((x): x is string => !!x);
    const { data: follows } = await supabase
      .from("follows").select("following_id")
      .eq("follower_id", userId)
      .in("following_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const followingSet = new Set((follows ?? []).map(f => f.following_id));
    return filtered.map(r => ({ ...r, id: r.id as string, following: followingSet.has(r.id as string) }));
  });


// === Suggested athletes (top of leaderboard, not already followed) ===
export const getSuggestedAthletes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: follows } = await supabase
      .from("follows").select("following_id").eq("follower_id", userId);
    const followingSet = new Set((follows ?? []).map(f => f.following_id));
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, grit_points")
      .neq("id", userId)
      .order("grit_points", { ascending: false })
      .limit(30);
    return (rows ?? [])
      .filter(r => !followingSet.has(r.id))
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        level: gritLevel(r.grit_points ?? 0),
        grit_points: r.grit_points ?? 0,
        following: false,
      }));
  });

// === My follow counts ===
export const getMyFollowStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: following }, { count: followers }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    ]);
    return { following: following ?? 0, followers: followers ?? 0 };
  });

// === Athlete public card (for /athlete/$id) ===
const AthleteInput = z.object({ userId: z.string().uuid() });
export const getAthleteCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AthleteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabaseAdmin
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, bio, grit_points, public_stats")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Athlete not found");
    const [{ data: follow }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("follower_id", userId).eq("following_id", data.userId).maybeSingle(),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", data.userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", data.userId),
    ]);
    return {
      ...row,
      level: gritLevel(row.grit_points ?? 0),
      following: !!follow,
      followerCount: followers ?? 0,
      followingCount: following ?? 0,
      isMe: userId === data.userId,
    };
  });

// === Referrals ===
export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase.from("profiles").select("referral_code, pro_until").eq("id", userId).single();
    const { count } = await supabase.from("referrals").select("*", { count: "exact", head: true }).eq("referrer_id", userId);
    return { code: p?.referral_code ?? null, count: count ?? 0, proUntil: p?.pro_until ?? null };
  });

const RedeemInput = z.object({ code: z.string().min(4).max(16) });
export const redeemReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RedeemInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.trim().toUpperCase();
    const { data: owner, error: oErr } = await supabaseAdmin
      .from("profiles").select("id, referral_code").eq("referral_code", code).maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!owner) throw new Error("Invalid code");
    if (owner.id === userId) throw new Error("Can't redeem your own code");
    const { error } = await supabase.from("referrals").insert({ referrer_id: owner.id, referred_id: userId, code });
    if (error) {
      if (error.code === "23505") throw new Error("Already redeemed");
      throw new Error(error.message);
    }
    // grant 30d pro to both
    const month = new Date(Date.now() + 30 * 86400_000).toISOString();
    await supabase.from("profiles").update({ pro_until: month, referred_by: owner.id }).eq("id", userId);
    // extend referrer (cross-user update requires admin client)
    const { data: rp } = await supabaseAdmin.from("profiles").select("pro_until").eq("id", owner.id).single();
    const base = rp?.pro_until && new Date(rp.pro_until) > new Date() ? new Date(rp.pro_until) : new Date();
    const newDate = new Date(base.getTime() + 30 * 86400_000).toISOString();
    await supabaseAdmin.from("profiles").update({ pro_until: newDate }).eq("id", owner.id);
    return { ok: true };
  });

// === Profile sync (writes username + display_name) ===
const ProfileInput = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
  display_name: z.string().min(1).max(40).optional(),
  bio: z.string().max(160).optional(),
});
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { username?: string; display_name?: string; bio?: string } = {};
    if (data.username !== undefined) patch.username = data.username.toLowerCase();
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.bio !== undefined) patch.bio = data.bio;
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) {
      if (error.code === "23505") throw new Error("Username taken");
      throw new Error(error.message);
    }
    return { ok: true };
  });
