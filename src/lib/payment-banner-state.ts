export type PaymentBannerState = "hidden" | "test" | "unavailable";

/**
 * StoreKit owns checkout inside the iPhone app, so Stripe configuration must
 * never leak into the native experience. Keeping this decision synchronous
 * also prevents the web banner flashing for one frame while React effects run.
 */
export function paymentBannerState(
  token: string | undefined,
  nativeIos: boolean,
): PaymentBannerState {
  if (nativeIos || token?.startsWith("pk_live_")) return "hidden";
  if (token?.startsWith("pk_test_")) return "test";
  return "unavailable";
}
