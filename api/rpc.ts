import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chatJSON, chatText, chatVisionJSON } from "../src/lib/ai-gateway.server";
import { createStripeClient, getStripeErrorMessage } from "../src/lib/stripe.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { gritLevel } from "../src/lib/calc";
import type { Database } from "../src/integrations/supabase/types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

interface AuthCtx {
  supabase: SupabaseClient<Database>;
  userId: string;
  email?: string;
}

async function requireAuth(req: any): Promise<AuthCtx> {
  const auth = (req.headers["authorization"] ?? "") as string;
  if (!auth.startsWith("Bearer ")) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const token = auth.slice(7);
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return {
    supabase,
    userId: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : undefined,
  };
}

async function optionalAuth(req: any): Promise<AuthCtx | null> {
  try { return await requireAuth(req); } catch { return null; }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function leagueOf(pts: number): "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "ELITE" {
  if (pts >= 10000) return "ELITE";
  if (pts >= 5000) return "DIAMOND";
  if (pts >= 2000) return "GOLD";
  if (pts >= 500) return "SILVER";
  return "BRONZE";
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

async function resolveOrCreateCustomer(stripe: any, options: { email?: string; userId?: string }): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  if (options.userId) {
    const found = await stripe.customers.search({ query: `metadata['userId']:'${options.userId}'`, limit: 1 });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, userId: options.userId } });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

async function findCustomer(stripe: any, options: { email?: string; userId: string }): Promise<string | null> {
  const found = await stripe.customers.search({ query: `metadata['userId']:'${options.userId}'`, limit: 1 });
  if (found.data.length) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) return existing.data[0].id;
  }
  return null;
}

function safeReturnUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const allowed = host === "deadsetfit.org"
    || host === "www.deadsetfit.org"
    || host === "deadsetfit.pages.dev"
    || host.endsWith(".deadsetfit.pages.dev")
    || host === "localhost"
    || host === "127.0.0.1";
  if (!allowed || (url.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1")) {
    throw new Error("Invalid return URL");
  }
  return url.toString();
}

