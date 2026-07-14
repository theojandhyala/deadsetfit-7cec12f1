import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Crown, X, Check, Shield, BarChart3, ClipboardList, Hammer, Trophy, Swords, Bell, HeartPulse, Apple, Camera, Medal, TrendingUp, FileBarChart } from "lucide-react";
import { onPaywall, type PaywallFeature } from "@/lib/paywall-events";
import { detectCountry, currencyForCountry, CURRENCY_META, type SupportedCurrency } from "@/lib/currency";

const FEATURE_PITCH: Record<
  PaywallFeature,
  { title: string; tagline: string; bullets: string[]; icon: typeof Shield }
> = {
  "streak-armor": {
    title: "Streak Armor",
    tagline: "Miss a day. Keep the fire.",
    bullets: [
      "3 shields every month, auto-applied when you miss a day",
      "Your streak — and the grit it earns — survives",
      "Shields refill on the 1st, no action needed",
    ],
    icon: Shield,
  },
  "advanced-analytics": {
    title: "Advanced Analytics",
    tagline: "See exactly what's working.",
    bullets: [
      "Muscle-group volume balance and weekly tonnage",
      "Strength curves and consistency heatmap",
      "All computed from your own training history",
    ],
    icon: BarChart3,
  },
  "featured-programs": {
    title: "Featured Programs",
    tagline: "Proven programming, one tap.",
    bullets: [
      "5/3/1 BBB, StrongLifts 5×5, PHUL, Arnold Split, nSuns",
      "Full exercises, sets and reps — ready to run",
      "Swap or edit anything after you apply",
    ],
    icon: ClipboardList,
  },
  "custom-programs": {
    title: "Unlimited Custom Programs",
    tagline: "Build every block you'll ever run.",
    bullets: [
      "Free covers one custom program — Pro removes the cap",
      "Design, save and switch between full training blocks",
      "Keep old blocks for reference and re-runs",
    ],
    icon: Hammer,
  },
  leagues: {
    title: "Full Weekly Leagues",
    tagline: "Climb every division.",
    bullets: [
      "Full ranked ladder access, all divisions",
      "Grit-ranked leaderboard placement",
      "Season standing on your profile card",
    ],
    icon: Trophy,
  },
  h2h: {
    title: "Head-to-Head Challenges",
    tagline: "Call someone out.",
    bullets: [
      "Challenge any lifter you follow",
      "Posted to the feed — the gym is watching",
      "Winner takes the bragging rights",
    ],
    icon: Swords,
  },
  reminders: {
    title: "Smart Reminders",
    tagline: "Never drift for a week again.",
    bullets: [
      "Training-day nudges tuned to your split",
      "Hydration and check-in reminders",
      "Quiet by default — loud when it matters",
    ],
    icon: Bell,
  },
  recovery: {
    title: "Muscle Recovery Tracking",
    tagline: "Know what's fresh before you load the bar.",
    bullets: [
      "Per-muscle recovery bars from your real training",
      "Volume-aware recovery windows, not guesses",
      "Train what's ready, spare what's fried",
    ],
    icon: HeartPulse,
  },
  nutrition: {
    title: "Advanced Nutrition",
    tagline: "See the week, not just the plate.",
    bullets: [
      "7-day calorie and macro averages",
      "Protein per kg of bodyweight, tracked daily",
      "Macro split and target-hit consistency",
    ],
    icon: Apple,
  },
  photos: {
    title: "Photo Comparison",
    tagline: "Proof you can see.",
    bullets: [
      "Side-by-side any two check-ins",
      "Date and bodyweight delta on every compare",
      "Your whole timeline, one swipe apart",
    ],
    icon: Camera,
  },
  challenges: {
    title: "Elite Challenges",
    tagline: "The tests most lifters never attempt.",
    bullets: [
      "Pro-exclusive ELITE tier with big XP",
      "Exclusive badges for your trophy case",
      "Bragging rights that show on your card",
    ],
    icon: Medal,
  },
  progression: {
    title: "Progression Intelligence",
    tagline: "Know the next weight before you touch the bar.",
    bullets: [
      "Ghost Mode — race your last session set-by-set",
      "Weight evolution for every lift, session by session",
      "Next-weight suggestions when you beat your plan",
    ],
    icon: TrendingUp,
  },
  report: {
    title: "Weekly Report Card",
    tagline: "Your week, graded like it matters.",
    bullets: [
      "A–F grade from consistency, sets and PRs",
      "Volume and session deltas vs the week before",
      "Lands every Monday — no work required",
    ],
    icon: FileBarChart,
  },
};

export function PaywallSheet() {
  const [feature, setFeature] = useState<PaywallFeature | null>(null);
  const [currency, setCurrency] = useState<SupportedCurrency>("usd");
  const navigate = useNavigate();

  useEffect(() => onPaywall((e) => setFeature(e.feature)), []);
  useEffect(() => {
    let alive = true;
    detectCountry().then((c) => {
      if (alive) setCurrency(currencyForCountry(c));
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!feature) return null;
  const pitch = FEATURE_PITCH[feature];
  const Icon = pitch.icon;
  const money = CURRENCY_META[currency];
  const close = () => setFeature(null);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div
        className="relative w-full max-w-md bg-grit-card border rounded-t-3xl rounded-b-none p-6 animate-slide-up"
        style={{ paddingBottom: "calc(2.25rem + env(safe-area-inset-bottom))" }}
      >
        <button onClick={close} className="absolute top-4 right-4 text-grit-dim press" aria-label="Close">
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Crown size={16} className="text-accent-red" />
          <span className="label-cap text-accent-red">DEADSET Pro</span>
        </div>

        <div className="flex items-start gap-3 mb-1">
          <div className="mt-1 shrink-0 w-10 h-10 rounded-xl border border-grit bg-[#0f0f0f] flex items-center justify-center">
            <Icon size={20} className="text-accent-red" />
          </div>
          <div>
            <h2 className="text-2xl uppercase leading-tight text-grit">{pitch.title}</h2>
            <p className="text-sm text-grit-dim mt-0.5">{pitch.tagline}</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2.5">
          {pitch.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-grit">
              <Check size={15} className="text-accent-red mt-0.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-baseline gap-2">
          <span className="display text-3xl text-grit">{money.monthly}</span>
          <span className="label-cap text-[10px]">/ month</span>
          <span className="ml-auto label-cap text-[10px]">or {money.yearly}/yr</span>
        </div>

        <button
          onClick={() => {
            close();
            navigate({ to: "/upgrade" });
          }}
          className="btn-grit w-full mt-4 py-3.5"
        >
          Go Pro
        </button>
        <button onClick={close} className="w-full mt-2 py-2 label-cap text-[10px] text-grit-dim press">
          Not now
        </button>
      </div>
    </div>
  );
}
