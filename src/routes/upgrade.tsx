import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft, Crown, Loader2, Shield, BarChart3,
  Swords, Zap, Star, Users, Trophy, Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { usePro } from "@/hooks/usePro";
import { withTimeout } from "@/lib/account-restore";
import { createCheckoutSession, createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import {
  detectCountry,
  currencyForCountry,
  CURRENCY_META,
  priceIdFor,
  type SupportedCurrency,
} from "@/lib/currency";
import { isNativeIos } from "@/lib/platform";

export const Route = createFileRoute("/upgrade")({
  head: () => ({ meta: [{ title: "DEADSET — Go Pro" }] }),
  component: UpgradePage,
});

const PRO_FEATURES = [
  {
    icon: Shield,
    color: "#FAFAFA",
    title: "Streak Armor",
    desc: "Protect your streak on rest days. Use freeze tokens to keep your momentum when life happens.",
  },
  {
    icon: Swords,
    color: "#FAFAFA",
    title: "Head-to-Head Challenges",
    desc: "Challenge friends directly. Most reps, most volume, most sessions — set the stakes and settle it.",
  },
  {
    icon: Trophy,
    color: "#E10600",
    title: "Weekly Leagues — Full Access",
    desc: "Compete in Iron → Bronze → Silver → Gold → Elite Diamond divisions. Promote, relegate, dominate.",
  },
  {
    icon: BarChart3,
    color: "#2196F3",
    title: "Advanced Analytics",
    desc: "Strength curves, body-part volume, consistency heatmaps and PR history. Your numbers, not vibes.",
  },
  {
    icon: Star,
    color: "#FF6B35",
    title: "Featured Programs",
    desc: "5/3/1, nSuns, PHUL, PHAT, Arnold Blueprint, and more. Expert-built splits unlocked instantly.",
  },
  {
    icon: Zap,
    color: "#00BCD4",
    title: "Custom Program Builder",
    desc: "Build your own split day by day from the full exercise library. Sets, reps and order — all yours.",
  },
];

const COMPARE_ROWS = [
  { label: "Workout logging", free: true, pro: true },
  { label: "Basic programs", free: true, pro: true },
  { label: "Social feed & kudos", free: true, pro: true },
  { label: "Challenges (basic)", free: true, pro: true },
  { label: "Custom split builder", free: true, pro: true },
  { label: "Streak Armor", free: false, pro: true },
  { label: "Advanced analytics", free: false, pro: true },
  { label: "H2H Challenges", free: false, pro: true },
  { label: "Full Weekly Leagues", free: false, pro: true },
  { label: "Featured programs", free: false, pro: true },
];

function UpgradePage() {
  const navigate = useNavigate();
  const { isPro, loading } = usePro();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [currency, setCurrency] = useState<SupportedCurrency>("usd");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [iosNative, setIosNative] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIosNative(isNativeIos());
    withTimeout(
      supabase.auth.getSession(),
      { data: { session: null }, error: null },
      3500,
    ).then(({ data: { session }, error }) => {
      if (cancelled) return;
      if (error) setSessionError("Could not check your login. Refresh or sign in again.");
      if (session) setUser({ id: session.user.id, email: session.user.email ?? undefined });
      setSessionChecked(true);
    }).catch(() => {
      if (cancelled) return;
      setSessionError("Could not check your login. Refresh or sign in again.");
      setSessionChecked(true);
    });
    detectCountry().then((c) => setCurrency(currencyForCountry(c)));
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const priceLabels = CURRENCY_META[currency];
  const priceId = priceIdFor(plan, currency);

  const checkoutReturnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

  const startHostedCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const result = await withTimeout(
        createCheckoutSession({
          data: {
            priceId,
            returnUrl: checkoutReturnUrl,
            environment: getStripeEnvironment(),
            uiMode: "hosted_page",
          },
        }),
        { error: "Stripe checkout took too long. Please try again." },
        15000,
      );
      if ("error" in result) throw new Error(result.error);
      if (!result.url) throw new Error("Stripe checkout did not return a payment link");
      window.location.href = result.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not open checkout");
      setCheckoutLoading(false);
    }
  };

  const openBillingPortal = async () => {
    setBillingLoading(true);
    try {
      const result = await withTimeout(
        createPortalSession({
          data: {
            environment: getStripeEnvironment(),
            returnUrl: window.location.origin + "/profile",
          },
        }),
        { error: "Billing portal took too long. Try again." },
        12000,
      );
      if ("error" in result) throw new Error(result.error);
      window.location.href = result.url;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not open billing portal");
      setBillingLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0A" }}>
        <div className="text-center px-6">
          <Loader2 className="animate-spin mx-auto" size={24} style={{ color: "#E10600" }} />
          <p className="label-cap mt-4 text-xs text-grit-dim">Opening Pro</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "#0A0A0A" }}>
        <Crown size={36} style={{ color: "#E10600" }} />
        <h1 className="display text-3xl font-extrabold text-white uppercase tracking-wider mt-5">Sign in for Pro</h1>
        <p className="mt-2 text-sm" style={{ color: "#8A8A8A" }}>
          {sessionError || "Create an account or sign in first, then checkout will load."}
        </p>
        <button onClick={() => navigate({ to: "/auth" })} className="btn-grit mt-6 w-full py-3">
          Sign in / Create account
        </button>
      </div>
    );
  }

  if (isPro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "#0A0A0A" }}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "linear-gradient(135deg, #E10600 0%, #E10600 100%)", boxShadow: "0 8px 32px rgba(225,6,0,0.5)" }}
        >
          <Crown size={36} color="#fff" />
        </div>
        <h1 className="display text-3xl font-extrabold text-white uppercase tracking-wider">You're Pro</h1>
        <p className="mt-2 text-sm" style={{ color: "#8A8A8A" }}>All features unlocked. Train harder.</p>
        <Link to="/train" className="btn-grit mt-6 px-8">Back to training</Link>
        {!iosNative && (
          <button
            onClick={openBillingPortal}
            disabled={billingLoading}
            className="mt-3 text-xs uppercase tracking-widest disabled:opacity-60"
            style={{ color: "#6B7280" }}
          >
            {billingLoading ? "Opening billing…" : "Manage subscription"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0A0A0A", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {!iosNative && <PaymentTestModeBanner />}

      <div className="px-4 py-4">
        <button
          onClick={() => navigate({ to: "/train" })}
          className="flex items-center gap-1 press"
          style={{ color: "#8A8A8A" }}
        >
          <ChevronLeft size={18} />
          <span className="text-xs uppercase tracking-widest">Back</span>
        </button>
      </div>

      {!showCheckout ? (
        <div className="px-5 pb-16 deadset-3d-scene">
          {loading && (
            <div className="mb-4 border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
              <Loader2 className="mr-2 inline animate-spin" size={13} style={{ color: "#E10600" }} />
              <span className="label-cap text-[10px] text-grit-dim">
                Checking your Pro status in the background
              </span>
            </div>
          )}
          {/* Hero */}
          <div className="text-center mb-8 animate-slide-up">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 deadset-float deadset-pulse-glow"
              style={{ background: "linear-gradient(135deg, #E10600 0%, #E10600 100%)", boxShadow: "0 8px 32px rgba(225,6,0,0.4)" }}
            >
              <Crown size={28} color="#fff" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#E10600" }}>
              DEADSET Pro
            </p>
            <h1 className="display text-4xl font-extrabold text-white uppercase leading-tight">
              Train Hard.<br />Dominate.
            </h1>
              <p className="mt-3 text-sm" style={{ color: "#8A8A8A" }}>
              Log free, forever. Go Pro to protect your streak, call out your mates head-to-head, run the full leagues and see every number behind your lifts.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 animate-pop-in delay-50">
                <Users size={13} style={{ color: "#E10600" }} />
                <span className="text-xs font-bold text-white">2,400+ athletes</span>
              </div>
              <div className="flex items-center gap-1.5 animate-pop-in delay-150">
                <Star size={13} style={{ color: "#FAFAFA" }} />
                <span className="text-xs font-bold text-white">4.9 rating</span>
              </div>
              <div className="flex items-center gap-1.5 animate-pop-in delay-250">
                <Flame size={13} style={{ color: "#E10600" }} />
                <span className="text-xs font-bold text-white">Top 1% gains</span>
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="flex flex-col gap-3 mb-8">
            {PRO_FEATURES.map((f) => (
              <div
                key={f.title}
                className="deadset-3d-panel deadset-lift animate-slide-up flex items-start gap-4 p-4"
                style={{ background: "#141414", border: "1.5px solid #262626" }}
              >
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ width: 44, height: 44, background: `${f.color}18`, border: `1px solid ${f.color}30` }}
                >
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#8A8A8A" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table toggle */}
          <button
            onClick={() => setShowCompare(v => !v)}
            className="w-full text-center text-xs font-bold uppercase tracking-widest mb-4 py-2 press"
            style={{ color: "#E10600" }}
          >
            {showCompare ? "Hide" : "See"} Free vs Pro comparison
          </button>
          {showCompare && (
            <div
              className="deadset-3d-panel mb-8 overflow-hidden"
              style={{ border: "1.5px solid #262626" }}
            >
              <div
                className="grid grid-cols-3 px-4 py-3"
                style={{ background: "#141414", borderBottom: "1px solid #262626" }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8A8A8A" }}>Feature</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: "#8A8A8A" }}>Free</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: "#E10600" }}>Pro</span>
              </div>
              {COMPARE_ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className="grid grid-cols-3 px-4 py-2.5 items-center"
                  style={{ background: i % 2 === 0 ? "#141414" : "#17181C", borderBottom: i < COMPARE_ROWS.length - 1 ? "1px solid #262626" : "none" }}
                >
                  <span className="text-xs text-white col-span-1">{row.label}</span>
                  <span className="text-center text-sm font-bold" style={{ color: row.free ? "#FAFAFA" : "#3a3a3a" }}>
                    {row.free ? "✓" : "✗"}
                  </span>
                  <span className="text-center text-sm font-bold" style={{ color: "#E10600" }}>✓</span>
                </div>
              ))}
            </div>
          )}

          {iosNative ? (
            <div className="deadset-3d-panel mb-6 p-5 text-center" style={{ background: "#141414", border: "1.5px solid #262626" }}>
              <Crown size={24} className="mx-auto mb-3" style={{ color: "#E10600" }} />
              <p className="display text-xl font-extrabold uppercase text-white">Pro purchase coming to iPhone</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#8A8A8A" }}>
                App Store rules require iPhone subscriptions to use Apple in-app purchase. Stripe checkout is available on the web version only.
              </p>
              <p className="mt-4 text-[10px] uppercase tracking-widest" style={{ color: "#6B7280" }}>
                Choose next: RevenueCat / StoreKit, or iOS free-tier only.
              </p>
            </div>
          ) : (
            <>
              {/* Plan selector */}
              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={() => setPlan("yearly")}
                  className="deadset-3d-panel deadset-lift animate-subtle-pulse w-full text-left p-4 relative press"
                  style={{
                    background: plan === "yearly" ? "rgba(225,6,0,0.1)" : "#141414",
                    border: `2px solid ${plan === "yearly" ? "#E10600" : "#262626"}`,
                  }}
                >
                  <span
                    className="absolute -top-2.5 left-4 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                    style={{ background: "#E10600" }}
                  >
                    Most Popular · Save 33%
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="font-bold text-white text-sm uppercase tracking-wider">Yearly</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#8A8A8A" }}>Best value — billed annually</p>
                    </div>
                    <div className="text-right">
                      <p className="display text-2xl font-extrabold text-white">{priceLabels.yearly}</p>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "#8A8A8A" }}>/ year</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPlan("monthly")}
                  className="deadset-3d-panel deadset-lift w-full text-left p-4 press"
                  style={{
                    background: plan === "monthly" ? "rgba(225,6,0,0.1)" : "#141414",
                    border: `2px solid ${plan === "monthly" ? "#E10600" : "#262626"}`,
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="font-bold text-white text-sm uppercase tracking-wider">Monthly</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#8A8A8A" }}>Flexible — cancel anytime</p>
                    </div>
                    <div className="text-right">
                      <p className="display text-2xl font-extrabold text-white">{priceLabels.monthly}</p>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: "#8A8A8A" }}>/ month</p>
                    </div>
                  </div>
                </button>
              </div>

              {checkoutError && (
                <div className="mb-3 rounded-2xl border border-accent-red/50 bg-accent-red/10 p-3 text-center">
                  <p className="text-xs text-accent-red">{checkoutError}</p>
                </div>
              )}
              <button
                onClick={startHostedCheckout}
                disabled={checkoutLoading}
                className="btn-grit w-full py-4 text-base rounded-2xl animate-subtle-pulse"
              >
                {checkoutLoading ? (
                  <Loader2 size={16} className="inline mr-2 animate-spin" />
                ) : (
                  <Crown size={16} className="inline mr-2" />
                )}
                {checkoutLoading ? "Opening Stripe…" : "Unlock DEADSET Pro"}
              </button>
              <button
                onClick={() => setShowCheckout(true)}
                className="btn-ghost mt-3 w-full py-3 text-xs rounded-2xl"
              >
                Use embedded checkout instead
              </button>
              <p className="mt-3 text-center text-[10px] uppercase tracking-widest" style={{ color: "#6B7280" }}>
                Promo codes enabled · Cancel anytime
              </p>
            </>
          )}

          {/* Testimonials */}
          <div className="mt-8 flex flex-col gap-3">
            {[
              { name: "Jake M.", quote: "H2H challenges made me chase every session. Finally broke my bench plateau.", badge: "BEAST" },
              { name: "Sarah K.", quote: "Streak Armor saved me during a work trip. Came back fired up.", badge: "GRINDER" },
              { name: "Tom R.", quote: "Leagues make everything competitive. I train harder every single week.", badge: "ELITE" },
            ].map((t) => (
              <div key={t.name} className="deadset-3d-panel deadset-lift p-4" style={{ background: "#141414", border: "1.5px solid #262626" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-extrabold display text-sm"
                    style={{ background: "#E10600" }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{t.name}</p>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(225,6,0,0.15)", color: "#E10600", border: "1px solid rgba(225,6,0,0.3)" }}
                    >
                      {t.badge}
                    </span>
                  </div>
                  <div className="ml-auto flex">
                    {[1,2,3,4,5].map(s => <Star key={s} size={10} fill="#FAFAFA" style={{ color: "#FAFAFA" }} />)}
                  </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#8A8A8A" }}>"{t.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      ) : iosNative ? (
        <div className="px-5 pb-12">
          <div className="deadset-3d-panel border border-grit bg-grit-card p-5 text-center">
            <p className="label-cap text-xs text-accent-red">Checkout disabled on iPhone</p>
            <p className="mt-2 text-sm text-grit-dim">
              Apple requires in-app purchase for native iOS subscriptions.
            </p>
          </div>
          <button
            onClick={() => setShowCheckout(false)}
            className="mt-4 w-full text-center text-[11px] uppercase tracking-widest press"
            style={{ color: "#8A8A8A" }}
          >
            ← Back to plans
          </button>
        </div>
      ) : (
        <div className="px-2 pb-12">
          <StripeEmbeddedCheckout
            priceId={priceId}
            returnUrl={checkoutReturnUrl}
          />
          <button
            onClick={() => setShowCheckout(false)}
            className="mt-4 w-full text-center text-[11px] uppercase tracking-widest press"
            style={{ color: "#8A8A8A" }}
          >
            ← Back to plans
          </button>
        </div>
      )}
    </div>
  );
}
