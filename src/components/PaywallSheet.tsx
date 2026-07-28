import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Crown,
  X,
  Check,
  Shield,
  BarChart3,
  ClipboardList,
  Hammer,
  Trophy,
  Swords,
  Bell,
  HeartPulse,
  Apple,
  Camera,
  Medal,
  TrendingUp,
  FileBarChart,
  SlidersHorizontal,
  Gauge,
  ClipboardCheck,
  Flag,
} from "lucide-react";
import { onPaywall, type PaywallFeature } from "@/lib/paywall-events";
import {
  detectCountry,
  currencyForCountry,
  CURRENCY_META,
  type SupportedCurrency,
} from "@/lib/currency";
import { isNativeIos } from "@/lib/platform";

const FEATURE_PITCH: Record<
  PaywallFeature,
  { title: string; tagline: string; bullets: string[]; icon: typeof Shield }
> = {
  autopilot: {
    title: "Training Autopilot",
    tagline: "Your programme updates itself.",
    bullets: [
      "Prescribes every next-session load from completed reps and effort",
      "Detects stalls and repeated misses, then applies the correct reset",
      "Calls recovery deloads and updates weights and sets across your plan",
    ],
    icon: Gauge,
  },
  "weekly-review": {
    title: "Pro Weekly Review",
    tagline: "Open the app. Know the next three moves.",
    bullets: [
      "Combines progression, plateaus, volume, balance and PR targets",
      "Turns your logged data into a short, prioritized action queue",
      "A clear week score shows whether training is actually moving",
    ],
    icon: ClipboardCheck,
  },
  "pr-roadmap": {
    title: "PR Roadmap",
    tagline: "Put a number and a date on the next milestone.",
    bullets: [
      "Set target estimated maxes for every tracked lift",
      "See the exact gap and progress percentage",
      "Project milestone dates from your real strength trend",
    ],
    icon: Flag,
  },
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
    title: "League Competition",
    tagline: "Turn training into a season.",
    bullets: [
      "Weekly competitive scoring and season placement",
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
  "plan-audit": {
    title: "Plan Intelligence",
    tagline: "Fix the week before it costs you progress.",
    bullets: [
      "Weekly muscle-volume and recovery audit",
      "A clear plan score that updates as you edit",
      "One-tap rebalancing around your goal, equipment and available days",
    ],
    icon: ClipboardList,
  },
  "advanced-programming": {
    title: "Advanced Programming",
    tagline: "Make every movement run exactly your way.",
    bullets: [
      "Per-exercise progression rules and rest timers",
      "RIR and tempo targets inside the live workout",
      "Private technique cues and coach notes",
    ],
    icon: SlidersHorizontal,
  },
  "smart-swaps": {
    title: "Smart Exercise Swaps",
    tagline: "Busy equipment never ruins the session.",
    bullets: [
      "Instant alternatives for the same target muscle",
      "Filtered to equipment you actually have",
      "Sets, reps, load, rest and coaching cues stay intact",
    ],
    icon: Hammer,
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
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/90" onClick={close} />
      <div
        className="relative w-full max-w-md animate-slide-up overflow-hidden border border-pro/40 bg-[#101113] p-6"
        style={{
          paddingBottom: "calc(2.25rem + env(safe-area-inset-bottom))",
          borderRadius: "8px 8px 0 0",
          boxShadow: "0 -28px 72px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.06)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-pro" />
        <button
          onClick={close}
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-md border border-white/10 text-grit-dim press"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <Crown size={16} className="text-pro" />
          <span className="label-cap text-pro">DEADSET Pro</span>
        </div>

        <div className="mb-1 flex items-start gap-3">
          <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-pro/30 bg-pro/10">
            <Icon size={20} className="text-pro" />
          </div>
          <div>
            <h2 className="display text-3xl font-black uppercase leading-none text-grit">
              {pitch.title}
            </h2>
            <p className="text-sm text-grit-dim mt-0.5">{pitch.tagline}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-1 border-y border-white/10 py-3">
          {pitch.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 py-2 text-sm text-grit">
              <Check size={15} className="mt-0.5 shrink-0 text-pro" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {isNativeIos() ? (
          // App Store Guideline 3.1.1: no price, no external-purchase CTA on iOS.
          <>
            <p className="mt-6 text-sm text-grit-dim leading-relaxed">
              This is a DEADSET Pro feature. Pro isn't available on iPhone yet.
            </p>
            <button onClick={close} className="btn-grit w-full mt-4 py-3.5">
              Got it
            </button>
          </>
        ) : (
          <>
            <div className="mt-6 flex items-baseline gap-2 border-l-2 border-pro pl-3">
              <span className="display text-4xl font-black text-grit">{money.monthly}</span>
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
            <button
              onClick={close}
              className="w-full mt-2 py-2 label-cap text-[10px] text-grit-dim press"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
