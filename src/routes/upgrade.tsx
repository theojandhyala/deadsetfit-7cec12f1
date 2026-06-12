import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft, Crown, Check, Loader2, Brain, Shield, BarChart3,
  Swords, Camera, Zap, Star, Users, Trophy, Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { usePro } from "@/hooks/usePro";
import {
  detectCountry,
  currencyForCountry,
  CURRENCY_META,
  priceIdFor,
  type SupportedCurrency,
} from "@/lib/currency";

export const Route = createFileRoute("/upgrade")({
  head: () => ({ meta: [{ title: "DEADSET — Go Pro" }] }),
  component: UpgradePage,
});

const PRO_FEATURES = [
  {
    icon: Brain,
    color: "#FC4C02",
    title: "AI Coach — Unlimited",
    desc: "Personalized advice on form, programming, and recovery. Powered by Claude. Available 24/7.",
  },
  {
    icon: Shield,
    color: "#4CAF50",
    title: "Streak Armor",
    desc: "Protect your streak on rest days. Use freeze tokens to keep your momentum when life happens.",
  },
  {
    icon: Camera,
    color: "#9C27B0",
    title: "AI Body Scanner",
    desc: "Upload a photo for an instant AI physique analysis — body fat estimate, muscle symmetry score, and actionable focus areas.",
  },
  {
    icon: BarChart3,
    color: "#2196F3",
    title: "Advanced Analytics",
    desc: "Volume trends, PR prediction curves, muscle balance heatmaps, and weekly performance reports.",
  },
  {
    icon: Swords,
    color: "#FFB800",
    title: "Head-to-Head Challenges",
    desc: "Challenge friends directly. Most reps, most volume, most sessions — set the stakes and settle it.",
  },
  {
    icon: Trophy,
    color: "#FC4C02",
    title: "Weekly Leagues — Full Access",
    desc: "Compete in Iron → Bronze → Silver → Gold → Elite Diamond divisions. Promote, relegate, dominate.",
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
    desc: "Build your own split from scratch or let the AI generate one based on your goals, equipment, and schedule.",
  },
];

const COMPARE_ROWS = [
  { label: "Workout logging", free: true, pro: true },
  { label: "Basic programs", free: true, pro: true },
  { label: "Social feed & kudos", free: true, pro: true },
  { label: "Challenges (basic)", free: true, pro: true },
  { label: "AI Coach", free: false, pro: true },
  { label: "Streak Armor", free: false, pro: true },
  { label: "AI Body Scanner", free: false, pro: true },
  { label: "Advanced analytics", free: false, pro: true },
  { label: "H2H Challenges", free: false, pro: true },
  { label: "Full Weekly Leagues", free: false, pro: true },
  { label: "Featured programs", free: false, pro: true },
  { label: "Custom program builder", free: false, pro: true },
];

