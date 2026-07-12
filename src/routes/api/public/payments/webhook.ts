import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type StripeEnv = "sandbox" | "live";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    _supabase = createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

// Some deployed databases predate the `product_id` / `environment` /
// `current_period_start` columns. Retry writes without the optional columns
// when the DB rejects them, and surface any remaining error so Stripe retries.
const OPTIONAL_COLUMNS = ["product_id", "environment", "current_period_start"];

function stripOptionalColumns(row: Record<string, unknown>) {
  const copy = { ...row };
  for (const col of OPTIONAL_COLUMNS) delete copy[col];
  return copy;
}

function isMissingColumnError(error: { message?: string } | null): boolean {
  return !!error?.message && /column .* does not exist|could not find .* column/i.test(error.message);
}

async function upsertSubscription(row: Record<string, unknown>) {
  const sb = getSupabase();
  let { error } = await sb
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  if (isMissingColumnError(error)) {
    ({ error } = await sb
      .from("subscriptions")
      .upsert(stripOptionalColumns(row), { onConflict: "stripe_subscription_id" }));
  }
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
}

async function updateSubscription(stripeSubscriptionId: string, patch: Record<string, unknown>) {
  const sb = getSupabase();
  let { error } = await sb
    .from("subscriptions")
    .update(patch)
    .eq("stripe_subscription_id", stripeSubscriptionId);
  if (isMissingColumnError(error)) {
    ({ error } = await sb
      .from("subscriptions")
      .update(stripOptionalColumns(patch))
      .eq("stripe_subscription_id", stripeSubscriptionId));
  }
  if (error) throw new Error(`subscriptions update failed: ${error.message}`);
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await upsertSubscription({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    product_id: productId,
    price_id: priceId,
    status: subscription.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    environment: env,
    updated_at: new Date().toISOString(),
  });
}

async function handleSubscriptionUpdated(subscription: any, _env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await updateSubscription(subscription.id, {
    status: subscription.status,
    product_id: productId,
    price_id: priceId,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  });
}

async function handleSubscriptionDeleted(subscription: any, _env: StripeEnv) {
  await updateSubscription(subscription.id, {
    status: "canceled",
    updated_at: new Date().toISOString(),
  });
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const { verifyWebhook } = await import("@/lib/stripe.server");
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          // 500 (not 400) so Stripe retries transient DB failures.
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
