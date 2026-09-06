import { describe, expect, it } from "vitest";

import { isRevenueCatRuntimeAvailable, revenueCatProFromCustomerInfo } from "./revenuecat";

describe("RevenueCat configuration", () => {
  it("only initializes for a native iOS build with an Apple public SDK key", () => {
    expect(isRevenueCatRuntimeAvailable(true, "appl_validPublicSdkKey")).toBe(true);
    expect(isRevenueCatRuntimeAvailable(false, "appl_validPublicSdkKey")).toBe(false);
    expect(isRevenueCatRuntimeAvailable(true, "goog_wrongPlatformKey")).toBe(false);
    expect(isRevenueCatRuntimeAvailable(true, "")).toBe(false);
  });

  it("maps the active Pro entitlement without granting access from inactive records", () => {
    expect(
      revenueCatProFromCustomerInfo({
        entitlements: {
          active: {
            pro: {
              isActive: true,
              productIdentifier: "org.deadsetfit.pro.annual",
              expirationDate: "2027-08-20T12:00:00Z",
              willRenew: true,
            },
          },
        },
      } as never),
    ).toEqual({
      active: true,
      productId: "org.deadsetfit.pro.annual",
      expirationDate: "2027-08-20T12:00:00Z",
      willRenew: true,
    });

    expect(revenueCatProFromCustomerInfo({ entitlements: { active: {} } } as never)).toEqual({
      active: false,
      productId: null,
      expirationDate: null,
      willRenew: false,
    });
  });

  it("never grants fallback access when trusted entitlement verification fails", () => {
    const entitlement = {
      isActive: true,
      productIdentifier: "org.deadsetfit.pro.monthly",
      expirationDate: "2026-09-20T12:00:00Z",
      willRenew: true,
      verification: "FAILED",
    };

    expect(
      revenueCatProFromCustomerInfo({
        entitlements: {
          active: { pro: entitlement },
          verification: "FAILED",
        },
      } as never).active,
    ).toBe(false);
  });
});
