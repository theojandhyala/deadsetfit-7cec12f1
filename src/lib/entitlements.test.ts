import { describe, expect, it } from "vitest";
import { stripeId, subscriptionPayload, subscriptionStillUnlocksPro } from "./entitlements";

const NOW = new Date("2026-07-29T12:00:00.000Z");

function subscription(overrides: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    metadata: { userId: "user-1" },
    cancel_at_period_end: false,
    items: {
      data: [
        {
          current_period_start: 1785000000,
          current_period_end: 1787678400,
          price: { id: "price_1", product: "prod_1" },
          ...item,
        },
      ],
    },
    ...overrides,
  };
}

describe("subscriptionPayload", () => {
  it("maps a live subscription to the entitlement row", () => {
    expect(subscriptionPayload(subscription(), "live", NOW)).toEqual({
      user_id: "user-1",
      stripe_subscription_id: "sub_1",
      stripe_customer_id: "cus_1",
      product_id: "prod_1",
      price_id: "price_1",
      status: "active",
      current_period_start: "2026-07-25T17:20:00.000Z",
      current_period_end: "2026-08-25T17:20:00.000Z",
      cancel_at_period_end: false,
      environment: "live",
      updated_at: NOW.toISOString(),
    });
  });

  it("prefers the item's period bounds over the legacy top-level ones", () => {
    const row = subscriptionPayload(
      subscription({ current_period_start: 1, current_period_end: 2 }),
      "live",
      NOW,
    );

    expect(row.current_period_start).toBe("2026-07-25T17:20:00.000Z");
    expect(row.current_period_end).toBe("2026-08-25T17:20:00.000Z");
  });

  it("falls back to top-level period bounds when the item has none", () => {
    const row = subscriptionPayload(
      subscription(
        { current_period_start: 1785000000, current_period_end: 1787678400 },
        { current_period_start: undefined, current_period_end: undefined },
      ),
      "live",
      NOW,
    );

    expect(row.current_period_start).toBe("2026-07-25T17:20:00.000Z");
    expect(row.current_period_end).toBe("2026-08-25T17:20:00.000Z");
  });

  it("leaves period bounds null when neither level has them", () => {
    const row = subscriptionPayload(
      subscription({}, { current_period_start: undefined, current_period_end: undefined }),
      "live",
      NOW,
    );

    expect(row.current_period_start).toBeNull();
    expect(row.current_period_end).toBeNull();
  });

  it("resolves the price id by lookup_key, then the legacy tag, then the id", () => {
    const byLookup = subscriptionPayload(
      subscription({}, { price: { id: "price_1", lookup_key: "pro_monthly", product: "prod_1" } }),
      "live",
      NOW,
    );
    const byLegacyTag = subscriptionPayload(
      subscription(
        {},
        { price: { id: "price_1", metadata: { lovable_external_id: "legacy_pro" } } },
      ),
      "live",
      NOW,
    );

    expect(byLookup.price_id).toBe("pro_monthly");
    expect(byLegacyTag.price_id).toBe("legacy_pro");
  });

  it("handles expanded customer and product objects", () => {
    const row = subscriptionPayload(
      subscription({ customer: { id: "cus_expanded" } }, { price: { product: { id: "prod_x" } } }),
      "sandbox",
      NOW,
    );

    expect(row.stripe_customer_id).toBe("cus_expanded");
    expect(row.product_id).toBe("prod_x");
    expect(row.environment).toBe("sandbox");
  });

  it("does not invent an id when Stripe sends none", () => {
    const row = subscriptionPayload(
      subscription({ customer: null, status: undefined }, { price: {} }),
      "live",
      NOW,
    );

    expect(row.stripe_customer_id).toBe("unknown");
    expect(row.price_id).toBe("unknown");
    expect(row.status).toBe("unknown");
  });

  it("leaves user_id undefined when the checkout carried no userId", () => {
    expect(
      subscriptionPayload(subscription({ metadata: {} }), "live", NOW).user_id,
    ).toBeUndefined();
  });
});

describe("subscriptionStillUnlocksPro", () => {
  const future = "2026-08-24T00:00:00.000Z";
  const past = "2026-07-01T00:00:00.000Z";

  it("keeps Pro through a failed payment retry window", () => {
    expect(subscriptionStillUnlocksPro("past_due", future, NOW)).toBe(true);
  });

  it("unlocks for active and trialing", () => {
    expect(subscriptionStillUnlocksPro("active", future, NOW)).toBe(true);
    expect(subscriptionStillUnlocksPro("trialing", null, NOW)).toBe(true);
  });

  it("honours a cancelled subscription until the paid period ends", () => {
    expect(subscriptionStillUnlocksPro("canceled", future, NOW)).toBe(true);
    expect(subscriptionStillUnlocksPro("canceled", past, NOW)).toBe(false);
    expect(subscriptionStillUnlocksPro("canceled", null, NOW)).toBe(false);
  });

  it("does not unlock for unpaid, incomplete, or missing status", () => {
    expect(subscriptionStillUnlocksPro("unpaid", future, NOW)).toBe(false);
    expect(subscriptionStillUnlocksPro("incomplete_expired", future, NOW)).toBe(false);
    expect(subscriptionStillUnlocksPro(null, future, NOW)).toBe(false);
    expect(subscriptionStillUnlocksPro(undefined, null, NOW)).toBe(false);
  });
});

describe("stripeId", () => {
  it("accepts a bare id, an expanded object, and rejects anything else", () => {
    expect(stripeId("cus_1")).toBe("cus_1");
    expect(stripeId({ id: "cus_1" })).toBe("cus_1");
    expect(stripeId({ id: 7 })).toBeNull();
    expect(stripeId(null)).toBeNull();
    expect(stripeId(undefined)).toBeNull();
  });
});
