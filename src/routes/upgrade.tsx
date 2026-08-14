import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Crown,
  Loader2,
  Shield,
  BarChart3,
  Swords,
  Zap,
  Star,
  Users,
  Trophy,
  Flame,
  Check,
  Activity,
  CalendarDays,
  Settings2,
  RefreshCw,
  Gauge,
  ClipboardCheck,
  Flag,
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
import { COMPARE_ROWS } from "@/lib/pro-features";
import { ProBadge } from "@/components/ProBadge";
import {
  APPLE_PRO_PRODUCTS,
  getAppleProducts,
  manageApplePro,
  purchaseApplePro,
  restoreApplePro,
  type AppleProduct,
} from "@/lib/storekit";

export const Route = createFileRoute("/upgrade")({
  head: () => ({ meta: [{ title: "DEADSET — Go Pro" }] }),
  component: UpgradePage,
});

const PRO_FEATURES = [
  {
    icon: ClipboardCheck,
    color: "#f4c33a",
    title: "Pro Weekly Review",
    desc: "One weekly decision screen combines progression, plateaus, volume, balance and PR targets into the next three moves.",
  },
  {
    icon: Flag,
    color: "#f4c33a",
    title: "PR Roadmap",
    desc: "Set target estimated maxes for your lifts, track the exact gap and project a milestone date from your real training trend.",
  },
  {
    icon: Gauge,
    color: "#f4c33a",
    title: "Training Autopilot",
    desc: "Chooses every next-session load from your completed reps and effort, detects stalls, calls recovery deloads, and applies all changes directly to your plan in one tap.",
  },
  {
    icon: Settings2,
    color: "#f4c33a",
    title: "Advanced Exercise Programming",
    desc: "Choose double or linear progression, per-exercise rest, target RIR, lifting tempo and private cues. Your live workout follows every setting.",
  },
  {
    icon: RefreshCw,
    color: "#f4c33a",
    title: "Smart Exercise Swaps",
    desc: "Replace a busy or unsuitable movement with a same-muscle alternative while preserving every target and coaching setting.",
  },
  {
    icon: CalendarDays,
    color: "#f4c33a",
    title: "Plan Intelligence",
    desc: "Audit muscle coverage, weekly set volume and recovery spacing, then rebalance the whole week around your goal in one tap.",
  },
  {
    icon: Activity,
    color: "#f4c33a",
    title: "DEADSET Intelligence",
    desc: "Volume Optimizer, Plateau Breaker, strength-trajectory projections and a training-balance score, all computed from your own logs.",
  },
  {
    icon: Shield,
    color: "#FAFAFA",
    title: "Streak Armor",
    desc: "Three shields a month auto-protect your streak when life happens. Miss a day, keep the fire.",
  },
  {
    icon: Swords,
    color: "#FAFAFA",
    title: "Head-to-Head Challenges",
    desc: "Challenge friends directly. Most reps, most volume, most sessions — set the stakes and settle it.",
  },
  {
    icon: BarChart3,
    color: "#2196F3",
    title: "Progression Intelligence",
    desc: "Ghost Mode races your last session set-by-set, weight evolution per lift, and next-weight suggestions the moment you beat your plan.",
  },
  {
    icon: BarChart3,
    color: "#00BCD4",
    title: "Advanced Analytics",
    desc: "Strength standards, rep-max tables, tonnage, body-part volume and consistency heatmaps. Your numbers, not vibes.",
  },
  {
    icon: Star,
    color: "#FF6B35",
    title: "Featured Programs",
    desc: "5/3/1 BBB, StrongLifts 5×5, PHUL, Arnold Split and nSuns. Expert-built splits unlocked instantly.",
  },
  {
    icon: Zap,
    color: "#00BCD4",
    title: "Custom Program Builder",
    desc: "Build unlimited custom splits day by day from the full exercise library. Sets, reps and order — all yours.",
  },
];

