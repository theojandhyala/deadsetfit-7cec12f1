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
  // StoreKit's Swift raw values are capitalised (`FreeTrial`, `Week`). The
  // native bridge normalises them, and this defensive normalisation keeps the
  // disclosure correct if an older bridge payload is restored from a webview.
  const paymentMode = offer?.paymentMode?.replace(/[^a-z]/gi, "").toLowerCase();
  const periodUnit = offer?.periodUnit?.trim().toLowerCase();
  if (paymentMode !== "freetrial") return false;
  const units = (offer?.periodValue ?? 0) * (offer?.periodCount ?? 1);
  return periodUnit === "week" && units === 1;
}
