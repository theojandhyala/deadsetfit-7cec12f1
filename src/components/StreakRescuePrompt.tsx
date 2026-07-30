import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

import { useAppState } from "@/lib/storage";
import { usePro } from "@/hooks/usePro";
import { isoDay } from "@/lib/calc";
import { isNativeIos } from "@/lib/platform";

const LAST_SHOWN_KEY = "deadset_streak_rescue_shown";

/** Only offer this when the lost streak was worth something. */
const MIN_STREAK = 7;
/** And never more than once a month, however many streaks get broken. */
const COOLDOWN_DAYS = 30;

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Consecutive completed days ending on `end`, walking backwards. */
function streakEndingAt(completed: Set<string>, end: Date): number {
  let n = 0;
  const cursor = new Date(end);
  while (completed.has(isoDay(cursor))) {
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

function offCooldown(): boolean {
  try {
    const last = localStorage.getItem(LAST_SHOWN_KEY);
    if (!last) return true;
    const elapsed = (Date.now() - new Date(last).getTime()) / 86400000;
    return elapsed >= COOLDOWN_DAYS;
  } catch {
    // No storage means no memory of showing it, and a prompt that reappears
    // every launch is exactly the nagging this is meant to avoid.
    return false;
  }
}

/**
 * Shown to a free lifter the day after a real streak broke — the one moment
 * Streak Armor is genuinely worth explaining.
 *
 * Deliberately restrained: a meaningful streak only, once a month at most, and
 * dismissible without a decision. On native iOS it explains and stops there,
 * since App Store 3.1.1 forbids prices or purchase routes in the app.
 */
export function StreakRescuePrompt() {
  const [state] = useAppState();
  const { isPro, loading } = usePro();
  const [open, setOpen] = useState(false);
  const [lostStreak, setLostStreak] = useState(0);

  useEffect(() => {
    if (loading || isPro || !state.profile) return;

    const completed = new Set(state.completedDates);
    const missedYesterday = !completed.has(isoDay(daysAgo(1)));
    const trainedDayBefore = completed.has(isoDay(daysAgo(2)));
    if (!missedYesterday || !trainedDayBefore) return;

    const broken = streakEndingAt(completed, daysAgo(2));
    if (broken < MIN_STREAK || !offCooldown()) return;

    setLostStreak(broken);
    setOpen(true);
    try {
      localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
    } catch {
      /* nothing to remember it with — the cooldown check already bailed out */
    }
  }, [loading, isPro, state.completedDates, state.profile]);

  if (!open) return null;

  const ios = isNativeIos();

  return (
    <div
      className="fixed inset-0 z-[118] flex items-end justify-center bg-black/80 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Streak Armor"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
    >
      <div className="w-full max-w-md rounded-[1.6rem] border border-grit bg-grit-card p-6 animate-slide-up">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-accent-red"
          style={{ background: "rgba(230,50,34,0.14)" }}
        >
          <Shield size={22} />
        </div>

        <p className="label-cap text-accent-red text-[10px] mt-4">Your streak broke</p>
        <h2 className="display text-2xl font-extrabold uppercase text-grit leading-none mt-1">
          {lostStreak} days, gone
        </h2>
        <p className="text-sm text-grit-dim leading-relaxed mt-3">
          You missed yesterday, so a {lostStreak}-day streak reset to zero. Streak
          Armor gives you three shields a month — a missed day gets covered
          automatically and the streak keeps running.
        </p>
        {ios && (
          <p className="text-xs text-grit-dim leading-relaxed mt-3">
            Pro is managed on the DEADSET website.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {ios ? (
            <button onClick={() => setOpen(false)} className="btn-grit min-h-[52px] rounded-2xl">
              Got it
            </button>
          ) : (
            <>
              <Link
                to="/upgrade"
                onClick={() => setOpen(false)}
                className="btn-grit min-h-[52px] rounded-2xl flex items-center justify-center"
              >
                See how Streak Armor works
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="btn-ghost min-h-[48px] rounded-2xl text-xs"
              >
                No thanks — start a new streak
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
