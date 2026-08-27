import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BellRing, Dumbbell, X } from "lucide-react";

import { useAppState } from "@/lib/storage";

const DISMISSED_UNTIL_KEY = "deadset_first_week_activation_until";
const NUDGE_GAP_MS = 3 * 86_400_000;

function mayShow() {
  try {
    return Number(localStorage.getItem(DISMISSED_UNTIL_KEY) || "0") <= Date.now();
  } catch {
    return true;
  }
}

function dismissForThreeDays() {
  try {
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + NUDGE_GAP_MS));
  } catch {
    /* The nudge remains optional if browser storage is unavailable. */
  }
}

/**
 * Gives a new member one clear next action before the first completed workout.
 * It is local, frequency-capped, and never interrupts an active session.
 */
export function FirstWeekActivationNudge() {
  const [state] = useAppState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const hasFinishedWorkout = state.sessions.some((session) => !!session.endedAt);
  const eligible = !!state.profile && !!state.schedule && !hasFinishedWorkout;

  useEffect(() => {
    if (!eligible || !mayShow()) return;
    const timer = window.setTimeout(() => setOpen(true), 7000);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  if (!open || !eligible) return null;

  function close() {
    dismissForThreeDays();
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-[113] flex items-end justify-center bg-black/85 px-4 pb-4 sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-week-nudge-title"
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-accent-red/60 bg-[#121011] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button onClick={close} aria-label="Close" className="icon-btn absolute right-3 top-3 text-grit-dim">
          <X size={18} />
        </button>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-red/15 text-accent-red">
          <Dumbbell size={20} />
        </span>
        <p className="label-cap mt-4 text-[10px] text-accent-red">Your first week</p>
        <h2 id="first-week-nudge-title" className="display mt-1 text-3xl font-extrabold uppercase leading-none text-grit">
          Make session one happen
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-grit-dim">
          Your plan is ready. Log one workout and Deadset can start showing PRs, volume and momentum.
        </p>
        <button
          onClick={() => {
            close();
            navigate({ to: "/train" });
          }}
          className="btn-grit mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-xs"
        >
          Start my first workout <Dumbbell size={15} />
        </button>
        <button
          onClick={() => {
            close();
            navigate({ to: "/settings" });
          }}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-xs font-bold text-grit-dim"
        >
          <BellRing size={14} /> Set workout-day reminders
        </button>
      </div>
    </div>
  );
}
