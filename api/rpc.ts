import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createStripeClient, getStripeErrorMessage } from "../src/lib/stripe.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { gritLevel, calculateGritScore } from "../src/lib/calc";
import { buildPublicStats } from "../src/lib/fifa-stats";
import { currentWeekStart } from "../src/lib/competition";
import { getRank } from "../src/lib/rank";
import type { AppState } from "../src/lib/types";
import type { Database } from "../src/integrations/supabase/types";

interface AuthCtx {
  supabase: SupabaseClient<Database>;
  userId: string;
  email?: string;
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!publishableKey ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ].join(", ");
    throw Object.assign(new Error(`Missing Supabase environment variable(s): ${missing}`), {
      status: 500,
    });
  }
  return { url, publishableKey };
}

async function requireAuth(req: any): Promise<AuthCtx> {
  const auth = (req.headers["authorization"] ?? "") as string;
  if (!auth.startsWith("Bearer ")) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const token = auth.slice(7);
  const { url, publishableKey } = getSupabaseEnv();
  const supabase = createClient<Database>(url, publishableKey, {
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
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function leagueOf(pts: number) {
  return getRank(pts).label;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function resolveOrCreateCustomer(
  stripe: any,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
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

async function findCustomer(
  stripe: any,
  options: { email?: string; userId: string },
): Promise<string | null> {
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
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
  const allowed =
    host === "deadsetfit.org" ||
    host === "www.deadsetfit.org" ||
    host === "deadsetfit.pages.dev" ||
    host.endsWith(".deadsetfit.pages.dev") ||
    host === "localhost" ||
    host === "127.0.0.1";
  if (!allowed || (url.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1")) {
    throw new Error("Invalid return URL");
  }
  return url.toString();
}

type ProPriceConfig = {
  currency: "usd" | "gbp";
  unitAmount: number;
  interval: "month" | "year";
  nickname: string;
};

const PRO_PRICE_CONFIG: Record<string, ProPriceConfig> = {
  pro_monthly: {
    currency: "usd",
    unitAmount: 499,
    interval: "month",
    nickname: "DEADSET Pro Monthly",
  },
  pro_yearly: {
    currency: "usd",
    unitAmount: 3999,
    interval: "year",
    nickname: "DEADSET Pro Yearly",
  },
  pro_monthly_gbp: {
    currency: "gbp",
    unitAmount: 499,
    interval: "month",
    nickname: "DEADSET Pro Monthly GBP",
  },
  pro_yearly_gbp: {
    currency: "gbp",
    unitAmount: 3999,
    interval: "year",
    nickname: "DEADSET Pro Yearly GBP",
  },
};

function stripeProductMeta(product: unknown): {
  id?: string;
  name?: string;
  metadata?: Record<string, string>;
} {
  if (!product || typeof product === "string")
    return { id: typeof product === "string" ? product : undefined };
  const p = product as { id?: string; name?: string; metadata?: Record<string, string> };
  return { id: p.id, name: p.name, metadata: p.metadata };
}

function isDeadsetProProduct(product: unknown): boolean {
  const p = stripeProductMeta(product);
  const name = (p.name ?? "").toLowerCase();
  const app = (p.metadata?.app ?? "").toLowerCase();
  const tier = (p.metadata?.tier ?? "").toLowerCase();
  return app === "deadset" || tier === "pro" || name.includes("deadset");
}

async function resolveDeadsetProProduct(stripe: any): Promise<string> {
  try {
    const found = await stripe.products.search({
      query: "metadata['app']:'deadset' AND metadata['tier']:'pro'",
      limit: 1,
    });
    if (found.data?.[0]?.id) return found.data[0].id;
  } catch {
    // Some Stripe accounts/API versions may not have Search enabled; fall back to list.
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing =
    products.data.find((product: any) => isDeadsetProProduct(product)) ??
    products.data.find((product: any) => /pro|premium|subscription/i.test(product.name ?? ""));
  if (existing?.id) return existing.id;

  const created = await stripe.products.create({
    name: "DEADSET Pro",
    description:
      "Streak Armor, head-to-head challenges, leagues, advanced analytics and featured programs.",
    metadata: { app: "deadset", tier: "pro" },
  });
  return created.id;
}

async function resolveOrCreateStripePrice(stripe: any, lookupKey: string): Promise<any> {
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (prices.data.length) return prices.data[0];

  const config = PRO_PRICE_CONFIG[lookupKey];
  if (!config) throw new Error("Price not found");

  const existingPrices = await stripe.prices.list({
    active: true,
    limit: 100,
    expand: ["data.product"],
  });

  const matchingPrices = existingPrices.data
    .filter((price: any) => price.currency === config.currency)
    .filter((price: any) => price.recurring?.interval === config.interval)
    .filter((price: any) => isDeadsetProProduct(price.product));

  // Only an exact unit_amount match may be reused — a fuzzy name match could
  // silently bill a legacy amount that differs from the advertised price.
  const exactExisting = matchingPrices.find(
    (price: any) => price.unit_amount === config.unitAmount,
  );

  if (exactExisting) {
    return exactExisting;
  }

  const product = await resolveDeadsetProProduct(stripe);
  return stripe.prices.create({
    product,
    currency: config.currency,
    unit_amount: config.unitAmount,
    nickname: config.nickname,
    lookup_key: lookupKey,
    recurring: { interval: config.interval },
    metadata: { app: "deadset", lookup_key: lookupKey },
  });
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

function isProSubscriptionStatus(
  status: string | null | undefined,
  currentPeriodEnd: string | null,
): boolean {
  const activeByStatus = ["active", "trialing", "past_due"].includes(status ?? "");
  const activeCanceled =
    status === "canceled" && !!currentPeriodEnd && new Date(currentPeriodEnd) > new Date();
  return activeByStatus || activeCanceled;
}

function subscriptionStatusFromStripeSubscription(subscription: any): SubscriptionStatus {
  const item = subscription.items?.data?.[0];
  const end = item?.current_period_end ?? subscription.current_period_end ?? null;
  const currentPeriodEnd = end ? new Date(end * 1000).toISOString() : null;
  const price = item?.price;
  const status = subscription.status ?? null;
  return {
    isPro: isProSubscriptionStatus(status, currentPeriodEnd),
    status,
    priceId: price?.lookup_key ?? price?.id ?? null,
    currentPeriodEnd,
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
  };
}

async function syncProfileProUntil(userId: string, status: SubscriptionStatus) {
  if (!status.isPro || !status.currentPeriodEnd) return;
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ pro_until: status.currentPeriodEnd })
    .eq("id", userId);
  if (error) console.error("Failed to sync pro_until", error);
}

async function stripeSubscriptionStatus(
  stripe: any,
  options: { email?: string; userId: string },
): Promise<SubscriptionStatus> {
  const customerId = await findCustomer(stripe, options);
  if (!customerId) return inactiveSubscription();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  const now = Math.floor(Date.now() / 1000);
  const rows = [...subscriptions.data].sort(
    (a: any, b: any) => (b.created ?? 0) - (a.created ?? 0),
  );
  const active = rows.find((sub: any) => {
    const item = sub.items?.data?.[0];
    const end = item?.current_period_end ?? sub.current_period_end ?? 0;
    return (
      ["active", "trialing", "past_due"].includes(sub.status) ||
      (sub.status === "canceled" && end > now)
    );
  });
  const sub: any = active ?? rows[0];
  if (!sub) return inactiveSubscription();
  const status = subscriptionStatusFromStripeSubscription(sub);
  return active ? { ...status, isPro: true } : status;
}

async function requirePro(req: any): Promise<AuthCtx> {
  const ctx = await requireAuth(req);
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("pro_until")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (profile?.pro_until && new Date(profile.pro_until) > new Date()) return ctx;
  const status = await stripeSubscriptionStatus(createStripeClient("live"), ctx);
  await syncProfileProUntil(ctx.userId, status);
  if (!status.isPro) throw Object.assign(new Error("DEADSET Pro required"), { status: 403 });
  return ctx;
}

// Bidirectional block set: users this user blocked OR who blocked this user.
// Their content must be hidden everywhere (App Store Guideline 1.2).
async function blockedUserIds(supabase: any, userId: string): Promise<Set<string>> {
  const { data: blocks } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  const hidden = new Set<string>();
  (blocks ?? []).forEach((b: any) =>
    hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id),
  );
  return hidden;
}

// ─── Duel scoring (service-role; used by createDuel/getDuels) ─────────────────
async function loadUserStateBlob(uid: string): Promise<AppState | null> {
  const { data } = await supabaseAdmin
    .from("user_state")
    .select("data")
    .eq("user_id", uid)
    .maybeSingle();
  return ((data as { data?: unknown } | null)?.data ?? null) as AppState | null;
}

function scoreOverWindow(
  state: AppState | null,
  metric: string,
  startMs: number,
  endMs: number,
): number {
  const sessions = (state?.sessions ?? []).filter((s) => {
    if (!s.endedAt) return false;
    const t = Date.parse(s.startedAt || s.date);
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
  if (metric === "sessions") return sessions.length;
  if (metric === "prs") return sessions.reduce((n, s) => n + (s.prCount ?? 0), 0);
  return Math.round(sessions.reduce((n, s) => n + (s.totalVolume ?? 0), 0));
}

async function duelScores(duel: {
  challenger_id: string;
  opponent_id: string;
  metric: string;
  start_at: string | null;
  end_at: string | null;
}): Promise<{ challenger: number; opponent: number }> {
  const startMs = duel.start_at ? Date.parse(duel.start_at) : 0;
  const endMs = duel.end_at ? Date.parse(duel.end_at) : Date.now();
  const [c, o] = await Promise.all([
    loadUserStateBlob(duel.challenger_id),
    loadUserStateBlob(duel.opponent_id),
  ]);
  return {
    challenger: scoreOverWindow(c, duel.metric, startMs, endMs),
    opponent: scoreOverWindow(o, duel.metric, startMs, endMs),
  };
}

// Flip any of a pair's expired active duels to completed (with final scores) so
// an ended-but-unviewed duel never permanently blocks a rematch.
async function finalizeExpiredDuelsForPair(a: string, b: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: expired } = await (supabaseAdmin as any)
    .from("duels")
    .select("id, challenger_id, opponent_id, metric, start_at, end_at")
    .eq("status", "active")
    .lt("end_at", nowIso)
    .or(
      `and(challenger_id.eq.${a},opponent_id.eq.${b}),and(challenger_id.eq.${b},opponent_id.eq.${a})`,
    );
  for (const x of (expired ?? []) as Array<{
    id: string;
    challenger_id: string;
    opponent_id: string;
    metric: string;
    start_at: string | null;
    end_at: string | null;
  }>) {
    const s = await duelScores(x);
    await (supabaseAdmin as any)
      .from("duels")
      .update({
        status: "completed",
        challenger_score: s.challenger,
        opponent_score: s.opponent,
        winner_id:
          s.challenger > s.opponent
            ? x.challenger_id
            : s.opponent > s.challenger
              ? x.opponent_id
              : null,
      })
      .eq("id", x.id)
      .eq("status", "active");
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

type Handler = (data: any, req: any) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  // === Payments: createCheckoutSession ===
  async createCheckoutSession(data, req) {
    const { userId, email } = await requireAuth(req);
    const d = z
      .object({
        priceId: z.string(),
        returnUrl: z.string().url(),
        environment: z.enum(["sandbox", "live"]),
        uiMode: z.enum(["embedded_page", "hosted_page"]).optional(),
      })
      .parse(data);
    if (!/^[a-zA-Z0-9_-]+$/.test(d.priceId)) throw new Error("Invalid priceId");
    try {
      const stripe = createStripeClient(d.environment);
      // Server-side double-purchase guard: the client's Pro check races its
      // own status load, so an already-subscribed user could otherwise start
      // a second subscription on the same customer.
      const existing = await stripeSubscriptionStatus(stripe, { email, userId });
      if (existing.isPro) {
        await syncProfileProUntil(userId, existing);
        return {
          error:
            "You already have an active DEADSET Pro subscription. Manage or renew it from Settings → Manage Billing.",
        };
      }
      const stripePrice = await resolveOrCreateStripePrice(stripe, d.priceId);
      const isRecurring = stripePrice.type === "recurring";
      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });
      const uiMode = d.uiMode ?? "embedded_page";
      const returnUrl = safeReturnUrl(d.returnUrl);
      const cancelUrl = new URL(returnUrl);
      cancelUrl.pathname = "/upgrade";
      cancelUrl.search = "";
      cancelUrl.hash = "";
      const checkoutBase = {
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        customer: customerId,
        allow_promotion_codes: true,
        metadata: { userId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      };
      const session = await stripe.checkout.sessions.create({
        ...checkoutBase,
        ui_mode: uiMode,
        ...(uiMode === "hosted_page"
          ? {
              success_url: returnUrl,
              cancel_url: cancelUrl.toString(),
            }
          : {
              return_url: returnUrl,
            }),
      } as any);
      return { clientSecret: session.client_secret ?? "", url: session.url ?? undefined };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  },

  // === Payments: createPortalSession ===
  async createPortalSession(data, req) {
    const { userId, email } = await requireAuth(req);
    const d = z
      .object({ returnUrl: z.string().url().optional(), environment: z.enum(["sandbox", "live"]) })
      .parse(data);
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
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("pro_until")
      .eq("id", ctx.userId)
      .maybeSingle();
    if (profile?.pro_until && new Date(profile.pro_until) > new Date()) {
      return {
        isPro: true,
        status: "referral",
        priceId: null,
        currentPeriodEnd: profile.pro_until,
        cancelAtPeriodEnd: false,
      };
    }
    const status = await stripeSubscriptionStatus(createStripeClient(d.environment), ctx);
    await syncProfileProUntil(ctx.userId, status);
    return status;
  },

  async verifyCheckoutSession(data, req) {
    const ctx = await requireAuth(req);
    const d = z
      .object({
        sessionId: z.string().min(8).max(200),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(data);
    if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(d.sessionId))
      throw new Error("Invalid checkout session");

    const stripe = createStripeClient(d.environment);
    const session = await stripe.checkout.sessions.retrieve(d.sessionId, {
      expand: ["subscription", "customer"],
    });

    const metadataUserId = session.metadata?.userId;
    const customerMeta =
      typeof session.customer === "object" && session.customer && !("deleted" in session.customer)
        ? session.customer.metadata
        : null;
    const customerUserId = customerMeta?.userId;
    if (metadataUserId !== ctx.userId && customerUserId !== ctx.userId) {
      throw Object.assign(new Error("Checkout session does not belong to this account"), {
        status: 403,
      });
    }

    let status = inactiveSubscription();
    if (session.subscription && typeof session.subscription === "object") {
      status = subscriptionStatusFromStripeSubscription(session.subscription);
    }
    if (!status.isPro) {
      status = await stripeSubscriptionStatus(stripe, ctx);
    }
    await syncProfileProUntil(ctx.userId, status);
    return { ...status, verified: true };
  },

  // === Leaderboard (strength PRs) ===
  async getLeaderboard(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z
      .object({
        category: z.enum([
          "WEEKLY",
          "RANK",
          "OVERALL",
          "BENCH",
          "SQUAT",
          "DEADLIFT",
          "TOTAL",
          "P4P",
          "VOLUME",
          "PRS",
          "STREAK",
        ]),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(data);
    const hidden = await blockedUserIds(supabase, userId);
    const { data: allRows, error } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, level, grit_points, public_stats")
      .limit(500);
    if (error) throw error;
    const rows = (allRows ?? []).filter((r: any) => !r.id || !hidden.has(r.id as string));
    type TopPR = { id?: string; value?: number; unit?: string };
    type PublicStats = {
      overall?: number;
      streak?: number;
      topPRs?: TopPR[];
      strengthToWeight?: number;
      weekly?: {
        weekStart?: string;
        score?: number;
        volumeKg?: number;
        prs?: number;
      };
    };
    const getPRValue = (stats: PublicStats, id: string) =>
      Number((stats.topPRs ?? []).find((p) => p?.id === id)?.value ?? 0);
    const cat = d.category;
    const enriched = (rows ?? [])
      .filter((r): r is typeof r & { id: string } => typeof r.id === "string")
      .map((r) => {
        const stats = (r.public_stats ?? {}) as PublicStats;
        let value = 0,
          unit = "kg";
        const weekly = stats.weekly?.weekStart === currentWeekStart() ? stats.weekly : undefined;
        if (cat === "WEEKLY") {
          value = Number(weekly?.score ?? 0);
          unit = "PTS";
        } else if (cat === "RANK") {
          value = Number(r.grit_points ?? 0);
          unit = "GRIT";
        } else if (cat === "OVERALL") {
          value = Number(stats.overall ?? 0);
          unit = "OVR";
        } else if (cat === "STREAK") {
          value = Number(stats.streak ?? 0);
          unit = "DAYS";
        } else if (cat === "VOLUME") {
          value = Number(weekly?.volumeKg ?? 0);
          unit = "KG";
        } else if (cat === "PRS") {
          value = Number(weekly?.prs ?? 0);
          unit = "PRS";
        } else if (cat === "P4P") {
          value = Number(stats.strengthToWeight ?? 0);
          unit = "X BW";
        } else if (cat === "TOTAL")
          value =
            getPRValue(stats, "bench-press") +
            getPRValue(stats, "squat") +
            getPRValue(stats, "deadlift");
        else if (cat === "BENCH") value = getPRValue(stats, "bench-press");
        else if (cat === "SQUAT") value = getPRValue(stats, "squat");
        else if (cat === "DEADLIFT") value = getPRValue(stats, "deadlift");
        return {
          id: r.id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          level: r.level,
          value: Math.round(value * 10) / 10,
          unit,
          rank_label: getRank(Number(r.grit_points ?? 0)).label,
        };
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, d.limit ?? 50);
    return { rows: enriched };
  },

  // === User state ===
  async loadUserState(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data, error } = await supabase
      .from("user_state")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { data: data?.data ? JSON.stringify(data.data) : null };
  },

  async saveUserState(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ data: z.string().max(2_000_000) }).parse(data);
    let parsed: unknown;
    try {
      parsed = JSON.parse(d.data);
    } catch {
      throw new Error("Invalid JSON");
    }
    const { error } = await supabase
      .from("user_state")
      .upsert({ user_id: userId, data: parsed as never }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    // Server-authoritative leaderboard stats: derive grit + public_stats from
    // the state we just persisted, so ranks can't be spoofed by POSTing a grit
    // number to the profile API. Written with the SERVICE ROLE because the
    // guard trigger reverts authenticated writes to these columns. Best-effort:
    // a derive failure (e.g. a malformed blob) must never fail the state sync.
    try {
      const state = parsed as AppState;
      const grit = Math.max(0, Math.min(1000, Math.round(calculateGritScore(state).total)));
      const stats = buildPublicStats(state);
      await supabaseAdmin
        .from("profiles")
        .update({ grit_points: grit, public_stats: stats as never })
        .eq("id", userId);
    } catch {
      /* leaderboard derive is best-effort — never block the sync */
    }
    return { ok: true };
  },

  // === Profile ===
  async saveProfile(data, req) {
    const { supabase, userId } = await requireAuth(req);
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
      // grit_points and public_stats are intentionally NOT accepted here: they
      // are leaderboard-ranking values and are derived server-side from the
      // user_state blob in saveUserState. Accepting them from the client is the
      // spoof this closes. Zod strips any that are sent.
    });
    const d = ProfileSchema.parse(data);
    if (d.username) {
      const { data: existing } = await supabase
        .from("public_profiles")
        .select("id")
        .ilike("username", d.username)
        .neq("id", userId)
        .maybeSingle();
      if (existing) throw new Error("Username is already taken");
    }
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...d }, { onConflict: "id" });
    if (error) {
      if (error.code === "23505") throw new Error("Username is already taken");
      throw new Error(error.message);
    }
    return { ok: true };
  },

  async getMyProfile(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async signInWithUsername(data, _req) {
    const d = z
      .object({
        username: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z0-9_]+$/),
        password: z.string().min(6).max(128),
      })
      .parse(data);
    const fail = { ok: false as const, error: "Invalid username or password" };
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", d.username)
      .maybeSingle();
    if (!profile) return fail;
    const { data: userRes, error: lookupErr } = await supabaseAdmin.auth.admin.getUserById(
      profile.id,
    );
    if (lookupErr || !userRes?.user?.email) return fail;
    const { url, publishableKey } = getSupabaseEnv();
    const anon = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error } = await anon.auth.signInWithPassword({
      email: userRes.user.email,
      password: d.password,
    });
    if (error || !signIn.session) return fail;
    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  },

  // === Social: feed ===
  async getFeed(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const scope =
      (data as { scope?: string } | undefined)?.scope === "following" ? "following" : "global";
    const { data: blocks } = await supabase
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const hidden = new Set<string>();
    (blocks ?? []).forEach((b) =>
      hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id),
    );
    let query = supabase
      .from("posts")
      .select("id, user_id, kind, content, image_url, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (scope === "following") {
      // Scope to people the viewer follows (plus their own posts).
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .limit(2000);
      const allowed = (follows ?? []).map((f) => f.following_id as string);
      allowed.push(userId);
      query = query.in("user_id", allowed);
    }
    if (hidden.size > 0) query = query.not("user_id", "in", `(${Array.from(hidden).join(",")})`);
    const { data: posts, error } = await query;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((posts ?? []).map((p) => p.user_id)));
    const postIds = (posts ?? []).map((p) => p.id);
    const [{ data: authors }, { data: likes }, { data: myLikes }, { data: commentCounts }] =
      await Promise.all([
        supabase
          .from("public_profiles")
          .select("id, display_name, username, avatar_url, grit_points")
          .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("post_likes")
          .select("post_id, reaction")
          .in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("post_likes")
          .select("post_id, reaction")
          .eq("user_id", userId)
          .in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("post_comments")
          .select("post_id")
          .in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);
    const authorMap = new Map(
      (authors ?? []).map((a) => [a.id, { ...a, level: gritLevel(a.grit_points ?? 0) }]),
    );
    const likeCount = new Map<string, number>();
    const reactionCounts = new Map<string, Record<string, number>>();
    (likes ?? []).forEach((l) => {
      likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1);
      const rc = reactionCounts.get(l.post_id) ?? {};
      rc[l.reaction] = (rc[l.reaction] ?? 0) + 1;
      reactionCounts.set(l.post_id, rc);
    });
    const myReactions = new Map((myLikes ?? []).map((l) => [l.post_id, l.reaction]));
    const cmCount = new Map<string, number>();
    (commentCounts ?? []).forEach((c) => cmCount.set(c.post_id, (cmCount.get(c.post_id) ?? 0) + 1));
    return (posts ?? []).map((p) => ({
      ...p,
      author: authorMap.get(p.user_id) ?? {
        id: p.user_id,
        display_name: "Athlete",
        username: null,
        avatar_url: null,
        grit_points: 0,
        level: "BEGINNER",
      },
      likeCount: likeCount.get(p.id) ?? 0,
      reactions: reactionCounts.get(p.id) ?? {},
      myReaction: myReactions.get(p.id) ?? null,
      commentCount: cmCount.get(p.id) ?? 0,
      liked: myReactions.has(p.id),
    }));
  },

  async createPost(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z
      .object({
        kind: z.enum(["workout", "pr", "progress", "text"]),
        content: z.string().max(500).default(""),
        image_url: z.string().url().optional().nullable(),
        metadata: z.record(z.string(), z.any()).optional().default({}),
      })
      .parse(data);
    const { error, data: row } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        kind: d.kind,
        content: d.content,
        image_url: d.image_url ?? null,
        metadata: d.metadata,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  },

  async toggleLike(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z
      .object({
        postId: z.string().uuid(),
        reaction: z.enum(["fire", "beast", "respect", "goat"]).default("fire"),
      })
      .parse(data);
    const { data: existing } = await supabase
      .from("post_likes")
      .select("reaction")
      .eq("post_id", d.postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing && existing.reaction === d.reaction) {
      await supabase.from("post_likes").delete().eq("post_id", d.postId).eq("user_id", userId);
      return { liked: false, reaction: null as string | null };
    }
    if (existing) {
      await supabase
        .from("post_likes")
        .update({ reaction: d.reaction })
        .eq("post_id", d.postId)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("post_likes")
        .insert({ post_id: d.postId, user_id: userId, reaction: d.reaction });
    }
    return { liked: true, reaction: d.reaction };
  },

  async addComment(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z
      .object({ postId: z.string().uuid(), content: z.string().min(1).max(500) })
      .parse(data);
    const { error } = await supabase
      .from("post_comments")
      .insert({ post_id: d.postId, user_id: userId, content: d.content });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async getComments(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ postId: z.string().uuid() }).parse(data);
    const hidden = await blockedUserIds(supabase, userId);
    const { data: allRows, error } = await supabase
      .from("post_comments")
      .select("id, user_id, content, created_at")
      .eq("post_id", d.postId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (allRows ?? []).filter((r: any) => !hidden.has(r.user_id));
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
    const { data: authors } = await supabase
      .from("public_profiles")
      .select("id, display_name, username")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const am = new Map((authors ?? []).map((a: any) => [a.id, a]));
    return rows.map((r: any) => ({ ...r, author: am.get(r.user_id) }));
  },

  // === Social: grit leaderboard ===
  async getSocialLeaderboard(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const scope =
      (data as { scope?: string } | undefined)?.scope === "following" ? "following" : "global";
    const hidden = await blockedUserIds(supabase, userId);
    let lbQuery = supabase
      .from("public_profiles")
      .select("id, display_name, username, avatar_url, grit_points")
      .order("grit_points", { ascending: false })
      .limit(100);
    if (scope === "following") {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .limit(2000);
      const allowed = (follows ?? []).map((f) => f.following_id as string);
      allowed.push(userId);
      lbQuery = lbQuery.in("id", allowed);
    }
    const { data: rows, error } = await lbQuery;
    if (error) throw new Error(error.message);
    const all = rows ?? [];
    // Rank against the true field, then drop blocked users from the visible list
    // so their content is hidden without renumbering everyone else.
    const me = all.find((p) => p.id === userId);
    const myPts = me?.grit_points ?? 0;
    return {
      top: all
        .map((p, i) => ({
          ...p,
          rank: i + 1,
          league: leagueOf(p.grit_points ?? 0),
          level: gritLevel(p.grit_points ?? 0),
        }))
        .filter((p) => !hidden.has(p.id as string)),
      me: me
        ? {
            ...me,
            rank: all.findIndex((p) => p.id === userId) + 1,
            league: leagueOf(myPts),
            level: gritLevel(myPts),
          }
        : null,
    };
  },

  async getNotifications(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const hidden = await blockedUserIds(supabase, userId);
    // Bound to recent posts: an activity bell only needs likes/comments on
    // recent posts, and an unbounded id list would overflow the .in() URL for
    // heavy users and silently drop their notifications.
    const { data: myPosts } = await supabase
      .from("posts")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const myPostIds = (myPosts ?? []).map((p) => p.id as string);
    const noPosts = { data: [] as Array<Record<string, unknown>> };
    const [followsRes, likesRes, commentsRes] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id, created_at")
        .eq("following_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
      myPostIds.length
        ? supabase
            .from("post_likes")
            .select("post_id, user_id, reaction, created_at")
            .in("post_id", myPostIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(40)
        : Promise.resolve(noPosts),
      myPostIds.length
        ? supabase
            .from("post_comments")
            .select("post_id, user_id, content, created_at")
            .in("post_id", myPostIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(40)
        : Promise.resolve(noPosts),
    ]);
    const actorIds = new Set<string>();
    (followsRes.data ?? []).forEach((f) => actorIds.add(f.follower_id as string));
    (likesRes.data ?? []).forEach((l) => actorIds.add(l.user_id as string));
    (commentsRes.data ?? []).forEach((c) => actorIds.add(c.user_id as string));
    const { data: profs } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", actorIds.size ? Array.from(actorIds) : ["00000000-0000-0000-0000-000000000000"]);
    const pm = new Map((profs ?? []).map((p) => [p.id, p]));
    const actor = (id: string) =>
      pm.get(id) ?? { id, username: null, display_name: "Athlete", avatar_url: null };
    type Notif = {
      type: "follow" | "reaction" | "comment";
      actor: unknown;
      created_at: string;
      reaction?: string;
      postId?: string;
      snippet?: string;
    };
    const notifs: Notif[] = [];
    (followsRes.data ?? []).forEach((f) => {
      if (hidden.has(f.follower_id as string)) return;
      notifs.push({
        type: "follow",
        actor: actor(f.follower_id as string),
        created_at: f.created_at as string,
      });
    });
    (likesRes.data ?? []).forEach((l) => {
      if (hidden.has(l.user_id as string)) return;
      notifs.push({
        type: "reaction",
        actor: actor(l.user_id as string),
        created_at: l.created_at as string,
        reaction: l.reaction as string,
        postId: l.post_id as string,
      });
    });
    (commentsRes.data ?? []).forEach((c) => {
      if (hidden.has(c.user_id as string)) return;
      notifs.push({
        type: "comment",
        actor: actor(c.user_id as string),
        created_at: c.created_at as string,
        postId: c.post_id as string,
        snippet: String(c.content ?? "").slice(0, 80),
      });
    });
    notifs.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return notifs.slice(0, 40);
  },

  async toggleFollow(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    if (d.userId === userId) throw new Error("Can't follow self");
    const { data: existing } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", userId)
      .eq("following_id", d.userId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", d.userId);
      return { following: false };
    }
    await supabase.from("follows").insert({ follower_id: userId, following_id: d.userId });
    return { following: true };
  },

  async createDuel(data, req) {
    // NOTE: intentionally not requirePro. Duels are free on native iOS (where
    // Pro can't be sold — Guideline 3.1.1) and the server can't tell platforms
    // apart without a spoofable flag, so a server-side Pro gate would lock out
    // every iOS user. Web monetisation is gated in DuelsPanel instead.
    const { userId } = await requireAuth(req);
    const d = z
      .object({
        opponentId: z.string().uuid(),
        metric: z.enum(["volume", "sessions", "prs"]).default("volume"),
      })
      .parse(data);
    if (d.opponentId === userId) throw new Error("You can't duel yourself");
    // Respect blocks in both directions (App Store 1.2 — no dueling to harass).
    const blocked = await blockedUserIds(supabaseAdmin, userId);
    if (blocked.has(d.opponentId)) throw new Error("You can't duel this athlete");
    // Finalize any of this pair's expired duels first, so an ended-but-unviewed
    // duel doesn't permanently block a rematch.
    await finalizeExpiredDuelsForPair(userId, d.opponentId);
    const { data: existing, error: exErr } = await (supabaseAdmin as any)
      .from("duels")
      .select("id")
      .in("status", ["pending", "active"])
      .or(
        `and(challenger_id.eq.${userId},opponent_id.eq.${d.opponentId}),and(challenger_id.eq.${d.opponentId},opponent_id.eq.${userId})`,
      )
      .limit(1);
    if (exErr) throw new Error(exErr.message);
    if (existing && existing.length)
      throw new Error("You already have an open duel with this athlete");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("duels")
      .insert({
        challenger_id: userId,
        opponent_id: d.opponentId,
        metric: d.metric,
        status: "pending",
      })
      .select("id")
      .single();
    // The partial unique index rejects a concurrent duplicate — surface it kindly.
    if (error)
      throw new Error(
        /duels_open_pair/.test(error.message)
          ? "You already have an open duel with this athlete"
          : error.message,
      );
    return { id: row.id };
  },

  async respondDuel(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z
      .object({
        duelId: z.string().uuid(),
        action: z.enum(["accept", "decline", "cancel"]),
      })
      .parse(data);
    // Read under RLS (participants only); all writes go through the service role.
    const { data: duel } = await (supabase as any)
      .from("duels")
      .select("id, challenger_id, opponent_id, status")
      .eq("id", d.duelId)
      .maybeSingle();
    if (!duel) throw new Error("Duel not found");
    if (d.action === "cancel") {
      if (duel.challenger_id !== userId) throw new Error("Only the challenger can cancel");
      // Guard the transition on the row's current status to avoid TOCTOU races.
      const { data: upd } = await (supabaseAdmin as any)
        .from("duels")
        .update({ status: "cancelled" })
        .eq("id", d.duelId)
        .eq("status", "pending")
        .select("id");
      if (!upd || !upd.length) throw new Error("Can only cancel a pending duel");
      return { ok: true, status: "cancelled" };
    }
    if (duel.opponent_id !== userId) throw new Error("Only the challenged athlete can respond");
    if (d.action === "decline") {
      const { data: upd } = await (supabaseAdmin as any)
        .from("duels")
        .update({ status: "declined" })
        .eq("id", d.duelId)
        .eq("status", "pending")
        .select("id");
      if (!upd || !upd.length) throw new Error("This duel is no longer pending");
      return { ok: true, status: "declined" };
    }
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 86400000).toISOString(); // 7-day window
    const { data: upd } = await (supabaseAdmin as any)
      .from("duels")
      .update({ status: "active", start_at: now.toISOString(), end_at: end })
      .eq("id", d.duelId)
      .eq("status", "pending")
      .select("id");
    if (!upd || !upd.length) throw new Error("This duel is no longer pending");
    return { ok: true, status: "active" };
  },

  async getDuels(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    // Rows via RLS (participants only).
    const { data: duels, error } = await (supabase as any)
      .from("duels")
      .select(
        "id, challenger_id, opponent_id, metric, status, start_at, end_at, created_at, challenger_score, opponent_score, winner_id",
      )
      .in("status", ["pending", "active", "completed"])
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    type Row = {
      id: string;
      challenger_id: string;
      opponent_id: string;
      metric: string;
      status: string;
      start_at: string | null;
      end_at: string | null;
      created_at: string;
      challenger_score: number | null;
      opponent_score: number | null;
      winner_id: string | null;
    };
    const rows = (duels ?? []) as Row[];
    if (rows.length === 0) return [];

    const blocked = await blockedUserIds(supabaseAdmin, userId);
    const otherOf = (x: Row) => (x.challenger_id === userId ? x.opponent_id : x.challenger_id);
    const visible = rows.filter((x) => !blocked.has(otherOf(x)));
    if (visible.length === 0) return [];

    const otherIds = Array.from(new Set(visible.map(otherOf)));
    const { data: profs } = await supabaseAdmin
      .from("public_profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
    const pm = new Map((profs ?? []).map((p: { id: string | null }) => [p.id as string, p]));

    const out = [];
    for (const x of visible) {
      const iAmChallenger = x.challenger_id === userId;
      const otherId = otherOf(x);
      let myScore = 0,
        theirScore = 0,
        ended = false;

      if (x.status === "completed") {
        // Use the frozen final scores.
        myScore = Number((iAmChallenger ? x.challenger_score : x.opponent_score) ?? 0);
        theirScore = Number((iAmChallenger ? x.opponent_score : x.challenger_score) ?? 0);
        ended = true;
      } else if (x.status === "active") {
        const s = await duelScores(x);
        myScore = iAmChallenger ? s.challenger : s.opponent;
        theirScore = iAmChallenger ? s.opponent : s.challenger;
        if (x.end_at && Date.now() >= Date.parse(x.end_at)) {
          // Transition to completed once, persisting the final scores.
          ended = true;
          await (supabaseAdmin as any)
            .from("duels")
            .update({
              status: "completed",
              challenger_score: s.challenger,
              opponent_score: s.opponent,
              winner_id:
                s.challenger > s.opponent
                  ? x.challenger_id
                  : s.opponent > s.challenger
                    ? x.opponent_id
                    : null,
            })
            .eq("id", x.id)
            .eq("status", "active");
        }
      }

      out.push({
        id: x.id,
        metric: x.metric,
        status: ended && x.status === "active" ? "completed" : x.status,
        role: iAmChallenger ? "challenger" : "opponent",
        needsMyResponse: x.status === "pending" && !iAmChallenger,
        start_at: x.start_at,
        end_at: x.end_at,
        ended,
        myScore,
        theirScore,
        winner: ended
          ? myScore > theirScore
            ? "me"
            : theirScore > myScore
              ? "them"
              : "tie"
          : null,
        opponent: pm.get(otherId) ?? {
          id: otherId,
          username: null,
          display_name: "Athlete",
          avatar_url: null,
        },
      });
    }
    return out;
  },

  async searchAthletes(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ q: z.string().trim().min(1).max(40) }).parse(data);
    // Strip PostgREST filter metacharacters (,().) as well as ilike wildcards
    // (%_) so a crafted query can't inject extra clauses into the .or() below.
    const q = d.q.replace(/[%_,().]/g, "").trim();
    if (!q) return [];
    const { data: blocks } = await supabase
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const hidden = new Set<string>();
    (blocks ?? []).forEach((b) =>
      hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id),
    );
    const { data: rows, error } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, level")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq("id", userId)
      .limit(20);
    if (error) throw new Error(error.message);
    const filtered = (rows ?? []).filter((r) => r.id && !hidden.has(r.id as string));
    const ids = filtered.map((r) => r.id).filter((x): x is string => !!x);
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .in("following_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const followingSet = new Set((follows ?? []).map((f) => f.following_id));
    return filtered.map((r) => ({
      ...r,
      id: r.id as string,
      following: followingSet.has(r.id as string),
    }));
  },

  async getSuggestedAthletes(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const hidden = await blockedUserIds(supabase, userId);
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const followingSet = new Set((follows ?? []).map((f) => f.following_id));
    const { data: rows } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, grit_points")
      .neq("id", userId)
      .order("grit_points", { ascending: false })
      .limit(30);
    return (rows ?? [])
      .filter(
        (r): r is typeof r & { id: string } =>
          !!r.id && !followingSet.has(r.id) && !hidden.has(r.id),
      )
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        level: gritLevel(r.grit_points ?? 0),
        grit_points: r.grit_points ?? 0,
        following: false,
      }));
  },

  async getMyFollowStats(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const [{ count: following }, { count: followers }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId),
    ]);
    return { following: following ?? 0, followers: followers ?? 0 };
  },

  async getAthleteCard(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    const { data: row, error } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, bio, grit_points, public_stats")
      .eq("id", d.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Athlete not found");
    const [
      { data: follow },
      { data: followBack },
      { count: followers },
      { count: following },
      meRow,
    ] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", userId)
        .eq("following_id", d.userId)
        .maybeSingle(),
      userId === d.userId
        ? Promise.resolve({ data: null })
        : supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", d.userId)
            .eq("following_id", userId)
            .maybeSingle(),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", d.userId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", d.userId),
      userId === d.userId
        ? Promise.resolve(null)
        : supabase
            .from("public_profiles")
            .select("public_stats, grit_points")
            .eq("id", userId)
            .maybeSingle(),
    ]);
    return {
      ...row,
      level: gritLevel(row.grit_points ?? 0),
      following: !!follow,
      followsMe: !!followBack,
      followerCount: followers ?? 0,
      followingCount: following ?? 0,
      isMe: userId === d.userId,
      my_public_stats: (meRow as any)?.data?.public_stats ?? null,
      my_grit_points: (meRow as any)?.data?.grit_points ?? null,
    };
  },

  async getMyReferralInfo(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data: p } = await supabase
      .from("profiles")
      .select("referral_code, pro_until")
      .eq("id", userId)
      .single();
    const { count } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", userId);
    return { code: p?.referral_code ?? null, count: count ?? 0, proUntil: p?.pro_until ?? null };
  },

  async redeemReferral(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ code: z.string().min(4).max(16) }).parse(data);
    const code = d.code.trim().toUpperCase();
    const { data: owner, error: oErr } = await supabaseAdmin
      .from("profiles")
      .select("id, referral_code")
      .eq("referral_code", code)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!owner) throw new Error("Invalid code");
    if (owner.id === userId) throw new Error("Can't redeem your own code");
    const { error } = await supabase
      .from("referrals")
      .insert({ referrer_id: owner.id, referred_id: userId, code });
    if (error) {
      if (error.code === "23505") throw new Error("Already redeemed");
      throw new Error(error.message);
    }
    const month = new Date(Date.now() + 30 * 86400_000).toISOString();
    // Admin client: pro_until / referred_by are DB-protected against direct
    // authenticated writes (see the profiles column-guard trigger).
    await supabaseAdmin
      .from("profiles")
      .update({ pro_until: month, referred_by: owner.id })
      .eq("id", userId);
    const { data: rp } = await supabaseAdmin
      .from("profiles")
      .select("pro_until")
      .eq("id", owner.id)
      .single();
    const base =
      rp?.pro_until && new Date(rp.pro_until) > new Date() ? new Date(rp.pro_until) : new Date();
    await supabaseAdmin
      .from("profiles")
      .update({ pro_until: new Date(base.getTime() + 30 * 86400_000).toISOString() })
      .eq("id", owner.id);
    return { ok: true };
  },

  async updateMyProfile(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z
      .object({
        username: z
          .string()
          .min(3)
          .max(24)
          .regex(/^[a-zA-Z0-9_]+$/)
          .optional(),
        display_name: z.string().min(1).max(40).optional(),
        bio: z.string().max(160).optional(),
      })
      .parse(data);
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
    const d = z
      .object({
        city: z.string().trim().min(1).max(80),
        region: z.string().trim().max(80).optional().nullable(),
        country: z.string().trim().min(1).max(80),
      })
      .parse(data);
    const { error } = await supabase
      .from("profiles")
      .update({
        city: d.city,
        region: d.region ?? null,
        country: d.country,
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async getMyLocation(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data } = await supabase
      .from("profiles")
      .select("city, region, country")
      .eq("id", userId)
      .maybeSingle();
    return {
      city: data?.city ?? null,
      region: data?.region ?? null,
      country: data?.country ?? null,
    };
  },

  async getNearbyAthletes(_data, req) {
    const { supabase, userId } = await requireAuth(req);
    const { data: me } = await supabase
      .from("profiles")
      .select("city, country")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.city || !me?.country) return { athletes: [], myCity: null, myCountry: null };
    const { data: blocks } = await supabase
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const hidden = new Set<string>();
    (blocks ?? []).forEach((b) =>
      hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id),
    );
    const { data: same } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, level, grit_points, city, country")
      .ilike("city", me.city)
      .ilike("country", me.country)
      .neq("id", userId)
      .limit(30);
    const ids = (same ?? []).map((r) => r.id).filter((x): x is string => !!x);
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .in("following_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const fset = new Set((follows ?? []).map((f) => f.following_id));
    const athletes = (same ?? [])
      .filter((r) => r.id && !hidden.has(r.id as string))
      .map((r) => ({ ...r, id: r.id as string, following: fset.has(r.id as string) }));
    return { athletes, myCity: me.city, myCountry: me.country };
  },

  // === Library ===
  async listExercises(data, req) {
    const { supabase } = await requireAuth(req);
    const d = z
      .object({
        category: z.string().optional(),
        equipment: z.string().optional(),
        muscle: z.string().optional(),
        difficulty: z.number().int().min(1).max(5).optional(),
        search: z.string().max(80).optional(),
        limit: z.number().int().min(1).max(2000).default(300),
      })
      .parse(data);
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
    const { count, error } = await supabase
      .from("exercises")
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  },

  async lookupBarcode(data, req) {
    await requireAuth(req);
    const d = z.object({ barcode: z.string().regex(/^[0-9]{6,14}$/) }).parse(data);
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${d.barcode}.json`, {
      headers: { "User-Agent": "DEADSET-App/1.0" },
    });
    if (!res.ok) throw new Error("Lookup failed");
    const json = (await res.json()) as {
      status: number;
      product?: {
        product_name?: string;
        brands?: string;
        nutriments?: {
          "energy-kcal_100g"?: number;
          "energy-kcal_serving"?: number;
          proteins_100g?: number;
          proteins_serving?: number;
          carbohydrates_100g?: number;
          carbohydrates_serving?: number;
          fat_100g?: number;
          fat_serving?: number;
        };
        serving_size?: string;
      };
    };
    if (json.status !== 1 || !json.product) throw new Error("Product not found");
    const p = json.product;
    const n = p.nutriments || {};
    const hasServingNutrition = Number.isFinite(n["energy-kcal_serving"]);
    return {
      name: [p.brands, p.product_name].filter(Boolean).join(" — ") || "Unknown product",
      calories: Math.round(
        (hasServingNutrition ? n["energy-kcal_serving"] : n["energy-kcal_100g"]) ?? 0,
      ),
      protein: Math.round((hasServingNutrition ? n.proteins_serving : n.proteins_100g) ?? 0),
      carbs: Math.round(
        (hasServingNutrition ? n.carbohydrates_serving : n.carbohydrates_100g) ?? 0,
      ),
      fats: Math.round((hasServingNutrition ? n.fat_serving : n.fat_100g) ?? 0),
      serving: hasServingNutrition && p.serving_size ? p.serving_size : "100g",
    };
  },

  async searchFoods(data, req) {
    await requireAuth(req);
    const d = z.object({ query: z.string().trim().min(2).max(80) }).parse(data);
    const url = new URL("https://search.openfoodfacts.org/search");
    url.searchParams.set("q", d.query);
    url.searchParams.set("page_size", "18");
    const res = await fetch(url, {
      headers: { "User-Agent": "DEADSET-App/1.0 (https://deadsetfit.org)" },
    });
    if (!res.ok)
      throw Object.assign(new Error("Food search is temporarily unavailable"), { status: 503 });
    const json = (await res.json()) as {
      hits?: Array<{
        code?: string;
        product_name?: string;
        brands?: string | string[];
        serving_size?: string;
        nutriments?: Record<string, number>;
      }>;
    };
    const foods = (json.hits ?? []).flatMap((product, index) => {
      const brand = Array.isArray(product.brands) ? product.brands.join(", ") : product.brands;
      const name = [brand, product.product_name].filter(Boolean).join(" — ").trim();
      if (!name) return [];
      const n = product.nutriments ?? {};
      const hasServingNutrition = Number.isFinite(n["energy-kcal_serving"]);
      const suffix = hasServingNutrition ? "_serving" : "_100g";
      return [
        {
          id: product.code || `${index}-${name}`,
          name,
          serving: hasServingNutrition && product.serving_size ? product.serving_size : "100g",
          calories: Math.max(0, Math.round(n[`energy-kcal${suffix}`] ?? 0)),
          protein: Math.max(0, Math.round((n[`proteins${suffix}`] ?? 0) * 10) / 10),
          carbs: Math.max(0, Math.round((n[`carbohydrates${suffix}`] ?? 0) * 10) / 10),
          fats: Math.max(0, Math.round((n[`fat${suffix}`] ?? 0) * 10) / 10),
        },
      ];
    });
    return { foods };
  },

  // === Account ===
  async deleteMyAccount(_data, req) {
    const { userId } = await requireAuth(req);
    const admin = supabaseAdmin as any;
    const failures: string[] = [];

    /** Supabase returns { error } rather than throwing, so a try/catch around
     *  these calls catches nothing — every failure has to be read off the
     *  result. A missing table means there is no data to erase, which is not a
     *  failure. */
    const erase = async (label: string, build: () => any) => {
      const { error } = await build();
      if (!error) return;
      if (error.code === "42P01") return;
      failures.push(`${label}: ${error.message ?? error.code ?? "unknown error"}`);
    };

    // Other people's likes and comments sit on this user's posts with a foreign
    // key to them, so those have to go before the posts themselves — otherwise
    // the post delete fails and, previously, failed silently.
    const { data: ownPosts } = await admin.from("posts").select("id").eq("user_id", userId);
    const postIds = (ownPosts ?? []).map((post: { id: string }) => post.id);

    await erase("post_likes (by user)", () =>
      admin.from("post_likes").delete().eq("user_id", userId),
    );
    await erase("post_comments (by user)", () =>
      admin.from("post_comments").delete().eq("user_id", userId),
    );
    if (postIds.length > 0) {
      await erase("post_likes (on user's posts)", () =>
        admin.from("post_likes").delete().in("post_id", postIds),
      );
      await erase("post_comments (on user's posts)", () =>
        admin.from("post_comments").delete().in("post_id", postIds),
      );
    }
    await erase("posts", () => admin.from("posts").delete().eq("user_id", userId));
    await erase("follows", () =>
      admin.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`),
    );
    await erase("user_blocks", () =>
      admin.from("user_blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    );
    await erase("user_reports", () =>
      admin
        .from("user_reports")
        .delete()
        .or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`),
    );
    await erase("duels", () =>
      admin.from("duels").delete().or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`),
    );
    await erase("referrals", () =>
      admin.from("referrals").delete().or(`referrer_id.eq.${userId},referred_id.eq.${userId}`),
    );
    await erase("user_state", () => admin.from("user_state").delete().eq("user_id", userId));
    await erase("user_roles", () => admin.from("user_roles").delete().eq("user_id", userId));
    await erase("profiles", () => admin.from("profiles").delete().eq("id", userId));

    // `subscriptions` is deliberately left in place. It is a billing record, and
    // erasing it would hide a Stripe subscription that may still be charging a
    // card — Stripe, not this table, has to be cancelled first. Deleting the row
    // silently would turn a billing problem into an invisible one.

    // Deleting the login while personal data survives is the worst outcome: the
    // rows become orphans nobody can find, let alone erase on request. Deletion
    // is idempotent, so surfacing the failure lets the user retry and finish.
    if (failures.length > 0) {
      console.error("deleteMyAccount incomplete", { userId, failures });
      throw new Error(
        "We could not finish deleting your data, so your account is untouched. Please try again — if it keeps failing, contact support and it will be erased manually.",
      );
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async blockUser(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    if (d.userId === userId) throw new Error("Can't block yourself");
    await supabase
      .from("follows")
      .delete()
      .or(
        `and(follower_id.eq.${userId},following_id.eq.${d.userId}),and(follower_id.eq.${d.userId},following_id.eq.${userId})`,
      );
    const { error } = await supabase
      .from("user_blocks")
      .upsert(
        { blocker_id: userId, blocked_id: d.userId },
        { onConflict: "blocker_id,blocked_id" },
      );
    if (error) throw new Error(error.message);
    return { blocked: true };
  },

  async unblockUser(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", d.userId);
    if (error) throw new Error(error.message);
    return { blocked: false };
  },

  async isBlocked(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z.object({ userId: z.string().uuid() }).parse(data);
    const { data: row } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", userId)
      .eq("blocked_id", d.userId)
      .maybeSingle();
    return { blocked: !!row };
  },

  async reportContent(data, req) {
    const { supabase, userId } = await requireAuth(req);
    const d = z
      .object({
        userId: z.string().uuid().optional(),
        postId: z.string().uuid().optional(),
        reason: z.string().min(1).max(500),
      })
      .parse(data);
    if (!d.userId && !d.postId) throw new Error("Provide userId or postId");
    if (d.userId === userId) throw new Error("Can't report yourself");
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: userId,
      reported_user_id: d.userId ?? null,
      reported_post_id: d.postId ?? null,
      reason: d.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // === Admin: growth & revenue analytics (owner only) ===
  async adminStats(_data, req) {
    const { email } = await requireAuth(req);
    const ADMIN_EMAILS = ["theojandhyala@icloud.com"];
    if (!email || !ADMIN_EMAILS.includes(email.toLowerCase())) {
      throw Object.assign(new Error("Not authorized"), { status: 403 });
    }

    // Signups: one row per profile with created_at.
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id,username,display_name,created_at,city,country")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (pErr) throw new Error(pErr.message);

    const dayKey = (iso: string) => iso.slice(0, 10);
    const perDay = new Map<string, number>();
    for (const p of profiles ?? []) {
      if (!p.created_at) continue;
      const k = dayKey(p.created_at);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    // Last 30 days, zero-filled so the chart has a continuous axis.
    const signupsPerDay: { date: string; count: number }[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const k = cursor.toISOString().slice(0, 10);
      signupsPerDay.push({ date: k, count: perDay.get(k) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Subscriptions from our own table (webhook-fed).
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id,status,price_id,current_period_end,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    const now = Date.now();
    const activeSubs = (subs ?? []).filter(
      (s) =>
        ["active", "trialing", "past_due"].includes(s.status) &&
        (!s.current_period_end || new Date(s.current_period_end).getTime() > now),
    );
    const plans = new Map<string, number>();
    for (const s of activeSubs)
      plans.set(s.price_id ?? "unknown", (plans.get(s.price_id ?? "unknown") ?? 0) + 1);

    // Acquisition sources, harvested from each user's synced app state.
    const sources = new Map<string, number>();
    const engagement = {
      syncedUsers: 0,
      onboardedUsers: 0,
      startedWorkoutUsers: 0,
      finishedWorkoutUsers: 0,
      active7DayUsers: 0,
      active30DayUsers: 0,
      completedWorkouts: 0,
    };
    try {
      const { data: states } = await supabaseAdmin.from("user_state").select("data").limit(2000);
      for (const row of states ?? []) {
        const appState = row.data as {
          profile?: unknown;
          schedule?: unknown;
          signupSource?: { source?: string };
          completedDates?: string[];
          sessions?: { date?: string; startedAt?: string; endedAt?: string }[];
        } | null;
        const src = appState?.signupSource?.source;
        sources.set(src || "unknown", (sources.get(src || "unknown") ?? 0) + 1);

        engagement.syncedUsers++;
        if (appState?.profile && appState.schedule) engagement.onboardedUsers++;

        const sessions = Array.isArray(appState?.sessions) ? appState.sessions : [];
        const completedDates = Array.isArray(appState?.completedDates)
          ? appState.completedDates
          : [];
        if (sessions.length) engagement.startedWorkoutUsers++;

        const completedSessions = sessions.filter((session) => Boolean(session.endedAt));
        engagement.completedWorkouts += completedSessions.length;
        if (completedSessions.length || completedDates.length) engagement.finishedWorkoutUsers++;

        const activityTimes = [
          ...sessions.map((session) => session.endedAt || session.startedAt || session.date),
          ...completedDates,
        ]
          .filter((value): value is string => Boolean(value))
          .map((value) => new Date(value).getTime())
          .filter(Number.isFinite);
        const latestActivity = activityTimes.length ? Math.max(...activityTimes) : 0;
        if (latestActivity >= now - 7 * 86_400_000) engagement.active7DayUsers++;
        if (latestActivity >= now - 30 * 86_400_000) engagement.active30DayUsers++;
      }
    } catch {
      /* attribution is best-effort */
    }

    return {
      totalUsers: profiles?.length ?? 0,
      signupsPerDay,
      recentSignups: (profiles ?? []).slice(0, 15).map((p) => ({
        username: p.username,
        displayName: p.display_name,
        date: p.created_at,
        location: [p.city, p.country].filter(Boolean).join(", ") || null,
      })),
      activeSubscriptions: activeSubs.length,
      subscriptionPlans: [...plans.entries()].map(([plan, count]) => ({ plan, count })),
      sources: [...sources.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      engagement,
    };
  },
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body: { fn?: string; data?: unknown };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const { fn, data } = body ?? {};
  if (!fn || typeof fn !== "string") {
    res.status(400).json({ error: "Missing fn" });
    return;
  }

  // Alias: social leaderboard is called as 'getLeaderboard' from social context
  // and leaderboard.functions calls it the same name. Disambiguate by mapping
  // 'getSocialLeaderboard' from social.functions.ts.
  const handlerFn = handlers[fn];
  if (!handlerFn) {
    res.status(404).json({ error: `Unknown function: ${fn}` });
    return;
  }

  try {
    const result = await handlerFn(data, req);
    res.status(200).json({ result });
  } catch (err: any) {
    const status =
      err?.status === 401 ? 401 : err?.status === 403 ? 403 : err instanceof z.ZodError ? 400 : 500;
    res.status(status).json({ error: err?.message ?? "Internal server error" });
  }
}