function UpgradePage() {
  const navigate = useNavigate();
  const { isPro, loading, refresh } = usePro();
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
  const [appleProducts, setAppleProducts] = useState<AppleProduct[]>([]);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const nativeIos = isNativeIos();
    setIosNative(nativeIos);
    if (nativeIos) {
      getAppleProducts()
        .then(setAppleProducts)
        .catch(() => setCheckoutError("Subscriptions are temporarily unavailable from Apple."));
    }
    withTimeout(supabase.auth.getSession(), { data: { session: null }, error: null }, 3500)
      .then(({ data: { session }, error }) => {
        if (cancelled) return;
        if (error) setSessionError("Could not check your login. Refresh or sign in again.");
        if (session) setUser({ id: session.user.id, email: session.user.email ?? undefined });
        setSessionChecked(true);
      })
      .catch(() => {
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
  const appleMonthly = appleProducts.find((product) => product.id === APPLE_PRO_PRODUCTS.monthly);
  const appleYearly = appleProducts.find((product) => product.id === APPLE_PRO_PRODUCTS.yearly);
  const monthlyLabel = iosNative ? (appleMonthly?.displayPrice ?? "—") : priceLabels.monthly;
  const yearlyLabel = iosNative ? (appleYearly?.displayPrice ?? "—") : priceLabels.yearly;
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
      toast.error(error instanceof Error ? error.message : "Could not open billing portal");
      setBillingLoading(false);
    }
  };

  const startApplePurchase = async () => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setAppleLoading(true);
    setCheckoutError(null);
    try {
      const productId = plan === "yearly" ? APPLE_PRO_PRODUCTS.yearly : APPLE_PRO_PRODUCTS.monthly;
      const result = await purchaseApplePro(productId, user.id);
      if (result.pending)
        toast.message("Purchase pending approval", {
          description: "Pro unlocks as soon as Apple approves it.",
        });
      else if (!result.cancelled && result.active) {
        await refresh();
        toast.success("DEADSET Pro unlocked");
      }
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Apple purchase could not be completed",
      );
    } finally {
      setAppleLoading(false);
    }
  };

  const restoreApplePurchase = async () => {
    setAppleLoading(true);
    setCheckoutError(null);
    try {
      const result = await restoreApplePro();
      await refresh();
      if (result.active) toast.success("Purchases restored");
      else toast.message("No active DEADSET Pro purchase was found");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Purchases could not be restored");
    } finally {
      setAppleLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0A0A0A" }}
      >
        <div className="text-center px-6">
          <Loader2 className="animate-spin mx-auto" size={24} style={{ color: "#e63222" }} />
          <p className="label-cap mt-4 text-xs text-grit-dim">Opening Pro</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Logged-out visitors get the FULL pitch — hero, tick table, pricing —
    // with sign-in as the final CTA, not a bare gate.
    return (
      <div className="min-h-screen pb-12" style={{ background: "#0A0A0A" }}>
        {/* Hero with the app's red glow */}
        <div
          className="relative px-6 pt-14 pb-10 text-center overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(230,50,34,0.28), transparent 65%)",
          }}
        >
          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #e63222, #7a0300)",
              boxShadow: "0 10px 40px rgba(230,50,34,0.45)",
            }}
          >
            <Crown size={30} color="#fff" />
          </div>
          <h1 className="display text-4xl font-extrabold uppercase tracking-wide mt-5 leading-none">
            <span className="text-white">DEADSET</span>{" "}
            <span style={{ color: "#e63222" }}>PRO</span>
          </h1>
          <p className="mt-3 text-sm max-w-xs mx-auto leading-relaxed" style={{ color: "#8A8A8A" }}>
            Everything needed to log and train stays free. Pro turns your history into clear weekly
            decisions, automatic progression and measurable targets.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="px-5 grid grid-cols-2 gap-3 -mt-2">
          <div
            className="deadset-3d-panel rounded-2xl p-4 text-left"
            style={{ background: "rgba(230,50,34,0.10)", border: "2px solid #e63222" }}
          >
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
              style={{ background: "#e63222" }}
            >
              Best value · Save 33%
            </span>
            <p className="label-cap text-[9px] text-grit-dim mt-2">Yearly</p>
            <p className="display text-3xl font-extrabold text-white leading-none mt-1">
              {yearlyLabel}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "#8A8A8A" }}>
              per year
            </p>
          </div>
          <div
            className="deadset-3d-panel rounded-2xl p-4 text-left"
            style={{ background: "#141414", border: "1.5px solid #262626" }}
          >
            <p className="label-cap text-[9px] text-grit-dim mt-1">Monthly</p>
            <p className="display text-3xl font-extrabold text-white leading-none mt-1">
              {monthlyLabel}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "#8A8A8A" }}>
              per month · cancel anytime
            </p>
          </div>
        </div>

        {/* CTA stays above the detailed comparison so the next step is immediate. */}
        <div className="px-5 mt-5">
          {sessionError && (
            <p className="mb-3 text-center text-xs" style={{ color: "#e63222" }}>
              {sessionError}
            </p>
          )}
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="btn-grit w-full py-4 text-base rounded-2xl animate-subtle-pulse"
          >
            <Crown size={16} className="inline mr-2" />
            Sign in / Create account
          </button>
          <p className="mt-2.5 text-center text-[10px]" style={{ color: "#8a8a8a" }}>
            Takes under a minute — then checkout loads right here.
          </p>
          <p
            className="mt-3 text-center label-cap text-[9px] leading-relaxed"
            style={{ color: "#8a8a8a" }}
          >
            Secure payment by Stripe · Promo codes enabled · Cancel anytime
          </p>
        </div>

        <div className="px-5 mt-5">
          <button
            type="button"
            onClick={() => setShowCompare((current) => !current)}
            className="btn-ghost w-full py-3 text-xs rounded-2xl"
          >
            {showCompare ? "Hide detailed comparison" : "Compare Free and Pro"}
          </button>
          {showCompare && (
            <div className="deadset-3d-panel bg-grit-card border border-grit rounded-2xl overflow-hidden mt-3">
              <div className="grid grid-cols-[1fr_52px_52px] items-center px-4 py-3 border-b border-grit bg-[#101010]">
                <span className="label-cap text-[9px] text-grit-dim">What you get</span>
                <span className="label-cap text-[9px] text-grit-dim text-center">Free</span>
                <span className="label-cap text-[9px] text-center" style={{ color: "#e63222" }}>
                  Pro
                </span>
              </div>
              {COMPARE_ROWS.map((r) => (
                <div
                  key={r.label}
                  className="grid grid-cols-[1fr_52px_52px] items-center px-4 py-2.5 border-b border-grit/50 last:border-b-0"
                >
                  <span className="text-xs text-grit font-medium">{r.label}</span>
                  <span className="text-center text-[10px] leading-tight text-grit-dim px-0.5">
                    {typeof r.free === "string" ? (
                      r.free
                    ) : r.free ? (
                      <Check size={14} className="inline text-grit" />
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="text-center px-0.5">
                    {typeof r.pro === "string" ? (
                      <span
                        className="text-[10px] leading-tight font-bold"
                        style={{ color: "#e63222" }}
                      >
                        {r.pro}
                      </span>
                    ) : (
                      <Check size={14} className="inline" style={{ color: "#e63222" }} />
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5">
          <Link
            to="/"
            className="mt-4 block text-center label-cap text-[10px] text-grit-dim press py-2"
          >
            ← Back to DEADSET
          </Link>
        </div>
      </div>
    );
  }

  if (isPro) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: "#0A0A0A" }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{
            background: "linear-gradient(135deg, #e63222 0%, #e63222 100%)",
            boxShadow: "0 8px 32px rgba(230,50,34,0.5)",
          }}
        >
          <Crown size={36} color="#fff" />
        </div>
        <h1 className="display text-3xl font-extrabold text-white uppercase tracking-wider">
          DEADSET Pro is active
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "#8A8A8A" }}>
          Your Weekly Review, PR Roadmap, Training Autopilot and every advanced training tool are
          ready.
        </p>
        <Link
          to="/progress"
          className="btn-grit mt-6 flex min-h-12 items-center justify-center gap-2 px-8"
        >
          <ClipboardCheck size={16} /> Open Weekly Review
        </Link>
        <Link to="/train" className="btn-ghost mt-3 px-8">
          Go to training
        </Link>
        {iosNative ? (
          <button
            onClick={() => void manageApplePro()}
            className="mt-3 text-xs uppercase tracking-widest"
            style={{ color: "#8a8a8a" }}
          >
            Manage subscription
          </button>
        ) : (
          <button
            onClick={openBillingPortal}
            disabled={billingLoading}
            className="mt-3 text-xs uppercase tracking-widest disabled:opacity-60"
            style={{ color: "#8a8a8a" }}
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
      style={{
        background: "#0A0A0A",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
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
              <Loader2
                className="mr-2 inline animate-spin"
                size={13}
                style={{ color: "#e63222" }}
              />
              <span className="label-cap text-[10px] text-grit-dim">
                Checking your Pro status in the background
              </span>
            </div>
          )}
          {/* Hero */}
          <div className="text-center mb-8 animate-slide-up">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 deadset-float deadset-pulse-glow"
              style={{
                background: "linear-gradient(135deg, #e63222 0%, #e63222 100%)",
                boxShadow: "0 8px 32px rgba(230,50,34,0.4)",
              }}
            >
              <Crown size={28} color="#fff" />
            </div>
            <p
              className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: "#e63222" }}
            >
              DEADSET Pro
            </p>
            <h1 className="display text-4xl font-extrabold text-white uppercase leading-tight">
              Your training.
              <br />
              Fully dialled in.
            </h1>
            <p className="mt-3 text-sm" style={{ color: "#8A8A8A" }}>
              Keep logging free, forever. Pro reviews the week, updates the plan, projects your next
              PR and shows exactly what to change.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 animate-pop-in delay-50">
                <Users size={13} style={{ color: "#e63222" }} />
                <span className="text-xs font-bold text-white">Weekly decisions</span>
              </div>
              <div className="flex items-center gap-1.5 animate-pop-in delay-150">
                <Gauge size={13} style={{ color: "#FAFAFA" }} />
                <span className="text-xs font-bold text-white">1-tap progression</span>
              </div>
              <div className="flex items-center gap-1.5 animate-pop-in delay-250">
                <Flame size={13} style={{ color: "#e63222" }} />
                <span className="text-xs font-bold text-white">PR roadmaps</span>
              </div>
            </div>
          </div>

          {/* The visible payoff — your identity goes gold the moment you upgrade */}
          <div
            className="rounded-2xl border border-pro pro-glow p-4 mb-6 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg, #201a0c 0%, #2b2108 55%, #0d0a04 100%)" }}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{ background: "radial-gradient(circle at 50% 35%, #f8d566, #eab212 70%)" }}
            >
              <Crown size={22} strokeWidth={2.5} className="text-[#14110a]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold text-white">Your card goes gold</p>
                <ProBadge size="sm" />
              </div>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#b7ac8e" }}>
                A gold athlete card, the Pro badge on your profile, and every feature below,
                unlocked as soon as you upgrade.
              </p>
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
                  style={{
                    width: 44,
                    height: 44,
                    background: `${f.color}18`,
                    border: `1px solid ${f.color}30`,
                  }}
                >
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#8A8A8A" }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table toggle */}
          <button
            onClick={() => setShowCompare((v) => !v)}
            className="w-full text-center text-xs font-bold uppercase tracking-widest mb-4 py-2 press"
            style={{ color: "#e63222" }}
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
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "#8A8A8A" }}
                >
                  Feature
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider text-center"
                  style={{ color: "#8A8A8A" }}
                >
                  Free
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider text-center"
                  style={{ color: "#e63222" }}
                >
                  Pro
                </span>
              </div>
              {COMPARE_ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className="grid grid-cols-3 px-4 py-2.5 items-center"
                  style={{
                    background: i % 2 === 0 ? "#141414" : "#17181C",
                    borderBottom: i < COMPARE_ROWS.length - 1 ? "1px solid #262626" : "none",
                  }}
                >
                  <span className="text-xs text-white col-span-1">{row.label}</span>
                  <span
                    className={`text-center font-bold ${typeof row.free === "string" ? "text-[10px] uppercase tracking-wider" : "text-sm"}`}
                    style={{ color: row.free ? "#FAFAFA" : "#3a3a3a" }}
                  >
                    {typeof row.free === "string" ? row.free : row.free ? "✓" : "✗"}
                  </span>
                  <span
                    className={`text-center font-bold ${typeof row.pro === "string" ? "text-[10px] uppercase tracking-wider" : "text-sm"}`}
                    style={{ color: "#e63222" }}
                  >
                    {typeof row.pro === "string" ? row.pro : "✓"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {iosNative ? (
            <>
              <div className="flex flex-col gap-3 mb-5">
                {[
                  {
                    key: "yearly" as const,
                    product: appleYearly,
                    label: "Yearly",
                    note: "Best value · billed annually",
                  },
                  {
                    key: "monthly" as const,
                    product: appleMonthly,
                    label: "Monthly",
                    note: "Flexible · cancel anytime",
                  },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPlan(option.key)}
                    disabled={!option.product || appleLoading}
                    className="deadset-3d-panel deadset-lift w-full text-left p-4 press disabled:opacity-60"
                    style={{
                      background: plan === option.key ? "rgba(230,50,34,0.1)" : "#141414",
                      border: `2px solid ${plan === option.key ? "#e63222" : "#262626"}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-white text-sm uppercase tracking-wider">
                          {option.label}
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: "#8A8A8A" }}>
                          {option.note}
                        </p>
                      </div>
                      <p className="display text-2xl font-extrabold text-white">
                        {option.product?.displayPrice ?? (
                          <Loader2 size={18} className="animate-spin" />
                        )}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {checkoutError && (
                <div className="mb-3 rounded-lg border border-accent-red/50 bg-accent-red/10 p-3 text-center">
                  <p className="text-xs text-accent-red">{checkoutError}</p>
                </div>
              )}
              <button
                type="button"
                onClick={startApplePurchase}
                disabled={appleLoading || appleProducts.length === 0}
                className="btn-grit w-full py-4 text-base rounded-2xl disabled:opacity-60"
              >
                {appleLoading ? (
                  <Loader2 size={16} className="inline mr-2 animate-spin" />
                ) : (
                  <Crown size={16} className="inline mr-2" />
                )}
                Subscribe with Apple
              </button>
              <button
                type="button"
                onClick={restoreApplePurchase}
                disabled={appleLoading}
                className="btn-ghost mt-3 w-full py-3 text-xs rounded-2xl disabled:opacity-60"
              >
                Restore Purchases
              </button>
              <p
                className="mt-4 text-center text-[10px] leading-relaxed"
                style={{ color: "#8a8a8a" }}
              >
                Payment is charged to your Apple Account. Subscription renews automatically unless
                cancelled at least 24 hours before the end of the current period. Manage or cancel
                in your App Store account.
              </p>
              <div
                className="mt-3 flex justify-center gap-4 text-[10px] uppercase tracking-wider"
                style={{ color: "#8a8a8a" }}
              >
                <Link to="/terms">Terms</Link>
                <Link to="/privacy">Privacy</Link>
              </div>
            </>
          ) : (
            <>
              {/* Plan selector */}
              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={() => setPlan("yearly")}
                  className="deadset-3d-panel deadset-lift animate-subtle-pulse w-full text-left p-4 relative press"
                  style={{
                    background: plan === "yearly" ? "rgba(230,50,34,0.1)" : "#141414",
                    border: `2px solid ${plan === "yearly" ? "#e63222" : "#262626"}`,
                  }}
                >
                  <span
                    className="absolute -top-2.5 left-4 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                    style={{ background: "#e63222" }}
                  >
                    Most Popular · Save 33%
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="font-bold text-white text-sm uppercase tracking-wider">
                        Yearly
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#8A8A8A" }}>
                        Best value — billed annually
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="display text-2xl font-extrabold text-white">
                        {priceLabels.yearly}
                      </p>
                      <p
                        className="text-[10px] uppercase tracking-wider"
                        style={{ color: "#8A8A8A" }}
                      >
                        / year
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPlan("monthly")}
                  className="deadset-3d-panel deadset-lift w-full text-left p-4 press"
                  style={{
                    background: plan === "monthly" ? "rgba(230,50,34,0.1)" : "#141414",
                    border: `2px solid ${plan === "monthly" ? "#e63222" : "#262626"}`,
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="font-bold text-white text-sm uppercase tracking-wider">
                        Monthly
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#8A8A8A" }}>
                        Flexible — cancel anytime
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="display text-2xl font-extrabold text-white">
                        {priceLabels.monthly}
                      </p>
                      <p
                        className="text-[10px] uppercase tracking-wider"
                        style={{ color: "#8A8A8A" }}
                      >
                        / month
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {checkoutError && (
                <div className="mb-3 rounded-2xl border border-accent-red/50 bg-accent-red/10 p-3 text-center">
                  <p className="text-xs text-accent-red">{checkoutError}</p>
                </div>
              )}
              {/* Embedded checkout is the default so payment stays inside
                  DEADSET, on-brand, never bouncing to a Stripe-branded page.
                  The hosted redirect remains a one-tap fallback below (and the
                  embedded component itself falls back to hosted on error). */}
              <button
                onClick={() => setShowCheckout(true)}
                disabled={checkoutLoading}
                className="btn-grit w-full py-4 text-base rounded-2xl animate-subtle-pulse"
              >
                <Crown size={16} className="inline mr-2" />
                Unlock DEADSET Pro
              </button>
              <button
                onClick={startHostedCheckout}
                disabled={checkoutLoading}
                className="btn-ghost mt-3 w-full py-3 text-xs rounded-2xl"
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 size={14} className="inline mr-2 animate-spin" />
                    Opening Stripe…
                  </>
                ) : (
                  "Prefer a separate page? Open secure Stripe checkout"
                )}
              </button>
              <p
                className="mt-3 text-center text-[10px] uppercase tracking-widest"
                style={{ color: "#8a8a8a" }}
              >
                Secure payment by Stripe · Promo codes enabled · Cancel anytime
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="px-2 pb-12">
          <StripeEmbeddedCheckout priceId={priceId} returnUrl={checkoutReturnUrl} />
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
