import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Check,
  Crown,
  Dumbbell,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { supabase } from "@/integrations/supabase/client";
import { usePro } from "@/hooks/usePro";
import { withTimeout } from "@/lib/account-restore";
import {
  CURRENCY_META,
  currencyForCountry,
  detectCountry,
  priceIdFor,
  type SupportedCurrency,
} from "@/lib/currency";
import { hapticFailure, hapticPlanUpdated, hapticSelection } from "@/lib/haptics";
import { createCheckoutSession, createPortalSession } from "@/lib/payments.functions";
import { DEADSET_MONTHLY_PRICE_GBP, isSevenDayFreeTrial } from "@/lib/paid-access";
import { isNativeIos } from "@/lib/platform";
import {
  notifyRevenueCatUpdated,
  recordRevenueCatPurchase,
  syncRevenueCatPurchases,
} from "@/lib/revenuecat";
import {
  APPLE_PRO_PRODUCTS,
  getAppleProducts,
  manageApplePro,
  purchaseApplePro,
  restoreApplePro,
  type AppleProduct,
} from "@/lib/storekit";
import { getStripeEnvironment } from "@/lib/stripe";
import { finishAppBoot } from "@/lib/app-boot";

export const Route = createFileRoute("/upgrade")({
  head: () => ({ meta: [{ title: "DEADSET — Start your trial" }] }),
  component: UpgradePage,
});

const MEMBERSHIP_FEATURES = [
  {
    icon: Activity,
    title: "Strength Map",
    detail:
      "Every muscle is ranked from your real logged lifts; uncovered areas stay grey and explain why.",
  },
  {
    icon: Target,
    title: "Muscle development coach",
    detail:
      "Pick the muscle you want to grow, see recovery and volume, then add matched exercises to your week.",
  },
  {
    icon: CalendarDays,
    title: "Intelligent programme",
    detail: "Your days, equipment, experience and focus muscles build one editable training week.",
  },
  {
    icon: Dumbbell,
    title: "Automatic progression",
    detail:
      "Working weights, repeated exercises and next-session targets stay linked across the whole plan.",
  },
] as const;

const PRO_MAP_COLOURS = {
  CHEST: "#f04432",
  BACK: "#8d3df0",
  LEGS: "#ff9d2e",
  SHOULDERS: "#e63222",
  ARMS: "#d758ff",
  CORE: "#4ac6ff",
} as const;

const PRO_ACTIVE_DAYS = new Set([0, 2, 4, 5]);
const PRO_WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const PRO_PROGRESS_WIDTHS = [86, 68, 48] as const;

type UserSummary = { id: string; email?: string };