function UpgradePage() {
  const navigate = useNavigate();
  const { isPro, loading } = usePro();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [currency, setCurrency] = useState<SupportedCurrency>("usd");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111215" }}>
        <Loader2 className="animate-spin" size={24} style={{ color: "#FC4C02" }} />
      </div>
    );
  }

  if (isPro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "#111215" }}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "linear-gradient(135deg, #FC4C02 0%, #ff6a24 100%)", boxShadow: "0 8px 32px rgba(252,76,2,0.5)" }}
        >
          <Crown size={36} color="#fff" />
        </div>
        <h1 className="display text-3xl font-extrabold text-white uppercase tracking-wider">You're Pro</h1>
        <p className="mt-2 text-sm" style={{ color: "#9EA3AE" }}>All features unlocked. Train harder.</p>
        <Link to="/train" className="btn-grit mt-6 px-8">Back to training</Link>
        <Link to="/settings" className="mt-3 text-xs uppercase tracking-widest" style={{ color: "#6B7280" }}>
          Manage subscription
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "#111215", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <PaymentTestModeBanner />

      <div className="px-4 py-4">
        <button
          onClick={() => navigate({ to: "/train" })}
          className="flex items-center gap-1 press"
          style={{ color: "#9EA3AE" }}
        >
          <ChevronLeft size={18} />
          <span className="text-xs uppercase tracking-widest">Back</span>
        </button>
      </div>

      {!showCheckout ? (
        <div className="px-5 pb-16">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #FC4C02 0%, #ff6a24 100%)", boxShadow: "0 8px 32px rgba(252,76,2,0.4)" }}
            >
              <Crown size={28} color="#fff" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#FC4C02" }}>
              DEADSET Pro
            </p>
            <h1 className="display text-4xl font-extrabold text-white uppercase leading-tight">
              Train Smarter.<br />Dominate.
            </h1>
            <p className="mt-3 text-sm" style={{ color: "#9EA3AE" }}>
              Everything you need to go from good to elite.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1.5">
                <Users size={13} style={{ color: "#FC4C02" }} />
                <span className="text-xs font-bold text-white">2,400+ athletes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star size={13} style={{ color: "#FFB800" }} />
                <span className="text-xs font-bold text-white">4.9 rating</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame size={13} style={{ color: "#FC4C02" }} />
                <span className="text-xs font-bold text-white">Top 1% gains</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            {PRO_FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-4 p-4 rounded-2xl"
                style={{ background: "#1C1D21", border: "1.5px solid #2C2D33" }}
              >
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ width: 44, height: 44, background: `${f.color}18`, border: `1px solid ${f.color}30` }}
                >
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#9EA3AE" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowCompare(v => !v)}
            className="w-full text-center text-xs font-bold uppercase tracking-widest mb-4 py-2 press"
            style={{ color: "#FC4C02" }}
          >
            {showCompare ? "Hide" : "See"} Free vs Pro comparison
          </button>
          {showCompare && (
            <div className="mb-8 rounded-2xl overflow-hidden" style={{ border: "1.5px solid #2C2D33" }}>
              <div className="grid grid-cols-3 px-4 py-3" style={{ background: "#1C1D21", borderBottom: "1px solid #2C2D33" }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#9EA3AE" }}>Feature</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: "#9EA3AE" }}>Free</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: "#FC4C02" }}>Pro</span>
              </div>
              {COMPARE_ROWS.map((row, i) => (
                <div key={row.label} className="grid grid-cols-3 px-4 py-2.5 items-center"
                  style={{ background: i % 2 === 0 ? "#1C1D21" : "#17181C", borderBottom: i < COMPARE_ROWS.length - 1 ? "1px solid #2C2D33" : "none" }}>
                  <span className="text-xs text-white col-span-1">{row.label}</span>
                  <span className="text-center text-sm font-bold" style={{ color: row.free ? "#4CAF50" : "#3a3a3a" }}>{row.free ? "✓" : "✗"}</span>
                  <span className="text-center text-sm font-bold" style={{ color: "#FC4C02" }}>✓</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 mb-6">
            <button onClick={() => setPlan("yearly")} className="w-full text-left p-4 rounded-2xl relative press"
              style={{ background: plan === "yearly" ? "rgba(252,76,2,0.1)" : "#1C1D21", border: `2px solid ${plan === "yearly" ? "#FC4C02" : "#2C2D33"}` }}>
              <span className="absolute -top-2.5 left-4 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white" style={{ background: "#FC4C02" }}>
                Most Popular · Save 33%
              </span>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-bold text-white text-sm uppercase tracking-wider">Yearly</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#9EA3AE" }}>Best value — billed annually</p>
                </div>
                <div className="text-right">
                  <p className="display text-2xl font-extrabold text-white">{priceLabels.yearly}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "#9EA3AE" }}>/ year</p>
                </div>
              </div>
            </button>
            <button onClick={() => setPlan("monthly")} className="w-full text-left p-4 rounded-2xl press"
              style={{ background: plan === "monthly" ? "rgba(252,76,2,0.1)" : "#1C1D21", border: `2px solid ${plan === "monthly" ? "#FC4C02" : "#2C2D33"}` }}>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-bold text-white text-sm uppercase tracking-wider">Monthly</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#9EA3AE" }}>Flexible — cancel anytime</p>
                </div>
                <div className="text-right">
                  <p className="display text-2xl font-extrabold text-white">{priceLabels.monthly}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "#9EA3AE" }}>/ month</p>
                </div>
              </div>
            </button>
          </div>

          <button onClick={() => setShowCheckout(true)} className="btn-grit w-full py-4 text-base">
            <Crown size={16} className="inline mr-2" /> Unlock DEADSET Pro
          </button>
          <p className="mt-3 text-center text-[10px] uppercase tracking-widest" style={{ color: "#6B7280" }}>
            Cancel anytime · No questions asked
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {[
              { name: "Jake M.", quote: "The AI coach alone is worth it. Finally broke my bench plateau.", badge: "BEAST" },
              { name: "Sarah K.", quote: "Streak Armor saved me during a work trip. Came back fired up.", badge: "GRINDER" },
              { name: "Tom R.", quote: "Leagues make everything competitive. I train harder every single week.", badge: "ELITE" },
            ].map((t) => (
              <div key={t.name} className="p-4 rounded-2xl" style={{ background: "#1C1D21", border: "1.5px solid #2C2D33" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-extrabold display text-sm" style={{ background: "#FC4C02" }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{t.name}</p>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(252,76,2,0.15)", color: "#FC4C02", border: "1px solid rgba(252,76,2,0.3)" }}>
                      {t.badge}
                    </span>
                  </div>
                  <div className="ml-auto flex">
                    {[1,2,3,4,5].map(s => <Star key={s} size={10} fill="#FFB800" style={{ color: "#FFB800" }} />)}
                  </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#9EA3AE" }}>“{t.quote}”</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-2 pb-12">
          <StripeEmbeddedCheckout
            priceId={priceId}
            customerEmail={user.email}
            userId={user.id}
            returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
          />
          <button onClick={() => setShowCheckout(false)} className="mt-4 w-full text-center text-[11px] uppercase tracking-widest press" style={{ color: "#9EA3AE" }}>
            ← Back to plans
          </button>
        </div>
      )}
    </div>
  );
}
