import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Crown, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { usePro } from "@/hooks/usePro";
import { detectCountry, currencyForCountry, CURRENCY_META, priceIdFor, type SupportedCurrency } from "@/lib/currency";

export const Route = createFileRoute("/upgrade")({
  head: () => ({ meta: [{ title: "DEADSET — Go Pro" }] }),
  component: UpgradePage,
});

const PERKS = [
  "AI Coach — unlimited personalized advice",
  "Featured programs (5/3/1, nSuns, PHUL, Arnold, more)",
  "Advanced PR analytics & progression charts",
  "Share workouts & PR cards",
  "Priority support",
];

function UpgradePage() {
  const navigate = useNavigate();
  const { isPro, loading } = usePro();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [currency, setCurrency] = useState<SupportedCurrency>("usd");
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate({ to: "/auth" }); return; }
      setUser({ id: session.user.id, email: session.user.email ?? undefined });
    });
    detectCountry().then((c) => setCurrency(currencyForCountry(c)));
  }, [navigate]);

  const priceLabels = CURRENCY_META[currency];
  const priceId = priceIdFor(plan, currency);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-grit-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-grit" size={24} />
      </div>
    );
  }

  if (isPro) {
    return (
      <div className="min-h-screen bg-grit-bg flex flex-col items-center justify-center px-6 text-center">
        <Crown size={48} className="text-accent-red mb-4" />
        <h1 className="font-display text-3xl uppercase tracking-wider text-grit-text">You're Pro</h1>
        <p className="mt-2 text-sm text-grit">All features unlocked. Train hard.</p>
        <Link to="/train" className="mt-6 rounded bg-accent-red px-6 py-3 font-display text-sm uppercase tracking-widest text-white">
          Back to training
        </Link>
        <Link to="/settings" className="mt-3 text-xs text-grit uppercase tracking-widest hover:text-grit-text">
          Manage subscription
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grit-bg" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <PaymentTestModeBanner />
      <div className="px-4 py-4">
        <button onClick={() => navigate({ to: "/train" })} className="flex items-center gap-1 text-grit hover:text-grit-text">
          <ChevronLeft size={18} /> <span className="text-xs uppercase tracking-widest">Back</span>
        </button>
      </div>

      {!showCheckout ? (
        <div className="px-5 pb-12">
          <div className="flex items-center gap-2 mb-2">
            <Crown size={18} className="text-accent-red" />
            <span className="font-display text-xs uppercase tracking-widest text-accent-red">DEADSET Pro</span>
          </div>
          <h1 className="font-display text-4xl uppercase tracking-wider text-grit-text leading-tight">
            Train smarter.<br />Lift heavier.
          </h1>
          <p className="mt-2 text-sm text-grit">Everything you need to push past plateaus.</p>
          <p className="mt-1 text-xs uppercase tracking-widest font-bold" style={{ color: "#e63222" }}>Join 2,400+ athletes</p>

          <ul className="mt-6 space-y-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm text-grit-text">
                <Check size={16} className="text-accent-red mt-0.5 shrink-0" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          {/* Free vs Pro comparison table */}
          <div className="mt-8 bg-[#1a1a1a] border border-[#262626]">
            <div className="grid grid-cols-3 border-b border-[#262626] px-4 py-2">
              <span className="font-display text-[10px] uppercase tracking-widest text-grit col-span-1">Feature</span>
              <span className="font-display text-[10px] uppercase tracking-widest text-grit text-center">Free</span>
              <span className="font-display text-[10px] uppercase tracking-widest text-accent-red text-center">Pro</span>
            </div>
            {[
              { label: "Unlimited workout logging", free: true, pro: true },
              { label: "Basic programs", free: true, pro: true },
              { label: "AI Coach", free: false, pro: true },
              { label: "Advanced analytics", free: false, pro: true },
              { label: "Featured programs", free: false, pro: true },
              { label: "Priority support", free: false, pro: true },
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-3 border-b border-[#262626] last:border-b-0 px-4 py-2.5 items-center">
                <span className="text-xs text-grit col-span-1">{row.label}</span>
                <span className="text-center text-sm font-bold" style={{ color: row.free ? "#e63222" : "#555" }}>
                  {row.free ? "✓" : "✗"}
                </span>
                <span className="text-center text-sm font-bold" style={{ color: row.pro ? "#e63222" : "#555" }}>
                  {row.pro ? "✓" : "✗"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => setPlan("yearly")}
              className={`w-full border p-4 text-left transition-colors relative ${plan === "yearly" ? "border-accent-red bg-accent-red/10" : "border-[#262626] bg-[#1a1a1a]"}`}
            >
              <span className="absolute -top-3 left-4 bg-accent-red text-white font-display text-[9px] uppercase tracking-widest px-2 py-0.5">Most Popular</span>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-display text-sm uppercase tracking-widest text-grit-text">Yearly</div>
                  <div className="text-[10px] uppercase tracking-widest text-accent-red mt-1">Save 33% — best value</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl text-grit-text">{priceLabels.yearly}</div>
                  <div className="text-[10px] text-grit uppercase tracking-widest">/ year</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => setPlan("monthly")}
              className={`w-full border p-4 text-left transition-colors ${plan === "monthly" ? "border-accent-red bg-accent-red/10" : "border-[#262626] bg-[#1a1a1a]"}`}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-display text-sm uppercase tracking-widest text-grit-text">Monthly</div>
                <div className="text-right">
                  <div className="font-display text-2xl text-grit-text">{priceLabels.monthly}</div>
                  <div className="text-[10px] text-grit uppercase tracking-widest">/ month</div>
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={() => setShowCheckout(true)}
            className="mt-6 w-full bg-accent-red px-6 py-4 font-display text-base uppercase tracking-widest text-white hover:bg-accent-red/90 transition-colors"
          >
            Continue
          </button>
          <p className="mt-3 text-center text-[10px] text-grit uppercase tracking-widest">Cancel anytime. No questions asked.</p>
        </div>
      ) : (
        <div className="px-2 pb-12">
          <StripeEmbeddedCheckout
            priceId={priceId}
            customerEmail={user.email}
            userId={user.id}
            returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
          />
          <button
            onClick={() => setShowCheckout(false)}
            className="mt-4 w-full text-center text-[11px] text-grit uppercase tracking-widest hover:text-grit-text"
          >
            Back to plans
          </button>
        </div>
      )}
    </div>
  );
}
