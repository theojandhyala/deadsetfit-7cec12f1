export const DEADSET_TRIAL_DAYS = 7;
export const DEADSET_MONTHLY_PRICE_GBP = "£5.99";

const ACCOUNT_ESCAPE_ROUTES = new Set(["/profile"]);

/**
 * The subscription wall must cover the training product without trapping an
 * athlete away from purchase recovery, logout, or account deletion.
 */
export function requiresPaidAccess(options: {
  ready: boolean;
  hasProfile: boolean;
  entitlementLoading: boolean;
  hasEntitlement: boolean;
  pathname: string;
}): boolean {
  if (!options.ready || !options.hasProfile || options.entitlementLoading) return false;
  if (options.hasEntitlement) return false;
  return !ACCOUNT_ESCAPE_ROUTES.has(options.pathname);
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
  if (offer?.paymentMode !== "freeTrial") return false;
  const units = (offer.periodValue ?? 0) * (offer.periodCount ?? 1);
  return offer.periodUnit === "week" && units === 1;
}
