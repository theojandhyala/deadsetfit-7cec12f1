const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-900/40 border-b border-red-700 px-4 py-2 text-center text-xs text-red-200 uppercase tracking-widest">
        Production checkout not configured. Add the Stripe publishable key to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-amber-900/40 border-b border-amber-700 px-4 py-1.5 text-center text-[10px] text-amber-200 uppercase tracking-widest">
        Test mode — no real charges
      </div>
    );
  }
  return null;
}
