import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";

import { useAppState } from "@/lib/storage";

const DISMISSED_UNTIL_KEY = "deadset_feedback_pulse_until";
const NUDGE_GAP_MS = 21 * 86_400_000;

function mayShow() {
  try {
    return Number(localStorage.getItem(DISMISSED_UNTIL_KEY) || "0") <= Date.now();
  } catch {
    return true;
  }
}

function dismissForThreeWeeks() {
  try {
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + NUDGE_GAP_MS));
  } catch {
    /* Optional feedback must never block training. */
  }
}

/** A low-frequency question for engaged users, routed to the existing support inbox. */
export function FeedbackPulse() {
  const [state] = useAppState();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const completed = state.sessions.filter((session) => !!session.endedAt).length;
  const eligible = pathname === "/train" && !state.activeSessionId && completed >= 2;

  useEffect(() => {
    if (!eligible || !mayShow()) {
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  if (!open || !eligible) return null;

  function close() {
    dismissForThreeWeeks();
    setOpen(false);
  }

  function send() {
    const body = encodeURIComponent(
      `What nearly stopped you from starting?\n\n${answer.trim() || "(No answer entered)"}\n\nSessions completed: ${completed}`,
    );
    close();
    window.location.href = `mailto:support@deadsetfit.org?subject=${encodeURIComponent("DEADSET member feedback")}&body=${body}`;
  }

  return (
    <div
      className="fixed inset-0 z-[113] flex items-end justify-center bg-black/85 px-4 pb-4 sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-pulse-title"
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#121011] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="icon-btn absolute right-3 top-3 text-grit-dim"
        >
          <X size={18} />
        </button>
        <MessageCircle size={21} className="text-accent-red" />
        <p className="label-cap mt-3 text-[10px] text-accent-red">Quick question</p>
        <h2
          id="feedback-pulse-title"
          className="display mt-1 text-2xl font-extrabold uppercase leading-none text-grit"
        >
          What nearly stopped you starting?
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-grit-dim">
          A sentence is plenty. It helps us make the first week better for the next lifter.
        </p>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value.slice(0, 500))}
          maxLength={500}
          placeholder="Your honest answer…"
          className="mt-4 min-h-24 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-grit outline-none placeholder:text-grit-dim focus:border-accent-red/70"
        />
        <button onClick={send} className="btn-grit mt-3 min-h-12 w-full rounded-xl text-xs">
          Send feedback
        </button>
        <button onClick={close} className="mt-2 min-h-10 w-full text-xs text-grit-dim">
          Not now
        </button>
      </div>
    </div>
  );
}