function UpgradePage() {
  const navigate = useNavigate();
  const { isPro, loading: entitlementLoading, refresh } = usePro();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<SupportedCurrency>("gbp");
  const [iosNative, setIosNative] = useState(false);
  const [appleProducts, setAppleProducts] = useState<AppleProduct[]>([]);
  const [appleProductsChecked, setAppleProductsChecked] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nativeIos = isNativeIos();
    setIosNative(nativeIos);
    if (nativeIos) {
      getAppleProducts()
        .then((products) => {
          if (!cancelled) setAppleProducts(products);
        })
        .catch(() => {
          if (!cancelled) setError("Apple subscriptions are temporarily unavailable.");
        })
        .finally(() => {
          if (!cancelled) setAppleProductsChecked(true);
        });
    } else {
      setAppleProductsChecked(true);
    }
    void detectCountry().then((country) => {
      if (!cancelled) setCurrency(currencyForCountry(country));
    });
    void withTimeout(supabase.auth.getSession(), { data: { session: null }, error: null }, 3500)
      .then(({ data, error: authError }) => {
        if (cancelled) return;
        if (authError) setSessionError("Could not verify your login. Please try again.");
        if (data.session) {
          setUser({ id: data.session.user.id, email: data.session.user.email ?? undefined });
        }
        setSessionChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSessionError("Could not verify your login. Please try again.");
        setSessionChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionChecked || !appleProductsChecked || entitlementLoading) return;
    finishAppBoot();
  }, [appleProductsChecked, entitlementLoading, sessionChecked]);

  const appleMonthly = appleProducts.find((product) => product.id === APPLE_PRO_PRODUCTS.monthly);
  const exactAppleTrial = isSevenDayFreeTrial(appleMonthly?.introductoryOffer);
  const appleTrialEligible = exactAppleTrial && appleMonthly?.eligibleForIntroOffer === true;
  const monthlyLabel = iosNative
    ? (appleMonthly?.displayPrice ?? "—")
    : CURRENCY_META[currency].monthly;
  const webPriceId = priceIdFor("monthly", currency);
  const checkoutReturnUrl = `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

  async function startApplePurchase() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    hapticSelection();
    setPurchaseLoading(true);
    setError(null);
    try {
      const result = await purchaseApplePro(APPLE_PRO_PRODUCTS.monthly, user.id);
      if (result.pending) {
        toast.message("Purchase pending approval", {
          description: "DEADSET unlocks as soon as Apple approves it.",
        });
      } else if (!result.cancelled && result.active) {
        await recordRevenueCatPurchase(APPLE_PRO_PRODUCTS.monthly, user.id)
          .then((synced) => {
            if (synced) notifyRevenueCatUpdated();
          })
          .catch((syncError) => console.warn("RevenueCat purchase recording failed", syncError));
        await refresh();
        hapticPlanUpdated();
        toast.success(appleTrialEligible ? "Your 7-day trial has started" : "DEADSET unlocked");
        navigate({ to: "/train", replace: true });
      }
    } catch (purchaseError) {
      hapticFailure();
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "Apple could not complete this purchase.",
      );
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function restorePurchase() {
    hapticSelection();
    setPurchaseLoading(true);
    setError(null);
    try {
      const result = await restoreApplePro();
      await syncRevenueCatPurchases(user?.id)
        .then((synced) => {
          if (synced) notifyRevenueCatUpdated();
        })
        .catch((syncError) => console.warn("RevenueCat restore sync failed", syncError));
      await refresh();
      if (result.active) {
        hapticPlanUpdated();
        toast.success("Purchases restored");
        navigate({ to: "/train", replace: true });
      } else {
        toast.message("No active DEADSET subscription was found");
      }
    } catch (restoreError) {
      hapticFailure();
      setError(
        restoreError instanceof Error ? restoreError.message : "Purchases could not be restored.",
      );
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function startHostedCheckout() {
    setCheckoutLoading(true);
    setError(null);
    try {
      const result = await withTimeout(
        createCheckoutSession({
          data: {
            priceId: webPriceId,
            returnUrl: checkoutReturnUrl,
            environment: getStripeEnvironment(),
            uiMode: "hosted_page",
          },
        }),
        { error: "Checkout took too long. Please try again." },
        15000,
      );
      if ("error" in result) throw new Error(result.error);
      if (!result.url) throw new Error("Checkout did not return a secure payment link.");
      window.location.href = result.url;
    } catch (checkoutError) {
      hapticFailure();
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not open checkout.");
      setCheckoutLoading(false);
    }
  }

  async function openBilling() {
    setBillingLoading(true);
    try {
      if (iosNative) {
        await manageApplePro();
        return;
      }
      const result = await createPortalSession({
        data: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/profile`,
        },
      });
      if ("error" in result) throw new Error(result.error);
      window.location.href = result.url;
    } catch (billingError) {
      hapticFailure();
      toast.error(
        billingError instanceof Error
          ? billingError.message
          : "Could not open subscription management.",
      );
    } finally {
      setBillingLoading(false);
    }
  }

  if (!sessionChecked || (iosNative && !appleProductsChecked)) {
    return <LoadingScreen label="Opening membership" />;
  }

  if (user && entitlementLoading) return <LoadingScreen label="Checking membership" />;

  if (!user) {
    return (
      <MembershipShell>
        <TrialHero
          price={iosNative && appleMonthly ? appleMonthly.displayPrice : DEADSET_MONTHLY_PRICE_GBP}
          trialAvailable={!iosNative || appleTrialEligible}
        />
        <FeatureGrid />
        {sessionError && <ErrorCard message={sessionError} />}
        <button onClick={() => navigate({ to: "/auth" })} className="btn-grit w-full min-h-14">
          Sign up to start
        </button>
        <Link to="/" className="mt-4 block py-2 text-center label-cap text-[9px] text-grit-dim">
          Back to DEADSET
        </Link>
      </MembershipShell>
    );
  }

  if (isPro && !entitlementLoading) {
    return (
      <div className="min-h-screen bg-[#090909] px-6 flex flex-col items-center justify-center text-center">
        <div className="h-20 w-20 rounded-full bg-accent-red flex items-center justify-center deadset-pulse-glow">
          <Check size={36} className="text-white" strokeWidth={3} />
        </div>
        <p className="label-cap mt-6 text-accent-red">MEMBERSHIP ACTIVE</p>
        <h1 className="display mt-2 text-4xl font-extrabold uppercase text-white">
          You&apos;re in.
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-grit-dim">
          Your Strength Map, programme, muscle coach and complete training history are unlocked.
        </p>
        <Link to="/strength" className="btn-grit mt-7 w-full max-w-sm min-h-14">
          Open my Strength Map
        </Link>
        <Link to="/train" className="btn-ghost mt-3 w-full max-w-sm min-h-12">
          Start training
        </Link>
        <button
          type="button"
          onClick={openBilling}
          disabled={billingLoading}
          className="mt-5 label-cap text-[9px] text-grit-dim disabled:opacity-50"
        >
          {billingLoading ? "Opening…" : "Manage subscription"}
        </button>
      </div>
    );
  }

  return (
    <MembershipShell>
      {!iosNative && <PaymentTestModeBanner />}
      <TrialHero
        price={monthlyLabel}
        trialAvailable={!iosNative || appleTrialEligible}
        trialConfigured={iosNative ? exactAppleTrial : true}
      />
      <FeatureGrid />

      <div className="mb-5 rounded-2xl border-2 border-accent-red bg-accent-red/[0.08] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-cap text-[9px] text-accent-red">ONE MONTHLY MEMBERSHIP</p>
            <p className="display mt-1 text-3xl font-extrabold text-white">{monthlyLabel}</p>
            <p className="mt-1 text-[10px] text-grit-dim">per month · cancel anytime</p>
          </div>
          <ShieldCheck size={25} className="mt-1 shrink-0 text-accent-red" />
        </div>
      </div>

      {error && <ErrorCard message={error} />}

      {iosNative ? (
        <>
          <button
            type="button"
            onClick={startApplePurchase}
            disabled={purchaseLoading || !appleMonthly}
            className="btn-grit w-full min-h-14 disabled:opacity-50"
          >
            {purchaseLoading ? (
              <Loader2 size={17} className="mr-2 inline animate-spin" />
            ) : (
              <Crown size={17} className="mr-2 inline" />
            )}
            {appleTrialEligible
              ? "Start my 7-day free trial"
              : `Subscribe for ${monthlyLabel}/month`}
          </button>
          <button
            type="button"
            onClick={restorePurchase}
            disabled={purchaseLoading}
            className="btn-ghost mt-3 w-full min-h-12 disabled:opacity-50"
          >
            <RefreshCw size={14} className="mr-2 inline" /> Restore purchases
          </button>
          {appleMonthly && !exactAppleTrial && (
            <p className="mt-3 text-center text-[10px] leading-relaxed text-amber-300">
              Apple is not currently returning a seven-day introductory offer for this product, so
              DEADSET will not falsely promise one at checkout.
            </p>
          )}
          {exactAppleTrial && !appleTrialEligible && (
            <p className="mt-3 text-center text-[10px] leading-relaxed text-grit-dim">
              This Apple Account is not eligible for another introductory trial. Apple will charge
              the displayed monthly price when you confirm.
            </p>
          )}
        </>
      ) : showCheckout ? (
        <>
          <StripeEmbeddedCheckout priceId={webPriceId} returnUrl={checkoutReturnUrl} />
          <button
            type="button"
            onClick={() => setShowCheckout(false)}
            className="mt-4 w-full py-2 label-cap text-[9px] text-grit-dim"
          >
            Back
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowCheckout(true)}
            className="btn-grit w-full min-h-14"
          >
            Start my 7-day free trial
          </button>
          <button
            type="button"
            onClick={startHostedCheckout}
            disabled={checkoutLoading}
            className="btn-ghost mt-3 w-full min-h-12 disabled:opacity-50"
          >
            {checkoutLoading ? "Opening secure checkout…" : "Open checkout in a separate page"}
          </button>
        </>
      )}

      <p className="mt-4 text-center text-[10px] leading-relaxed text-grit-dim">
        {iosNative
          ? "Apple shows the exact trial, price and renewal terms before you confirm. The subscription renews automatically until cancelled."
          : "Seven days free for eligible new members, then the displayed monthly price. Cancel anytime."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link to="/profile" className="btn-ghost min-h-11 text-center text-[10px]">
          <UserRoundCog size={14} className="mr-1.5 inline" /> Account & privacy
        </Link>
        <button
          type="button"
          onClick={openBilling}
          disabled={billingLoading}
          className="btn-ghost min-h-11 text-[10px] disabled:opacity-50"
        >
          Manage subscription
        </button>
      </div>
      <div className="mt-4 flex justify-center gap-5 label-cap text-[8px] text-grit-dim">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </div>
    </MembershipShell>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-[#090909] flex items-center justify-center">
      <div className="text-center">
        <Loader2 size={24} className="mx-auto animate-spin text-accent-red" />
        <p className="label-cap mt-4 text-[10px] text-grit-dim">{label}</p>
      </div>
    </div>
  );
}

function MembershipShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="min-h-screen bg-[#090909] px-5 pb-10"
      style={{
        paddingTop: "calc(28px + env(safe-area-inset-top))",
        paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto max-w-lg">{children}</div>
    </main>
  );
}

function TrialHero({
  price,
  trialAvailable,
  trialConfigured = true,
}: {
  price: string;
  trialAvailable: boolean;
  trialConfigured?: boolean;
}) {
  return (
    <header className="deadset-pro-hero deadset-3d-panel relative mb-7 overflow-hidden rounded-[30px] border border-white/10 px-5 py-7 text-center">
      <div className="absolute inset-x-0 -top-24 mx-auto h-44 w-64 rounded-full bg-accent-red/20 blur-3xl" />
      <div className="relative">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-accent-red deadset-pulse-glow">
          <Crown size={23} className="text-white" />
        </div>
        <p className="label-cap mt-5 text-[10px] text-accent-red">YOUR SETUP IS SAVED</p>
        <h1 className="display mt-2 text-4xl font-extrabold uppercase leading-none text-white">
          Your body. Your system.
        </h1>
        <ProExperienceStage />
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-grit-dim">
          {trialAvailable
            ? `Train free for seven days. Then ${price} per month unless you cancel.`
            : trialConfigured
              ? `Your introductory trial has already been used. Continue for ${price} per month.`
              : `Continue with one monthly DEADSET membership at ${price}.`}
        </p>
        {trialAvailable && (
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-2">
            <TrialMoment label="Today" detail="Full access" active />
            <div className="h-px w-8 bg-accent-red/60" />
            <TrialMoment label="Day 8" detail={`${price}/month`} />
          </div>
        )}
      </div>
    </header>
  );
}

