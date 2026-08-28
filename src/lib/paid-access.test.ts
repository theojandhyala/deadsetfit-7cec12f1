import { describe, expect, it } from "vitest";

import { isSevenDayFreeTrial, requiresPaidAccess } from "./paid-access";

describe("requiresPaidAccess", () => {
  const base = {
    ready: true,
    hasProfile: true,
    entitlementLoading: false,
    hasEntitlement: false,
    pathname: "/train",
  };

  it("gates the training app after onboarding when there is no entitlement", () => {
    expect(requiresPaidAccess(base)).toBe(true);
  });

  it("never traps an athlete away from account controls", () => {
    expect(requiresPaidAccess({ ...base, pathname: "/profile" })).toBe(false);
  });

  it("waits for bootstrap and entitlement checks instead of flashing a paywall", () => {
    expect(requiresPaidAccess({ ...base, ready: false })).toBe(false);
    expect(requiresPaidAccess({ ...base, entitlementLoading: true })).toBe(false);
    expect(requiresPaidAccess({ ...base, hasProfile: false })).toBe(false);
  });

  it("does not gate an active subscriber", () => {
    expect(requiresPaidAccess({ ...base, hasEntitlement: true })).toBe(false);
  });
});

describe("isSevenDayFreeTrial", () => {
  it("accepts only an exact one-week free introductory offer", () => {
    expect(
      isSevenDayFreeTrial({
        paymentMode: "freeTrial",
        periodUnit: "week",
        periodValue: 1,
        periodCount: 1,
      }),
    ).toBe(true);
    expect(
      isSevenDayFreeTrial({
        paymentMode: "payAsYouGo",
        periodUnit: "week",
        periodValue: 1,
        periodCount: 1,
      }),
    ).toBe(false);
    expect(
      isSevenDayFreeTrial({
        paymentMode: "freeTrial",
        periodUnit: "month",
        periodValue: 1,
        periodCount: 1,
      }),
    ).toBe(false);
  });
});
