import rpcHandler from "../api/rpc";
import { createClient } from "@supabase/supabase-js";

interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_LIVE_API_KEY?: string;
  STRIPE_SANDBOX_API_KEY?: string;
  PAYMENTS_LIVE_WEBHOOK_SECRET?: string;
  PAYMENTS_SANDBOX_WEBHOOK_SECRET?: string;
  VITE_PAYMENTS_CLIENT_TOKEN?: string;
}

type StripeEnv = "sandbox" | "live";
type StripeEvent = { type: string; data: { object: any } };

const RUNTIME_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_LIVE_API_KEY",
  "STRIPE_SANDBOX_API_KEY",
  "PAYMENTS_LIVE_WEBHOOK_SECRET",
  "PAYMENTS_SANDBOX_WEBHOOK_SECRET",
  "VITE_PAYMENTS_CLIENT_TOKEN",
] as const;

const RUNTIME_ENV_GLOBAL = "__DEADSET_RUNTIME_ENV__";

function configured(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function installRuntimeEnv(env: Env) {
  const runtimeEnv = (globalThis as unknown as Record<string, Record<string, string>>)[RUNTIME_ENV_GLOBAL] ?? {};
  for (const key of RUNTIME_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) {
      runtimeEnv[key] = value;
      if (typeof process !== "undefined" && process.env) process.env[key] = value;
    }
  }
  (globalThis as unknown as Record<string, Record<string, string>>)[RUNTIME_ENV_GLOBAL] = runtimeEnv;
}

function requestHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

async function handleRpc(request: Request): Promise<Response> {
  let status = 200;
  let body = "";
  const headers = new Headers();

  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return response;
    },
    status(code: number) {
      status = code;
      return response;
    },
    json(value: unknown) {
      headers.set("Content-Type", "application/json; charset=utf-8");
      body = JSON.stringify(value);
      return response;
    },
    end(value?: unknown) {
      body = value == null ? "" : String(value);
      return response;
    },
  };

  let parsedBody: unknown;
  if (request.method !== "OPTIONS") {
    try {
      parsedBody = await request.json();
    } catch {
      parsedBody = undefined;
    }
  }

  await rpcHandler(
    {
      method: request.method,
      headers: requestHeaders(request.headers),
      body: parsedBody,
    },
    response,
  );

  return new Response(body, { status, headers });
}

