import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dumbbell, TrendingUp, Apple, Swords, Users, Flame, Crown, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { useAppState } from "@/lib/storage";
import { usePro } from "@/hooks/usePro";
import { isNativeIos } from "@/lib/platform";

const SEEN_KEY = "deadset_feature_tour_v1";

type Slide = {
  icon: typeof Dumbbell;
  color: string;
  title: string;
  body: string;
  pro?: boolean;
};

const SLIDES: Slide[] = [
  {
    icon: Dumbbell,
    color: "#e63222",
    title: "Log every set, live",
    body: "Start a workout, log weight × reps as you go, and DEADSET auto-detects every PR the moment you beat it. Rest timer built in.",
  },
  {
    icon: TrendingUp,
    color: "#3b9eff",
    title: "See real progress",
    body: "Strength charts, weekly tonnage, a bodyweight trajectory, and your athlete card. Watch the numbers climb, not just vibes.",
  },
  {
    icon: Apple,
    color: "#22c55e",
    title: "Fuel it right",
    body: "Track calories and macros with a barcode scanner, hit your protein target, and keep your calorie streak alive.",
  },
  {
    icon: Swords,
    color: "#f59e0b",
    title: "Compete head-to-head",
    body: "Challenge a friend to a week-long duel — most volume, sessions or PRs wins, scored live. Take on daily challenges too.",
  },
  {
    icon: Users,
    color: "#a855f7",
    title: "Add friends & climb",
    body: "Follow lifters, react to their PRs, and climb the global and friends-only leaderboards for strength, grit and streaks.",
  },
  {
    icon: Flame,
    color: "#e63222",
    title: "Build your streak",
    body: "Train consistently to grow your streak and unlock milestones — 7, 30, 100 days and beyond. Share your streak card to flex.",
  },
  {
    icon: Crown,
    color: "#f4c33a",
    title: "DEADSET Pro",
    pro: true,
    body: "Unlock the intelligence engine — Volume Optimizer, Plateau Breaker and strength projections — plus full leagues, Streak Armor and advanced analytics. The science-based coaching, built in.",
  },
];

/**
 * One-time guided tour of every feature, shown to brand-new users after
 * onboarding. Existing users (who already have training data) are marked seen
 * silently so they're never interrupted.
 */
export function FeatureTour() {
  const [state] = useAppState();
  const { isPro } = usePro();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [i, setI] = useState(0);
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current) return;
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (seen) return;
    // Wait until onboarding has produced a profile.
    if (!state.profile) return;
    decided.current = true;
    const hasHistory = (state.sessions?.length ?? 0) > 0 || state.completedDates.length > 0;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    // Only interrupt genuinely new users; existing accounts are marked silently.
    if (!hasHistory) setShow(true);
  }, [state.profile, state.sessions, state.completedDates]);

  if (!show) return null;

  // Drop the Pro slide for users who already have Pro.
  const slides = isPro ? SLIDES.filter((s) => !s.pro) : SLIDES;
  const slide = slides[Math.min(i, slides.length - 1)];
  const last = i >= slides.length - 1;
  const Icon = slide.icon;

  const close = () => setShow(false);

  return (
    <div className="fixed inset-0 z-[130] flex flex-col" style={{ background: "#0a0a0a" }}>
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="label-cap text-[10px] text-grit-dim">
          {i + 1} / {slides.length}
        </span>
        <button onClick={close} className="text-grit-dim press label-cap text-[10px] inline-flex items-center gap-1">
          Skip <X size={13} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: `${slide.color}18`, border: `1px solid ${slide.color}40` }}
        >
          <Icon size={38} style={{ color: slide.color }} />
        </div>
        {slide.pro && (
          <span className="pro-chip text-[10px] px-1.5 py-0.5 mb-2">
            <Crown size={10} strokeWidth={2.75} /> Pro
          </span>
        )}
        <h1
          className={`display text-3xl font-extrabold uppercase leading-tight mb-3 ${slide.pro ? "text-pro-gradient" : "text-grit"}`}
        >
          {slide.title}
        </h1>
        <p className="text-sm text-grit-dim leading-relaxed max-w-xs">{slide.body}</p>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mb-5">
        {slides.map((_, idx) => (
          <div
            key={idx}
            className="h-1.5 rounded-full transition-all"
            style={{ width: idx === i ? 20 : 6, background: idx === i ? "#e63222" : "#333" }}
          />
        ))}
      </div>

      {/* Nav */}
      <div className="px-5 pb-8 flex items-center gap-3">
        {i > 0 ? (
          <button onClick={() => setI(i - 1)} className="btn-ghost px-4 inline-flex items-center gap-1">
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <div className="flex-1" />
        )}
        {i > 0 && <div className="flex-1" />}
        {slide.pro && !isNativeIos() ? (
          <button
            onClick={() => {
              close();
              navigate({ to: "/upgrade" });
            }}
            className="flex-1 rounded-lg py-3 font-display font-extrabold uppercase tracking-wide text-[#14110a]"
            style={{ background: "linear-gradient(180deg, #f8d566, #eab212)" }}
          >
            See Pro
          </button>
        ) : last ? (
          <button onClick={close} className="btn-grit flex-1 rounded-xl">
            Start training
          </button>
        ) : (
          <button onClick={() => setI(i + 1)} className="btn-grit flex-1 rounded-xl inline-flex items-center justify-center gap-1">
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
