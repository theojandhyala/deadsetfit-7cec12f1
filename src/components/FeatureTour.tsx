import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Camera,
  Timer,
  BicepsFlexed,
  CalendarDays,
  Check,
  Dumbbell,
  HeartPulse,
  Library,
  Plus,
  Settings,
  Utensils,
  Users,
  Crown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useAppState } from "@/lib/storage";
import { usePro } from "@/hooks/usePro";
import { isNativeIos } from "@/lib/platform";
import { FEATURE_TOUR_REPLAY_EVENT, FEATURE_TOUR_SEEN_KEY } from "@/lib/feature-tour";
import { hapticSelection, hapticSetupComplete } from "@/lib/haptics";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { TourDemo, type DemoKind } from "@/components/TourDemo";

type Slide = {
  icon: typeof Dumbbell;
  color: string;
  eyebrow: string;
  title: string;
  body: string;
  tips: string[];
  pro?: boolean;
  /** The looping demonstration shown above the copy. */
  demo?: DemoKind;
};

const SLIDES: Slide[] = [
  {
    icon: Dumbbell,
    color: "#e63222",
    eyebrow: "Welcome",
    title: "Your app in one minute",
    body: "DEADSET keeps your training week, live workouts, nutrition, health, progress and competition in one place.",
    tips: [
      "Train is your home for today",
      "Plan shows and edits the full week",
      "The centre + starts a workout from anywhere",
    ],
  },
  {
    icon: CalendarDays,
    color: "#f59e0b",
    eyebrow: "Plan",
    demo: "week",
    title: "Build the week first",
    body: "Open Plan to see every training day. Choose a day, set its focus, then add or reorder the exercises you actually want to do.",
    tips: [
      "Set working sets and rep targets before training",
      "Link adjacent exercises into timed supersets",
      "Adjust rest, tempo, RIR and private cues",
      "Use Programs when you want a proven starting point",
    ],
  },
  {
    icon: Plus,
    color: "#e63222",
    eyebrow: "Live workout",
    demo: "logging",
    title: "Log the set in front of you",
    body: "Tap the centre + or Start Workout. Enter a working weight once, then tick sets as you complete them.",
    tips: [
      "Previous performance and targets stay together",
      "Superset rounds, rest timers, warm-up ramps and drop sets are built in",
      "Personal records are detected automatically",
    ],
  },
  {
    icon: Timer,
    color: "#38bdf8",
    eyebrow: "Rest timer",
    demo: "rest",
    title: "Rest is timed for you",
    body: "Tick a set and the rest clock starts itself. It counts down against a deadline, so it stays exact with the phone locked, the app closed or your wrist raised.",
    tips: [
      "Live Activity and Dynamic Island show it without unlocking",
      "Apple Watch buzzes when the set is due",
      "Per-exercise rest lengths, editable any time",
    ],
  },
  {
    icon: Camera,
    color: "#e879f9",
    eyebrow: "Progress photos",
    demo: "photos",
    title: "The mirror lies. The camera doesn't.",
    body: "A weekly check-in photo is the only honest record of a body changing. Progress opens on your before-and-after, and turns it into a card worth posting.",
    tips: [
      "Photos never leave your device unless you share them",
      "Bodyweight change is matched to each shot automatically",
      "Two shots a fortnight apart unlock the comparison",
    ],
  },
  {
    icon: Utensils,
    color: "#22c55e",
    eyebrow: "Food & hydration",
    demo: "nutrition",
    title: "Keep fuel visible",
    body: "Food sits near the top of Train in the Daily Hub. Use Diary for today and Insights for trends and coaching.",
    tips: [
      "Search foods, scan a barcode or log manually",
      "Save common meals and track protein and calories",
      "Log water in one tap throughout the day",
    ],
  },
  {
    icon: BarChart3,
    color: "#3b9eff",
    eyebrow: "Progress",
    title: "See what is changing",
    body: "Progress brings your workout history, strength trends, bodyweight, measurements, photos and personal records together.",
    tips: [
      "Log weight regularly to build a useful trend",
      "Use weekly photos with consistent lighting",
      "Open any lift to review its full history",
    ],
  },
  {
    icon: BicepsFlexed,
    color: "#a43ac2",
    eyebrow: "Strength Map",
    demo: "strength",
    title: "See the body your lifts are building",
    body: "Strength turns your real logged lifts into a front-and-back muscle map, adjusted for your bodyweight instead of guessed from activity.",
    tips: [
      "Grey shows exactly which areas still need an exercise or logged result",
      "Tap any muscle for a rule-based growth game plan and recommended movements",
      "Share a 9:16 Strength Map card when the colours change",
    ],
  },
  {
    icon: HeartPulse,
    color: "#14b8a6",
    eyebrow: "Health & recovery",
    demo: "health",
    title: "Train around real readiness",
    body: "Recovery turns soreness, sleep and recent training into a clear view of what is ready and what needs more time.",
    tips: [
      "Connect Apple Health and Watch from Settings",
      "See steps, rings, heart rate and watch workouts",
      "Use a recovery session when hard training is not the right call",
    ],
  },
  {
    icon: Users,
    color: "#f97316",
    eyebrow: "Friends & ranks",
    demo: "friends",
    title: "Build your crew",
    body: "Search usernames, follow friends, share lifts and compare progress without exposing your exact location.",
    tips: [
      "Friends contains your crew, feed, arena and invites",
      "Challenges include timed tests and head-to-head duels",
      "Training, PRs and consistency move your ranked division",
    ],
  },
  {
    icon: Library,
    color: "#a3e635",
    eyebrow: "Exercise library",
    demo: "library",
    title: "Find any movement",
    body: "The Library contains form guidance, muscles worked, equipment, difficulty and a direct way to add an exercise to any day.",
    tips: [
      "Search by exercise name",
      "Filter by movement type or equipment",
      "Open a movement for form cues and video",
    ],
  },
  {
    icon: Settings,
    color: "#94a3b8",
    eyebrow: "Settings & data",
    title: "Make it yours",
    body: "Settings controls reminders, hydration, Apple Health, cloud status and your data.",
    tips: [
      "Download a full backup or workout CSV",
      "Import an existing DEADSET backup",
      "Replay this tutorial whenever you need it",
    ],
  },
  {
    icon: Crown,
    color: "#f4c33a",
    eyebrow: "Your membership",
    demo: "membership",
    title: "DEADSET intelligence",
    pro: true,
    body: "Your membership includes the complete training loop, automation, advanced programming and deeper analysis.",
    tips: [
      "Training Autopilot applies progression decisions",
      "Plan Intelligence audits volume and recovery spacing",
      "Streak Armor, full leagues and advanced analytics",
    ],
  },
  {
    icon: Check,
    color: "#22c55e",
    eyebrow: "Ready",
    title: "Start with today",
    body: "You do not need to set up everything at once. Check today on Train, adjust the week in Plan, then log your first real session.",
    tips: [
      "Train: what you are doing today",
      "Plan: what you are doing this week",
      "Progress: what your work is producing",
    ],
  },
];

