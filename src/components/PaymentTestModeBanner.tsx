import { isNativeIos } from "@/lib/platform";
import { paymentBannerState } from "@/lib/payment-banner-state";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  const state = paymentBannerState(clientToken, isNativeIos());
  if (state === "hidden") return null;
  if (state === "unavailable") {
    return (
      <div className="w-full bg-red-900/40 border-b border-red-700 px-4 py-2 text-center text-xs text-red-200 uppercase tracking-widest">
        Secure web checkout is temporarily unavailable. Use the DEADSET iPhone app to subscribe.
      </div>
    );
  }
  return (
    <div className="w-full bg-amber-900/40 border-b border-amber-700 px-4 py-1.5 text-center text-[10px] text-amber-200 uppercase tracking-widest">
      Web checkout preview — no real charges
    </div>
  );
}
