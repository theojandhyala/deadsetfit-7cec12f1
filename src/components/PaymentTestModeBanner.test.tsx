import { describe, expect, it } from "vitest";

import { paymentBannerState } from "@/lib/payment-banner-state";

describe("paymentBannerState", () => {
  it("never exposes Stripe setup or test-mode banners inside the iPhone app", () => {
    expect(paymentBannerState(undefined, true)).toBe("hidden");
    expect(paymentBannerState("pk_test_example", true)).toBe("hidden");
  });

  it("hides the banner for live web checkout", () => {
    expect(paymentBannerState("pk_live_example", false)).toBe("hidden");
  });

  it("keeps test and unavailable states limited to the website", () => {
    expect(paymentBannerState("pk_test_example", false)).toBe("test");
    expect(paymentBannerState(undefined, false)).toBe("unavailable");
  });
});
