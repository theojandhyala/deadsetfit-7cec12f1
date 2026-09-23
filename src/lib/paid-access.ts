export const DEADSET_TRIAL_DAYS = 7;
export const DEADSET_MONTHLY_PRICE_GBP = "£5.99";

/**
 * DEADSET has a usable free training tier. Entitlements are enforced at the
 * individual feature boundary (analytics, Autopilot, advanced programming,
 * leagues, etc.), never as a blanket lock around the athlete's own plan and
 * workout log. Keeping this predicate makes the shell's intent explicit and
 * prevents a future billing refactor from accidentally trapping free members.
 */
export function requiresPaidAccess(_options: {
  ready: boolean;
  hasProfile: boolean;
  entitlementLoading: boolean;
  hasEntitlement: boolean;
  pathname: string;
}): boolean {
  return false;
}

export function isSevenDayFreeTrial(
  offer:
    | {
        paymentMode?: string;
        periodUnit?: string;
        periodValue?: number;
        periodCount?: number;
      }
    | null
    | undefined,
): boolean {
  // StoreKit's Swift raw values are capitalised (`FreeTrial`, `Week`). The
  // native bridge normalises them, and this defensive normalisation keeps the
  // disclosure correct if an older bridge payload is restored from a webview.
  const paymentMode = offer?.paymentMode?.replace(/[^a-z]/gi, "").toLowerCase();
  const periodUnit = offer?.periodUnit?.trim().toLowerCase();
  if (paymentMode !== "freetrial") return false;
  const units = (offer?.periodValue ?? 0) * (offer?.periodCount ?? 1);
  return periodUnit === "week" && units === 1;
}
