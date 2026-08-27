/**
 * How a Stripe subscription becomes DEADSET Pro.
 *
 * Extracted from the webhook handler so the reconciliation script
 * (scripts/reconcile-entitlements.ts) applies byte-identical rules. When these
 * lived only inside the worker, an audit could only ever approximate them, and
 * an approximation that grants or revokes Pro is worse than no audit.
 */

export type StripeEnv = "sandbox" | "live";

export type SubscriptionRow = {
  user_id: string | undefined;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: StripeEnv;
  updated_at: string;
};

/** Stripe fields are either an id or an expanded object depending on the call. */
export function stripeId(value: unknown): string | null {
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

export function subscriptionPayload(
  subscription: any,
  stripeEnv: StripeEnv,
  now = new Date(),
): SubscriptionRow {
  const item = subscription.items?.data?.[0];
  const price = item?.price ?? {};
  // Stripe moved period bounds onto the item; older subscriptions still carry
  // them at the top level.
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  // `lovable_external_id` is a leftover tag on prices created before the Stripe
  // account move; it still identifies those prices, so it stays in the chain.
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
    updated_at: now.toISOString(),
  };
}

/**
 * A Pro entitlement must reflect a successful payment. `trialing` has
 * collected no money and `past_due` has a failed collection. A cancelled
 * subscription remains valid only through the period already paid for.
 */
export function subscriptionStillUnlocksPro(
  status: string | null | undefined,
  periodEnd: string | null,
  now = new Date(),
): boolean {
  return (
    status === "active" ||
    (status === "canceled" && !!periodEnd && new Date(periodEnd) > now)
  );
}