function ProExperienceStage() {
  return (
    <div className="deadset-pro-stage" aria-label="DEADSET Pro strength map and live programme">
      <div className="deadset-pro-aura" aria-hidden="true" />
      <div className="deadset-pro-map-card">
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white">
            Strength Map
          </span>
          <span className="flex items-center gap-1 text-[7px] font-black uppercase text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
        </div>
        <div className="-mt-1 overflow-hidden">
          <MuscleDiagram size={132} view="both" gradeColors={PRO_MAP_COLOURS} />
        </div>
      </div>
      <div className="deadset-pro-plan-card">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-white">
            Your week
          </span>
          <Sparkles size={11} className="text-accent-red" />
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1" aria-hidden="true">
          {PRO_WEEK_DAYS.map((day, index) => (
            <div key={`${day}-${index}`} className="text-center">
              <span className="block text-[6px] font-black text-grit-dim">{day}</span>
              <span
                className={`mt-1 block aspect-square rounded-[3px] border ${
                  PRO_ACTIVE_DAYS.has(index)
                    ? "border-accent-red bg-accent-red shadow-[0_0_10px_rgba(230,50,34,.42)]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1.5" aria-hidden="true">
          {PRO_PROGRESS_WIDTHS.map((width, index) => (
            <div key={width} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red" />
              <span className="h-1 rounded-full bg-white/10 flex-1 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-accent-red to-orange-400"
                  style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }}
                />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-1.5 text-left">
          <p className="text-[7px] font-black uppercase tracking-wide text-emerald-400">
            Next target ready
          </p>
          <p className="mt-0.5 text-[9px] font-black text-white">Bench press · +2.5 kg</p>
        </div>
      </div>
    </div>
  );
}

function TrialMoment({
  label,
  detail,
  active = false,
}: {
  label: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div>
      <div
        className="mx-auto h-3 w-3 rounded-full border-2"
        style={{
          background: active ? "#e63222" : "#111214",
          borderColor: active ? "#e63222" : "#5a5a5a",
        }}
      />
      <p className="mt-2 text-[10px] font-bold text-white">{label}</p>
      <p className="text-[8px] uppercase tracking-wider text-grit-dim">{detail}</p>
    </div>
  );
}

function FeatureGrid() {
  return (
    <section className="stagger mb-6 grid gap-2">
      {MEMBERSHIP_FEATURES.map((feature, index) => (
        <div
          key={feature.title}
          className="deadset-pro-feature deadset-lift tier-sheen flex gap-3 rounded-2xl border border-white/10 p-4"
          style={{ animationDelay: `${140 + index * 65}ms` }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-red/20 bg-accent-red/10 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
            <feature.icon size={18} className="text-accent-red" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{feature.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-grit-dim">{feature.detail}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-accent-red/50 bg-accent-red/10 p-3 text-center">
      <p className="text-xs leading-relaxed text-accent-red">{message}</p>
    </div>
  );
}