function markFeatureTourSeen() {
  try {
    localStorage.setItem(FEATURE_TOUR_SEEN_KEY, "1");
  } catch {
    /* Local storage can be unavailable in restricted browser modes. */
  }
}

/**
 * One-time guided tour of every feature, shown to brand-new users after
 * onboarding. Existing users (who already have training data) are marked seen
 * silently so they're never interrupted.
 */
export function FeatureTour({ active = true }: { active?: boolean }) {
  const [state] = useAppState();
  const { isPro } = usePro();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [i, setI] = useState(0);
  const decided = useRef(false);

  useEffect(() => {
    if (!active) {
      decided.current = false;
      setShow(false);
      return;
    }
    if (decided.current) return;
    let seen = true;
    try {
      seen = localStorage.getItem(FEATURE_TOUR_SEEN_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (seen) {
      decided.current = true;
      return;
    }
    // Wait until onboarding has produced a profile.
    if (!state.profile) return;
    decided.current = true;
    const hasHistory = (state.sessions?.length ?? 0) > 0 || state.completedDates.length > 0;
    // New users get the walkthrough automatically. Existing users can replay it
    // from Settings without being interrupted after an update.
    if (hasHistory) {
      markFeatureTourSeen();
      return;
    }
    setI(0);
    setShow(true);
  }, [active, state.profile, state.sessions, state.completedDates]);

  useEffect(() => {
    const replay = () => {
      decided.current = false;
      setI(0);
      if (!active || !state.profile) return;
      decided.current = true;
      setShow(true);
    };
    window.addEventListener(FEATURE_TOUR_REPLAY_EVENT, replay);
    return () => window.removeEventListener(FEATURE_TOUR_REPLAY_EVENT, replay);
  }, [active, state.profile]);

  useEffect(() => {
    if (!show) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      markFeatureTourSeen();
      hapticSelection();
      setShow(false);
    };

    const unlock = lockBodyScroll();
    window.addEventListener("keydown", onKeyDown);

    return () => {
      unlock();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [show]);

  if (!show) return null;

  // Members already have it, so the pitch is noise to them. Everyone else sees
  // it, iOS included: DEADSET is a subscription sold through Apple now, and
  // withholding what it includes from the people being asked to pay for it is
  // the exact opposite of not hiding things.
  const slides = isPro ? SLIDES.filter((s) => !s.pro) : SLIDES;
  const slide = slides[Math.min(i, slides.length - 1)];
  const last = i >= slides.length - 1;
  const Icon = slide.icon;

  const close = () => {
    markFeatureTourSeen();
    hapticSetupComplete();
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-tour-title"
      className="fixed inset-0 z-[130] flex flex-col overflow-y-auto"
      style={{ background: "#0a0a0a" }}
    >
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="label-cap text-[10px] text-grit-dim">
          {i + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Skip app tutorial"
          className="text-grit-dim press label-cap text-[10px] inline-flex items-center gap-1"
        >
          Skip <X size={13} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-5 text-center">
        {slide.demo ? (
          // Keyed on the slide so the animations restart on every advance —
          // a demo that plays once and then sits still on later visits is
          // just a screenshot.
          <div className="mb-5 w-full max-w-sm">
            <TourDemo key={`${slide.eyebrow}-${i}`} kind={slide.demo} />
          </div>
        ) : (
          <div
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: `${slide.color}18`, border: `1px solid ${slide.color}40` }}
          >
            <Icon size={38} style={{ color: slide.color }} />
          </div>
        )}
        {slide.pro && (
          <span className="pro-chip text-[10px] px-1.5 py-0.5 mb-2">
            <Crown size={10} strokeWidth={2.75} /> Pro
          </span>
        )}
        <p className="label-cap mb-2 text-[10px]" style={{ color: slide.color }}>
          {slide.eyebrow}
        </p>
        <h1
          id="feature-tour-title"
          className={`display text-3xl font-extrabold uppercase leading-tight mb-3 ${slide.pro ? "text-pro-gradient" : "text-grit"}`}
        >
          {slide.title}
        </h1>
        <p className="text-sm text-grit-dim leading-relaxed max-w-xs">{slide.body}</p>
        <div className="mt-5 w-full max-w-sm rounded-xl border border-grit bg-grit-card p-4 text-left">
          {slide.tips.map((tip) => (
            <div key={tip} className="flex gap-2.5 py-1.5 text-xs leading-relaxed text-grit">
              <Check size={14} className="mt-0.5 shrink-0" style={{ color: slide.color }} />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mb-5">
        {slides.map((_, idx) => (
          <div
            key={idx}
            aria-hidden="true"
            className="h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out"
            style={{ width: idx === i ? 20 : 6, background: idx === i ? "#e63222" : "#333" }}
          />
        ))}
      </div>

      {/* Nav */}
      <div className="flex w-full max-w-md self-center px-5 pb-8 items-center gap-3">
        {i > 0 ? (
          <button
            type="button"
            onClick={() => {
              hapticSelection();
              setI(i - 1);
            }}
            className="btn-ghost px-4 inline-flex items-center gap-1"
          >
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <div className="flex-1" />
        )}
        {i > 0 && <div className="flex-1" />}
        {last ? (
          <button
            type="button"
            onClick={() => {
              close();
              navigate({ to: "/train" });
            }}
            className="btn-grit flex-1 rounded-xl"
          >
            Go to today
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              hapticSelection();
              setI(i + 1);
            }}
            className="btn-grit flex-1 rounded-xl inline-flex items-center justify-center gap-1"
          >
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
