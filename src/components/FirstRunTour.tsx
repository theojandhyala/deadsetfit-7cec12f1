import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Dumbbell, Flame, Plus } from "lucide-react";

const SEEN_KEY = "deadset_seen_tour";

type Card = {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
};

const CARDS: Card[] = [
  {
    icon: <Dumbbell size={22} />,
    eyebrow: "STEP 1",
    title: "Train your week",
    body: "Your schedule is already built. Open Train, hit Start Today's Workout, and tick off each set as you go.",
  },
  {
    icon: <Plus size={22} />,
    eyebrow: "STEP 2",
    title: "Log every set",
    body: "The red + button at the bottom starts a workout any time — even one you didn't plan. Logged sets are what everything else runs on.",
  },
  {
    icon: <Flame size={22} />,
    eyebrow: "STEP 3",
    title: "Earn grit, climb the ranks",
    body: "Finished workouts, streaks and personal bests earn grit points. Grit moves you up the ranks and onto the leaderboards.",
  },
  {
    icon: <CalendarDays size={22} />,
    eyebrow: "ANY TIME",
    title: "Change your week whenever",
    body: "Life moves. Open the Plan tab to reshape your week — change a day's focus, swap exercises, or set the sets and reps.",
  },
];

function hasSeenTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Private-mode Safari throws on localStorage; treat it as "already seen"
    // rather than showing the tour on every single launch.
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* nothing to do — the tour just shows again next launch */
  }
}

/**
 * A short, skippable walkthrough of the core loop, shown once after a lifter
 * finishes onboarding. `active` lets the caller hold it back until the app has
 * something real to show behind it.
 */
export function FirstRunTour({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (active && !hasSeenTour()) setOpen(true);
  }, [active]);

  if (!open) return null;

  const card = CARDS[idx];
  const last = idx === CARDS.length - 1;

  function close() {
    markSeen();
    setOpen(false);
  }

  return (
    <div
      // Above every other overlay (nudges 115, milestones/ProWelcome 120): this
      // shows once, on a brand-new account, and must not end up underneath a
      // promo sheet the user has no context for yet.
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/80 px-4 pb-8"
      role="dialog"
      aria-modal="true"
      aria-label="How DEADSET works"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
    >
      <div className="w-full max-w-md rounded-[1.6rem] border border-grit bg-grit-card p-6 animate-slide-up">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-accent-red"
          style={{ background: "rgba(230,50,34,0.14)" }}
        >
          {card.icon}
        </div>

        <p className="label-cap text-accent-red text-[10px] mt-4">{card.eyebrow}</p>
        <h2 className="display text-2xl font-extrabold uppercase text-grit leading-none mt-1">
          {card.title}
        </h2>
        <p className="text-sm text-grit-dim leading-relaxed mt-3">{card.body}</p>

        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          {CARDS.map((c, i) => (
            <span
              key={c.title}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= idx ? "#e63222" : "rgba(255,255,255,0.12)" }}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => (last ? close() : setIdx(idx + 1))}
            className="btn-grit min-h-[52px] rounded-2xl"
          >
            {last ? "Start training" : "Next"}
          </button>
          {last ? (
            <Link
              to="/guide"
              onClick={close}
              className="btn-ghost min-h-[48px] rounded-2xl flex items-center justify-center text-xs"
            >
              Read the full guide
            </Link>
          ) : (
            <button
              onClick={close}
              className="btn-ghost min-h-[48px] rounded-2xl text-xs"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