function handleHealth(env: Env): Response {
  return Response.json({
    ok: true,
    app: "deadset",
    runtime: "cloudflare-worker",
    time: new Date().toISOString(),
    services: {
      supabase:
        configured(env.SUPABASE_URL) &&
        configured(env.SUPABASE_PUBLISHABLE_KEY) &&
        configured(env.SUPABASE_SERVICE_ROLE_KEY),
      stripeLive:
        configured(env.STRIPE_LIVE_API_KEY) &&
        configured(env.VITE_PAYMENTS_CLIENT_TOKEN),
      stripeWebhook: configured(env.PAYMENTS_LIVE_WEBHOOK_SECRET),
    },
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyStripeWebhook(
  request: Request,
  stripeEnv: StripeEnv,
  env: Env,
): Promise<StripeEvent> {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  const secret =
    stripeEnv === "live"
      ? required(env.PAYMENTS_LIVE_WEBHOOK_SECRET, "PAYMENTS_LIVE_WEBHOOK_SECRET")
      : required(env.PAYMENTS_SANDBOX_WEBHOOK_SECRET, "PAYMENTS_SANDBOX_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1" && value) v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = hex(signed);
  if (!v1Signatures.some((actual) => safeEqual(actual, expected))) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(body) as StripeEvent;
}

function getSupabaseAdmin(env: Env) {
  return createClient(
    required(env.SUPABASE_URL, "SUPABASE_URL"),
    required(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function stripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "string"
  ) {
    return (value as { id: string }).id;
  }
  return null;
}

function subscriptionPayload(subscription: any, stripeEnv: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const price = item?.price ?? {};
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const priceId = price.lookup_key || price.metadata?.lovable_external_id || price.id || "unknown";
  const productId = stripeId(price.product) || "unknown";

  return {
    user_id: subscription.metadata?.userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: stripeId(subscription.customer) || "unknown",
    product_id: productId,
    price_id: priceId,
    status: subscription.status || "unknown",
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!subscription.cancel_at_period_end,
    environment: stripeEnv,
    updated_at: new Date().toISOString(),
  };
}

function subscriptionStillUnlocksPro(status: string | null | undefined, periodEnd: string | null): boolean {
  return ["active", "trialing", "past_due"].includes(status ?? "")
    || (status === "canceled" && !!periodEnd && new Date(periodEnd) > new Date());
}

async function syncWebhookProfileEntitlement(
  env: Env,
  userId: string | undefined,
  status: string | null,
  periodEnd: string | null,
) {
  if (!userId) return;
  if (!subscriptionStillUnlocksPro(status, periodEnd)) return;
  const { error } = await getSupabaseAdmin(env)
    .from("profiles")
    .update({ pro_until: periodEnd })
    .eq("id", userId);
  if (error) throw error;
}

async function handleSubscriptionCreated(subscription: any, stripeEnv: StripeEnv, env: Env) {
  const payload = subscriptionPayload(subscription, stripeEnv);
  if (!payload.user_id) return;
  const { error } = await getSupabaseAdmin(env)
    .from("subscriptions")
    .upsert(payload, { onConflict: "stripe_subscription_id" });
  if (error) throw error;
  await syncWebhookProfileEntitlement(env, payload.user_id, payload.status, payload.current_period_end);
}

async function handleSubscriptionUpdated(subscription: any, stripeEnv: StripeEnv, env: Env) {
  const payload = subscriptionPayload(subscription, stripeEnv);
  const admin = getSupabaseAdmin(env);
  const { data: existing } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", payload.stripe_subscription_id)
    .eq("environment", stripeEnv)
    .maybeSingle();
  const mergedPayload = { ...payload, user_id: payload.user_id ?? existing?.user_id };
  const { error } = await admin
    .from("subscriptions")
    .upsert(mergedPayload, { onConflict: "stripe_subscription_id" });
  if (error) throw error;
  await syncWebhookProfileEntitlement(env, mergedPayload.user_id, mergedPayload.status, mergedPayload.current_period_end);
}

async function handleSubscriptionDeleted(subscription: any, stripeEnv: StripeEnv, env: Env) {
  const { error } = await getSupabaseAdmin(env)
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", stripeEnv);
  if (error) throw error;
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  const rawEnv = url.searchParams.get("env");
  if (rawEnv !== "live" && rawEnv !== "sandbox") {
    return Response.json({ received: true, ignored: "invalid env" });
  }

  try {
    const event = await verifyStripeWebhook(request, rawEnv, env);
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object, rawEnv, env);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object, rawEnv, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, rawEnv, env);
        break;
      default:
        break;
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error", error);
    return new Response("Webhook error", { status: 400 });
  }
}

/** Live-tests the stored Stripe key with a read-only call. Returns only
 *  ok/error text — never key material. Lets us catch a rolled/expired key
 *  from the outside instead of discovering it via a failed checkout. */
async function handleStripeHealth(env: Env): Promise<Response> {
  installRuntimeEnv(env);
  try {
    const { createStripeClient } = await import("./lib/stripe.server");
    const stripe = createStripeClient("live");
    // Report the account id so we can confirm the server key and the
    // front-end publishable key are on the SAME Stripe account. Account
    // ids are not secret (they appear in every publishable key).
    // Confirm the key works and surface which account it belongs to, so we
    // can verify the server key and front-end publishable key match. The
    // account id is not secret (it is embedded in every publishable key).
    // `GET /v1/account` (no id) returns the key's own account — the SDK types
    // require an id arg, so call through a cast.
    const retrieveOwn = stripe.accounts.retrieve as (...a: unknown[]) => Promise<{ id: string }>;
    const account = await retrieveOwn();
    return Response.json(
      { ok: true, stripeLiveKey: "valid", account: account.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return Response.json(
      { ok: false, stripeLiveKey: "FAILED", error: message.slice(0, 200) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    installRuntimeEnv(env);
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return handleHealth(env);
    if (url.pathname === "/api/health/stripe") return handleStripeHealth(env);
    if (url.pathname === "/api/public/payments/webhook") return handleStripeWebhook(request, env);
    if (url.pathname === "/api/rpc") return handleRpc(request);
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