type SubscriptionStatus = {
  isPro: boolean;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const inactiveSubscription = (): SubscriptionStatus => ({
  isPro: false,
  status: null,
  priceId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
});

async function stripeSubscriptionStatus(stripe: any, options: { email?: string; userId: string }): Promise<SubscriptionStatus> {
  const customerId = await findCustomer(stripe, options);
  if (!customerId) return inactiveSubscription();
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  const now = Math.floor(Date.now() / 1000);
  const rows = [...subscriptions.data].sort((a: any, b: any) => (b.created ?? 0) - (a.created ?? 0));
  const active = rows.find((sub: any) => {
    const item = sub.items?.data?.[0];
    const end = item?.current_period_end ?? sub.current_period_end ?? 0;
    return ["active", "trialing", "past_due"].includes(sub.status)
      || (sub.status === "canceled" && end > now);
  });
  const sub: any = active ?? rows[0];
  if (!sub) return inactiveSubscription();
  const item = sub.items?.data?.[0];
  const end = item?.current_period_end ?? sub.current_period_end ?? null;
  const price = item?.price;
  return {
    isPro: !!active,
    status: sub.status ?? null,
    priceId: price?.lookup_key ?? price?.id ?? null,
    currentPeriodEnd: end ? new Date(end * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  };
}

async function requirePro(req: any): Promise<AuthCtx> {
  const ctx = await requireAuth(req);
  const { data: profile } = await ctx.supabase.from("profiles").select("pro_until").eq("id", ctx.userId).maybeSingle();
  if (profile?.pro_until && new Date(profile.pro_until) > new Date()) return ctx;
  const status = await stripeSubscriptionStatus(createStripeClient("live"), ctx);
  if (!status.isPro) throw Object.assign(new Error("DEADSET Pro required"), { status: 403 });
  return ctx;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

type Handler = (data: any, req: any) => Promise<unknown>;

const handlers: Record<string, Handler> = {

  // === AI: generateSchedule ===
  async generateSchedule(data, req) {
    await requireAuth(req);
    const d = z.object({ goal: z.string(), experience: z.string(), daysPerWeek: z.number(), equipment: z.string() }).parse(data);
    const sys = `You are a strength coach. Reply with strict JSON only.
The JSON shape must be:
{"days":{"MON":{"label":"PUSH — CHEST / SHOULDERS / TRICEPS","exerciseIds":["bench-press","ohp"]}, ...all 7 days...}}
Use only these exerciseIds: bench-press, incline-db-press, cable-fly, dips, push-ups, deadlift, pull-ups, lat-pulldown, seated-row, face-pull, squat, rdl, leg-press, lunges, leg-curl, ohp, lateral-raise, front-raise, rear-delt-fly, barbell-curl, hammer-curl, skull-crushers, tricep-pushdown, plank, hanging-leg-raise, cable-crunch, ab-wheel.
Labels must be uppercase, e.g. "PUSH — CHEST / SHOULDERS / TRICEPS", "PULL — BACK / BICEPS", "LEGS — QUADS / HAMS / GLUTES", "REST".
Include exactly ${d.daysPerWeek} training days and the rest as REST with empty exerciseIds.`;
    const user = `Goal: ${d.goal}. Experience: ${d.experience}. Days/week: ${d.daysPerWeek}. Equipment: ${d.equipment}. Build the split.`;
    return chatJSON<{ days: Record<string, { label: string; exerciseIds: string[] }> }>({ system: sys, user });
  },

  // === AI: generateMeals ===
  async generateMeals(data, req) {
    await requireAuth(req);
    const d = z.object({ goal: z.string(), calories: z.number(), protein: z.number(), carbs: z.number(), fats: z.number(), dislikes: z.string().optional() }).parse(data);
    const sys = `You are a sports nutritionist. Reply with strict JSON only:
{"breakfast":{"name":"...","calories":0,"protein":0,"carbs":0,"fats":0},"lunch":{...},"dinner":{...},"snack":{...}}
Total of all 4 meals should approximate the daily targets.`;
    const user = `Goal: ${d.goal}. Target ${d.calories} kcal, P${d.protein} C${d.carbs} F${d.fats}. Dislikes: ${d.dislikes || "none"}. Suggest practical, varied meals.`;
    return chatJSON({ system: sys, user });
  },

  // === AI: swapMeal ===
  async swapMeal(data, req) {
    await requireAuth(req);
    const d = z.object({ name: z.string(), calories: z.number(), protein: z.number(), carbs: z.number(), fats: z.number() }).parse(data);
    const sys = `Reply with strict JSON only: {"name":"...","calories":0,"protein":0,"carbs":0,"fats":0}. Suggest one alternative meal with matching macros (±10%).`;
    const user = `Current: ${d.name} (${d.calories} kcal, P${d.protein} C${d.carbs} F${d.fats}). Give one different but similar-macro alternative.`;
    return chatJSON({ system: sys, user });
  },

  // === Session: scorePump ===
  async scorePump(data, req) {
    await requireAuth(req);
    const d = z.object({
      label: z.string(), totalVolume: z.number(), prCount: z.number(), sets: z.number(), durationMin: z.number(),
      exercises: z.array(z.object({ name: z.string(), sets: z.number(), topWeight: z.number(), topReps: z.number() })).max(20),
    }).parse(data);
    const sys = `You are an elite hypertrophy coach. Reply with strict JSON only:
{"score": 0-100, "note": "ONE punchy uppercase sentence under 70 chars"}
Score reflects training stimulus (volume, intensity, PRs, density). Note is motivational, no fluff.`;
    const user = `Workout: ${d.label}. Duration ${d.durationMin}min. ${d.sets} sets. ${d.totalVolume}kg total volume. ${d.prCount} PRs.
Top sets: ${d.exercises.map(e => `${e.name} ${e.sets}x ${e.topWeight}kg×${e.topReps}`).join("; ")}.
Rate the pump.`;
    return chatJSON<{ score: number; note: string }>({ system: sys, user });
  },

  // === Coach: coachChat ===
  async coachChat(data, req) {
    await requirePro(req);
    const MessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) });
    const d = z.object({
      messages: z.array(MessageSchema).min(1).max(40),
      context: z.object({
        goal: z.string().optional(), experience: z.string().optional(), weightKg: z.number().optional(),
        heightCm: z.number().optional(), benchKg: z.number().optional(), squatKg: z.number().optional(),
        deadliftKg: z.number().optional(), streak: z.number().optional(),
      }).optional(),
    }).parse(data);
    const c = d.context ?? {};
    const ctxLines = [
      c.goal && `Goal: ${c.goal}`, c.experience && `Experience: ${c.experience}`,
      c.weightKg && `Bodyweight: ${c.weightKg}kg`, c.heightCm && `Height: ${c.heightCm}cm`,
      c.benchKg && `Bench 1RM: ${c.benchKg}kg`, c.squatKg && `Squat 1RM: ${c.squatKg}kg`,
      c.deadliftKg && `Deadlift 1RM: ${c.deadliftKg}kg`,
      typeof c.streak === "number" && `Current streak: ${c.streak} days`,
    ].filter(Boolean).join("\n");
    const system = `You are DEADSET Coach — a direct, no-fluff strength & conditioning coach inside the DEADSET fitness app.
Tone: brief, practical, motivating, never preachy. Use lbs only if the user does, otherwise kg.
Format: short answers (1-3 short paragraphs or a tight bulleted list). Never lecture. Never refuse safe training questions.
Always assume the athlete is healthy unless told otherwise; recommend seeing a doctor only for sharp pain, numbness, or chest issues.
Avoid emoji walls. No medical diagnosis. No supplements that aren't food/creatine/whey/caffeine.

Athlete profile:
${ctxLines || "(no profile context provided)"}
`;
    const reply = await chatText({ system, messages: d.messages });
    return { reply };
  },

  // === Physique: analyzePhysique ===
  async analyzePhysique(data, req) {
    await requireAuth(req);
    const d = z.object({
      imageDataUrl: z.string().startsWith("data:image/").max(5_000_000, "Image is too large"),
      goal: z.string().trim().min(1).max(200),
      weightKg: z.number().min(25).max(500).optional(),
    }).parse(data);
    const sys = `You are an elite physique coach analyzing a progress photo. Reply with strict JSON only:
{
  "bodyFatEstimate": <number 5-40>,
  "muscleScore": <0-100>,
  "symmetryScore": <0-100>,
  "leanMassNote": "ONE uppercase sentence under 70 chars",
  "strengths": ["SHORT POINT","SHORT POINT","SHORT POINT"],
  "weaknesses": ["SHORT POINT","SHORT POINT","SHORT POINT"],
  "focus": ["MUSCLE GROUP","MUSCLE GROUP","MUSCLE GROUP"],
  "verdict": "ONE bold uppercase motivating sentence under 90 chars"
}
Be honest but constructive. If the image is not a clear physique photo, return all zeros and verdict "RETAKE WITH BETTER LIGHTING AND POSE".`;
    const user = `Goal: ${d.goal}. ${d.weightKg ? `Weight: ${d.weightKg}kg.` : ""} Analyze.`;
    return chatVisionJSON({ system: sys, user, imageDataUrl: d.imageDataUrl });
  },

  // === Payments: createCheckoutSession ===
  async createCheckoutSession(data, req) {
    const { userId, email } = await requireAuth(req);
    const d = z.object({
      priceId: z.string(), returnUrl: z.string().url(), environment: z.enum(["sandbox", "live"]),
    }).parse(data);
    if (!/^[a-zA-Z0-9_-]+$/.test(d.priceId)) throw new Error("Invalid priceId");
    try {
      const stripe = createStripeClient(d.environment);
      const prices = await stripe.prices.list({ lookup_keys: [d.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";
      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded",
        return_url: safeReturnUrl(d.returnUrl),
        customer: customerId,
        metadata: { userId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      } as any);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  },

  // === Payments: createPortalSession ===
  async createPortalSession(data, req) {
    const { userId, email } = await requireAuth(req);
    const d = z.object({ returnUrl: z.string().url().optional(), environment: z.enum(["sandbox", "live"]) }).parse(data);
    try {
      const stripe = createStripeClient(d.environment);
      const customerId = await findCustomer(stripe, { userId, email });
      if (!customerId) throw new Error("No subscription found");
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        ...(d.returnUrl && { return_url: safeReturnUrl(d.returnUrl) }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  },

  async getSubscriptionStatus(data, req) {
    const ctx = await requireAuth(req);
    const d = z.object({ environment: z.enum(["sandbox", "live"]) }).parse(data);
    const { data: profile } = await ctx.supabase.from("profiles").select("pro_until").eq("id", ctx.userId).maybeSingle();
    if (profile?.pro_until && new Date(profile.pro_until) > new Date()) {
      return { isPro: true, status: "referral", priceId: null, currentPeriodEnd: profile.pro_until, cancelAtPeriodEnd: false };
    }
    return stripeSubscriptionStatus(createStripeClient(d.environment), ctx);
  },

  // === Leaderboard (strength PRs) ===
  async getLeaderboard(data, req) {
    const { supabase } = await requireAuth(req);
    const d = z.object({ category: z.enum(["OVERALL", "BENCH", "SQUAT", "DEADLIFT", "TOTAL"]), limit: z.number().int().min(1).max(100).optional() }).parse(data);
    const { data: rows, error } = await supabase.from("public_profiles").select("id, username, display_name, avatar_url, level, public_stats").limit(500);
    if (error) throw error;
    type TopPR = { id?: string; value?: number; unit?: string };
    type PublicStats = { overall?: number; topPRs?: TopPR[] };
    const getPRValue = (stats: PublicStats, id: string) => Number((stats.topPRs ?? []).find(p => p?.id === id)?.value ?? 0);
    const cat = d.category;
    const enriched = (rows ?? [])
      .filter((r): r is typeof r & { id: string } => typeof r.id === "string")
      .map(r => {
        const stats = (r.public_stats ?? {}) as PublicStats;
        let value = 0, unit = "kg";
        if (cat === "OVERALL") { value = Number(stats.overall ?? 0); unit = "OVR"; }
        else if (cat === "TOTAL") value = getPRValue(stats, "bench-press") + getPRValue(stats, "squat") + getPRValue(stats, "deadlift");
        else if (cat === "BENCH") value = getPRValue(stats, "bench-press");
        else if (cat === "SQUAT") value = getPRValue(stats, "squat");
        else if (cat === "DEADLIFT") value = getPRValue(stats, "deadlift");
        return { id: r.id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url, level: r.level, value: Math.round(value * 10) / 10, unit };
      })
      .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, d.limit ?? 50);
    return { rows: enriched };
  },

  // === User state ===
  async loadUserState(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data, error } = await supabase.from("user_state").select("data").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return { data: data?.data ? JSON.stringify(data.data) : null };
  },

  async saveUserState(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ data: z.string().max(2_000_000) }).parse(data);
    let parsed: unknown;
    try { parsed = JSON.parse(d.data); } catch { throw new Error("Invalid JSON"); }
    const { error } = await supabase.from("user_state").upsert({ user_id: userId, data: parsed as never }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // === Profile ===
  async saveProfile(data, req) {
    const { supabase, userId } = await requireAuth(req);
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
    const d = ProfileSchema.parse(data);
    if (d.username) {
      const { data: existing } = await supabase.from("public_profiles").select("id").ilike("username", d.username).neq("id", userId).maybeSingle();
      if (existing) throw new Error("Username is already taken");
    }
    const { error } = await supabase.from("profiles").upsert({ id: userId, ...d }, { onConflict: "id" });
    if (error) {
      if (error.code === "23505") throw new Error("Username is already taken");
      throw new Error(error.message);
    }
    return { ok: true };
  },

  async getMyProfile(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async signInWithUsername(data, _req) {
    const d = z.object({ username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/), password: z.string().min(6).max(128) }).parse(data);
    const fail = { ok: false as const, error: "Invalid username or password" };
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").ilike("username", d.username).maybeSingle();
    if (!profile) return fail;
    const { data: userRes, error: lookupErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (lookupErr || !userRes?.user?.email) return fail;
    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signIn, error } = await anon.auth.signInWithPassword({ email: userRes.user.email, password: d.password });
    if (error || !signIn.session) return fail;
    return { ok: true as const, access_token: signIn.session.access_token, refresh_token: signIn.session.refresh_token };
  },

  // === Social: feed ===
  async getFeed(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data: blocks } = await supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const hidden = new Set<string>();
    (blocks ?? []).forEach(b => hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id));
    let query = supabase.from("posts").select("id, user_id, kind, content, image_url, metadata, created_at").order("created_at", { ascending: false }).limit(50);
    if (hidden.size > 0) query = query.not("user_id", "in", `(${Array.from(hidden).join(",")})`);
    const { data: posts, error } = await query;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((posts ?? []).map(p => p.user_id)));
    const postIds = (posts ?? []).map(p => p.id);
    const [{ data: authors }, { data: likes }, { data: myLikes }, { data: commentCounts }] = await Promise.all([
      supabase.from("public_profiles").select("id, display_name, username, avatar_url, grit_points").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_likes").select("post_id, reaction").in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_likes").select("post_id, reaction").eq("user_id", userId).in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("post_comments").select("post_id").in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const authorMap = new Map((authors ?? []).map(a => [a.id, { ...a, level: gritLevel(a.grit_points ?? 0) }]));
    const likeCount = new Map<string, number>();
    const reactionCounts = new Map<string, Record<string, number>>();
    (likes ?? []).forEach(l => {
      likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1);
      const rc = reactionCounts.get(l.post_id) ?? {};
      rc[l.reaction] = (rc[l.reaction] ?? 0) + 1;
      reactionCounts.set(l.post_id, rc);
    });
    const myReactions = new Map((myLikes ?? []).map(l => [l.post_id, l.reaction]));
    const cmCount = new Map<string, number>();
    (commentCounts ?? []).forEach(c => cmCount.set(c.post_id, (cmCount.get(c.post_id) ?? 0) + 1));
    return (posts ?? []).map(p => ({
      ...p,
      author: authorMap.get(p.user_id) ?? { id: p.user_id, display_name: "Athlete", username: null, avatar_url: null, grit_points: 0, level: "BEGINNER" },
      likeCount: likeCount.get(p.id) ?? 0, reactions: reactionCounts.get(p.id) ?? {},
      myReaction: myReactions.get(p.id) ?? null, commentCount: cmCount.get(p.id) ?? 0, liked: myReactions.has(p.id),
    }));
  },

  async createPost(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({
      kind: z.enum(["workout", "pr", "progress", "text"]),
      content: z.string().max(500).default(""),
      image_url: z.string().url().optional().nullable(),
      metadata: z.record(z.string(), z.any()).optional().default({}),
    }).parse(data);
    const { error, data: row } = await supabase.from("posts")
      .insert({ user_id: userId, kind: d.kind, content: d.content, image_url: d.image_url ?? null, metadata: d.metadata })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  },

  async toggleLike(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ postId: z.string().uuid(), reaction: z.enum(["fire", "beast", "respect", "goat"]).default("fire") }).parse(data);
    const { data: existing } = await supabase.from("post_likes").select("reaction").eq("post_id", d.postId).eq("user_id", userId).maybeSingle();
    if (existing && existing.reaction === d.reaction) {
      await supabase.from("post_likes").delete().eq("post_id", d.postId).eq("user_id", userId);
      return { liked: false, reaction: null as string | null };
    }
    if (existing) {
      await supabase.from("post_likes").update({ reaction: d.reaction }).eq("post_id", d.postId).eq("user_id", userId);
    } else {
      await supabase.from("post_likes").insert({ post_id: d.postId, user_id: userId, reaction: d.reaction });
    }
    return { liked: true, reaction: d.reaction };
  },

  async addComment(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ postId: z.string().uuid(), content: z.string().min(1).max(500) }).parse(data);
    const { error } = await supabase.from("post_comments").insert({ post_id: d.postId, user_id: userId, content: d.content });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async getComments(data, req) {
    const { supabase } = await requireAuth(req);
    const d = z.object({ postId: z.string().uuid() }).parse(data);
    const { data: rows, error } = await supabase.from("post_comments")
      .select("id, user_id, content, created_at").eq("post_id", d.postId)
      .order("created_at", { ascending: true }).limit(100);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map(r => r.user_id)));
    const { data: authors } = await supabase.from("public_profiles").select("id, display_name, username")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const am = new Map((authors ?? []).map(a => [a.id, a]));
    return (rows ?? []).map(r => ({ ...r, author: am.get(r.user_id) }));
  },

  // === Social: grit leaderboard ===
  async getSocialLeaderboard(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data, error } = await supabase.from("public_profiles")
      .select("id, display_name, username, avatar_url, grit_points")
      .order("grit_points", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    const me = (data ?? []).find(p => p.id === userId);
    const myPts = me?.grit_points ?? 0;
    return {
      top: (data ?? []).map((p, i) => ({ ...p, rank: i + 1, league: leagueOf(p.grit_points ?? 0), level: gritLevel(p.grit_points ?? 0) })),
      me: me ? { ...me, rank: (data ?? []).findIndex(p => p.id === userId) + 1, league: leagueOf(myPts), level: gritLevel(myPts) } : null,
    };
  },

  async toggleFollow(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    if (d.userId === userId) throw new Error("Can't follow self");
    const { data: existing } = await supabase.from("follows").select("follower_id").eq("follower_id", userId).eq("following_id", d.userId).maybeSingle();
    if (existing) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", d.userId);
      return { following: false };
    }
    await supabase.from("follows").insert({ follower_id: userId, following_id: d.userId });
    return { following: true };
  },

  async searchAthletes(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ q: z.string().trim().min(1).max(40) }).parse(data);
    const q = d.q.replace(/[%_]/g, "");
    const { data: blocks } = await supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const hidden = new Set<string>();
    (blocks ?? []).forEach(b => hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id));
    const { data: rows, error } = await supabase.from("public_profiles")
      .select("id, username, display_name, avatar_url, level")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).neq("id", userId).limit(20);
    if (error) throw new Error(error.message);
    const filtered = (rows ?? []).filter(r => r.id && !hidden.has(r.id as string));
    const ids = filtered.map(r => r.id).filter((x): x is string => !!x);
    const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId)
      .in("following_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const followingSet = new Set((follows ?? []).map(f => f.following_id));
    return filtered.map(r => ({ ...r, id: r.id as string, following: followingSet.has(r.id as string) }));
  },

  async getSuggestedAthletes(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    const followingSet = new Set((follows ?? []).map(f => f.following_id));
    const { data: rows } = await supabase.from("public_profiles").select("id, username, display_name, avatar_url, grit_points")
      .neq("id", userId).order("grit_points", { ascending: false }).limit(30);
    return (rows ?? []).filter((r): r is typeof r & { id: string } => !!r.id && !followingSet.has(r.id)).slice(0, 10).map(r => ({
      id: r.id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url,
      level: gritLevel(r.grit_points ?? 0), grit_points: r.grit_points ?? 0, following: false,
    }));
  },

  async getMyFollowStats(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const [{ count: following }, { count: followers }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    ]);
    return { following: following ?? 0, followers: followers ?? 0 };
  },

  async getAthleteCard(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    const { data: row, error } = await supabase.from("public_profiles")
      .select("id, username, display_name, avatar_url, bio, grit_points, public_stats").eq("id", d.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Athlete not found");
    const [{ data: follow }, { count: followers }, { count: following }, meRow] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("follower_id", userId).eq("following_id", d.userId).maybeSingle(),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", d.userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", d.userId),
      userId === d.userId ? Promise.resolve(null) : supabase.from("public_profiles").select("public_stats, grit_points").eq("id", userId).maybeSingle(),
    ]);
    return {
      ...row, level: gritLevel(row.grit_points ?? 0), following: !!follow,
      followerCount: followers ?? 0, followingCount: following ?? 0, isMe: userId === d.userId,
      my_public_stats: (meRow as any)?.data?.public_stats ?? null, my_grit_points: (meRow as any)?.data?.grit_points ?? null,
    };
  },

  async getMyReferralInfo(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data: p } = await supabase.from("profiles").select("referral_code, pro_until").eq("id", userId).single();
    const { count } = await supabase.from("referrals").select("*", { count: "exact", head: true }).eq("referrer_id", userId);
    return { code: p?.referral_code ?? null, count: count ?? 0, proUntil: p?.pro_until ?? null };
  },

  async redeemReferral(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ code: z.string().min(4).max(16) }).parse(data);
    const code = d.code.trim().toUpperCase();
    const { data: owner, error: oErr } = await supabaseAdmin.from("profiles").select("id, referral_code").eq("referral_code", code).maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!owner) throw new Error("Invalid code");
    if (owner.id === userId) throw new Error("Can't redeem your own code");
    const { error } = await supabase.from("referrals").insert({ referrer_id: owner.id, referred_id: userId, code });
    if (error) {
      if (error.code === "23505") throw new Error("Already redeemed");
      throw new Error(error.message);
    }
    const month = new Date(Date.now() + 30 * 86400_000).toISOString();
    await supabase.from("profiles").update({ pro_until: month, referred_by: owner.id }).eq("id", userId);
    const { data: rp } = await supabaseAdmin.from("profiles").select("pro_until").eq("id", owner.id).single();
    const base = rp?.pro_until && new Date(rp.pro_until) > new Date() ? new Date(rp.pro_until) : new Date();
    await supabaseAdmin.from("profiles").update({ pro_until: new Date(base.getTime() + 30 * 86400_000).toISOString() }).eq("id", owner.id);
    return { ok: true };
  },

  async updateMyProfile(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({
      username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
      display_name: z.string().min(1).max(40).optional(),
      bio: z.string().max(160).optional(),
    }).parse(data);
    const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
    if (d.username !== undefined) patch.username = d.username.toLowerCase();
    if (d.display_name !== undefined) patch.display_name = d.display_name;
    if (d.bio !== undefined) patch.bio = d.bio;
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) {
      if (error.code === "23505") throw new Error("Username taken");
      throw new Error(error.message);
    }
    return { ok: true };
  },

  async updateMyLocation(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ city: z.string().trim().min(1).max(80), region: z.string().trim().max(80).optional().nullable(), country: z.string().trim().min(1).max(80) }).parse(data);
    const { error } = await supabase.from("profiles").update({ city: d.city, region: d.region ?? null, country: d.country, location_updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async getMyLocation(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data } = await supabase.from("profiles").select("city, region, country").eq("id", userId).maybeSingle();
    return { city: data?.city ?? null, region: data?.region ?? null, country: data?.country ?? null };
  },

  async getNearbyAthletes(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data: me } = await supabase.from("profiles").select("city, country").eq("id", userId).maybeSingle();
    if (!me?.city || !me?.country) return { athletes: [], myCity: null, myCountry: null };
    const { data: blocks } = await supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const hidden = new Set<string>();
    (blocks ?? []).forEach(b => hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id));
    const { data: same } = await supabase.from("public_profiles")
      .select("id, username, display_name, avatar_url, level, grit_points, city, country")
      .ilike("city", me.city).ilike("country", me.country).neq("id", userId).limit(30);
    const ids = (same ?? []).map(r => r.id).filter((x): x is string => !!x);
    const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId)
      .in("following_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const fset = new Set((follows ?? []).map(f => f.following_id));
    const athletes = (same ?? []).filter(r => r.id && !hidden.has(r.id as string)).map(r => ({ ...r, id: r.id as string, following: fset.has(r.id as string) }));
    return { athletes, myCity: me.city, myCountry: me.country };
  },

  // === Library ===
  async listExercises(data, req) {
    const { supabase } = await requireAuth(req);
    const d = z.object({
      category: z.string().optional(), equipment: z.string().optional(), muscle: z.string().optional(),
      difficulty: z.number().int().min(1).max(5).optional(), search: z.string().max(80).optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(data);
    let q = supabase.from("exercises").select("*").order("name").limit(d.limit);
    if (d.category) q = q.eq("category", d.category);
    if (d.equipment) q = q.eq("equipment", d.equipment);
    if (d.difficulty) q = q.eq("difficulty", d.difficulty);
    if (d.muscle) q = q.contains("primary_muscles", [d.muscle]);
    if (d.search) q = q.ilike("name", `%${d.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { exercises: rows ?? [] };
  },

  async countExercises(_data, req) {
    const { supabase } = await requireAuth(req);
    const { count, error } = await supabase.from("exercises").select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  },

  async generateExerciseBatch(data, req) {
    const { userId } = await requireAuth(req);
    const d = z.object({ batchSize: z.number().int().min(5).max(30).default(20), focus: z.string().min(3).max(80) }).parse(data);
    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");
    const ALLOWED_EQUIPMENT = ["BARBELL", "DUMBBELL", "CABLE", "MACHINE", "BODYWEIGHT", "BANDS", "KETTLEBELL"];
    const ALLOWED_CATEGORIES = ["PUSH", "PULL", "LEGS", "CORE", "CARDIO"];
    const ExSchema = z.object({
      name: z.string().min(2).max(80), category: z.enum(["PUSH", "PULL", "LEGS", "CORE", "CARDIO"]),
      primary_muscles: z.array(z.string()).min(1).max(4), secondary_muscles: z.array(z.string()).max(4).default([]),
      equipment: z.enum(["BARBELL", "DUMBBELL", "CABLE", "MACHINE", "BODYWEIGHT", "BANDS", "KETTLEBELL"]),
      difficulty: z.number().int().min(1).max(5), instructions: z.string().min(10).max(300),
      pro_tip: z.string().min(5).max(220), youtube_query: z.string().min(3).max(80),
      warmup_note: z.string().max(160).default(""), stretch_note: z.string().max(160).default(""), is_compound: z.boolean().default(false),
    });
    const sys = `You are an elite strength coach building a hypertrophy + strength exercise library.
Reply with STRICT JSON only, shape:
{"exercises":[{"name":"...","category":"PUSH|PULL|LEGS|CORE|CARDIO","primary_muscles":["..."],"secondary_muscles":["..."],"equipment":"BARBELL|DUMBBELL|CABLE|MACHINE|BODYWEIGHT|BANDS|KETTLEBELL","difficulty":1-5,"instructions":"1-2 cue sentences","pro_tip":"1 elite-athlete tip","youtube_query":"3-6 word search","warmup_note":"short cue","stretch_note":"short cue","is_compound":true|false}]}`;
    const user = `Generate exactly ${d.batchSize} distinct exercises focused on: ${d.focus}. Avoid the obvious staples — go a level deeper.`;
    const out = await chatJSON<{ exercises: unknown[] }>({ system: sys, user });
    const parsed = z.object({ exercises: z.array(ExSchema).min(1) }).parse(out);
    const rows = parsed.exercises.map(e => ({
      slug: slugify(e.name), name: e.name,
      category: ALLOWED_CATEGORIES.includes(e.category) ? e.category : "PUSH",
      primary_muscles: e.primary_muscles, secondary_muscles: e.secondary_muscles,
      equipment: ALLOWED_EQUIPMENT.includes(e.equipment) ? e.equipment : "BODYWEIGHT",
      difficulty: e.difficulty, instructions: e.instructions, pro_tip: e.pro_tip,
      youtube_query: e.youtube_query, warmup_note: e.warmup_note, stretch_note: e.stretch_note, is_compound: e.is_compound,
    }));
    const { data: inserted, error } = await supabaseAdmin.from("exercises").upsert(rows, { onConflict: "slug", ignoreDuplicates: true }).select("slug");
    if (error) throw new Error(error.message);
    return { added: inserted?.length ?? 0, attempted: rows.length };
  },

  // === Programs ===
  async smartSuggest(data, req) {
    await requireAuth(req);
    const d = z.object({
      goal: z.string(), experience: z.string(),
      days: z.array(z.object({ label: z.string(), items: z.array(z.object({ name: z.string(), primary_muscles: z.array(z.string()) })) })),
      candidates: z.array(z.object({ id: z.string(), name: z.string(), primary_muscles: z.array(z.string()) })).max(400),
    }).parse(data);
    const sys = `You are an elite strength coach reviewing a weekly training program.
Reply STRICT JSON only:
{"gaps":[{"day":"label","muscle":"muscle-slug","reason":"short reason","suggested_ids":["uuid","uuid"]}]}
suggested_ids MUST be picked from the provided candidates list (by id). Max 4 gaps. Max 2 ids per gap.`;
    const user = `Goal: ${d.goal}. Experience: ${d.experience}.
Program:
${d.days.map(day => `- ${day.label}: ${day.items.map(i => `${i.name} [${i.primary_muscles.join(",")}]`).join("; ") || "(empty)"}`).join("\n")}

Candidate library (id — name — muscles):
${d.candidates.slice(0, 200).map(c => `${c.id} — ${c.name} — ${c.primary_muscles.join(",")}`).join("\n")}

Return gaps with suggested_ids drawn ONLY from the candidate ids above.`;
    return chatJSON({ system: sys, user });
  },

  // === Diet ===
  async analyzeFoodPhoto(data, req) {
    await requireAuth(req);
    const d = z.object({ imageDataUrl: z.string().min(20).max(5_000_000) }).parse(data);
    const sys = `You are a nutritionist. Identify the meal in the photo and estimate macros for the visible portion. Reply with strict JSON only:
{"name":"...","calories":0,"protein":0,"carbs":0,"fats":0,"confidence":"low|medium|high","notes":"..."}`;
    return chatVisionJSON({ system: sys, user: "Identify this food and estimate nutrition for the visible portion.", imageDataUrl: d.imageDataUrl });
  },

  async lookupBarcode(data, req) {
    await requireAuth(req);
    const d = z.object({ barcode: z.string().regex(/^[0-9]{6,14}$/) }).parse(data);
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${d.barcode}.json`, { headers: { "User-Agent": "DEADSET-App/1.0" } });
    if (!res.ok) throw new Error("Lookup failed");
    const json = await res.json() as { status: number; product?: { product_name?: string; brands?: string; nutriments?: { "energy-kcal_100g"?: number; proteins_100g?: number; carbohydrates_100g?: number; fat_100g?: number }; serving_size?: string } };
    if (json.status !== 1 || !json.product) throw new Error("Product not found");
    const p = json.product;
    const n = p.nutriments || {};
    return {
      name: [p.brands, p.product_name].filter(Boolean).join(" — ") || "Unknown product",
      calories: Math.round(n["energy-kcal_100g"] ?? 0), protein: Math.round(n.proteins_100g ?? 0),
      carbs: Math.round(n.carbohydrates_100g ?? 0), fats: Math.round(n.fat_100g ?? 0), serving: p.serving_size ?? "100g",
    };
  },

  async weeklyNutritionReport(data, req) {
    await requireAuth(req);
    const d = z.object({
      goal: z.string(), targetCalories: z.number(), targetProtein: z.number(),
      days: z.array(z.object({ date: z.string(), calories: z.number(), protein: z.number(), carbs: z.number(), fats: z.number(), waterMl: z.number() })).min(1).max(14),
    }).parse(data);
    const sys = `You are an elite sports nutritionist reviewing a week of intake. Reply with strict JSON only:
{"grade":"A+|A|B|C|D|F","adherence":0,"avgCalories":0,"avgProtein":0,"hydrationScore":0,"wins":["..."],"misses":["..."],"action":"one specific action for next week"}`;
    const user = `Goal: ${d.goal}. Target ${d.targetCalories} kcal / ${d.targetProtein}g protein.\nLog:\n${d.days.map(day => `${day.date}: ${day.calories}kcal P${day.protein} C${day.carbs} F${day.fats} water:${day.waterMl}ml`).join("\n")}`;
    return chatJSON({ system: sys, user });
  },

  // === Account ===
  async deleteMyAccount(_data, req) {
    const { userId } = await requireAuth(req);
    const tables = ["post_likes", "post_comments", "posts", "follows", "user_blocks", "user_reports", "user_state", "user_roles", "referrals", "profiles"];
    for (const t of tables) {
      try {
        const q = (supabaseAdmin as any).from(t).delete();
        if (t === "follows") await q.or(`follower_id.eq.${userId},following_id.eq.${userId}`);
        else if (t === "user_blocks") await q.or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
        else if (t === "user_reports") await q.or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`);
        else if (t === "referrals") await q.or(`referrer_id.eq.${userId},referred_id.eq.${userId}`);
        else if (t === "profiles") await q.eq("id", userId);
        else if (t === "user_roles") await q.eq("user_id", userId);
        else await q.eq("user_id", userId);
      } catch { /* best-effort */ }
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async blockUser(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    if (d.userId === userId) throw new Error("Can't block yourself");
    await supabase.from("follows").delete().or(`and(follower_id.eq.${userId},following_id.eq.${d.userId}),and(follower_id.eq.${d.userId},following_id.eq.${userId})`);
    const { error } = await supabase.from("user_blocks").upsert({ blocker_id: userId, blocked_id: d.userId }, { onConflict: "blocker_id,blocked_id" });
    if (error) throw new Error(error.message);
    return { blocked: true };
  },

  async unblockUser(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", userId).eq("blocked_id", d.userId);
    if (error) throw new Error(error.message);
    return { blocked: false };
  },

  async isBlocked(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    const { data: row } = await supabase.from("user_blocks").select("id").eq("blocker_id", userId).eq("blocked_id", d.userId).maybeSingle();
    return { blocked: !!row };
  },

  async reportContent(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid().optional(), postId: z.string().uuid().optional(), reason: z.string().min(1).max(500) }).parse(data);
    if (!d.userId && !d.postId) throw new Error("Provide userId or postId");
    if (d.userId === userId) throw new Error("Can't report yourself");
    const { error } = await supabase.from("user_reports").insert({ reporter_id: userId, reported_user_id: d.userId ?? null, reported_post_id: d.postId ?? null, reason: d.reason });
    if (error) throw new Error(error.message);
    return { ok: true };
  },
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  let body: { fn?: string; data?: unknown };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const { fn, data } = body ?? {};
  if (!fn || typeof fn !== "string") { res.status(400).json({ error: "Missing fn" }); return; }

  // Alias: social leaderboard is called as 'getLeaderboard' from social context
  // and leaderboard.functions calls it the same name. Disambiguate by mapping
  // 'getSocialLeaderboard' from social.functions.ts.
  const handlerFn = handlers[fn];
  if (!handlerFn) { res.status(404).json({ error: `Unknown function: ${fn}` }); return; }

  try {
    const result = await handlerFn(data, req);
    res.status(200).json({ result });
  } catch (err: any) {
    const status = err?.status === 401 ? 401
      : err?.status === 403 ? 403
      : err instanceof z.ZodError ? 400
      : 500;
    res.status(status).json({ error: err?.message ?? "Internal server error" });
  }
}
