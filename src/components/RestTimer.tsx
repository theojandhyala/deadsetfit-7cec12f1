import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { restDoneChime } from "@/lib/feedback";
import { hapticRestTick, hapticSelection } from "@/lib/haptics";
import {
  cancelRestAlert,
  extendDeadline,
  restTimerState,
  scheduleRestAlert,
  startRestActivity,
} from "@/lib/rest-timer";

export function RestTimer({
  seconds,
  initialEndsAt,
  nextExercise,
  onDone,
  onDisable,
}: {
  seconds: number;
  initialEndsAt?: number;
  /** Named in the notification so the alert is useful from the lock screen. */
  nextExercise?: string;
  onDone: () => void;
  onDisable?: () => void;
}) {
  // A deadline, not a counter. iOS suspends JS timers when the app leaves the
  // foreground, so anything that counts ticks freezes while the phone is in a
  // pocket — which is where it spends most of a rest period.
  const [endsAt, setEndsAt] = useState(() => initialEndsAt ?? Date.now() + seconds * 1000);
  const [state, setState] = useState(() => restTimerState(endsAt, seconds));
  const [compact, setCompact] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const finished = useRef(false);
  const playedCountdownTicks = useRef(new Set<number>());

  const endRest = useCallback((completedNaturally: boolean) => {
    if (finished.current) return;
    finished.current = true;
    void cancelRestAlert();
    if (completedNaturally) restDoneChime();
    onDoneRef.current();
  }, []);

  // What makes rest survive leaving the app. The notification is delivered by
  // iOS at the deadline even if the app is suspended or killed; the Live Activity
  // puts the countdown on the Dynamic Island and Lock Screen, counted down by the
  // system rather than by us.
  useEffect(() => {
    void scheduleRestAlert(endsAt, nextExercise);
    void startRestActivity(endsAt, state.total, nextExercise);
    // state.total is intentionally not a dependency: it only grows alongside
    // endsAt, and re-running would restart the island animation mid-rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, nextExercise]);

  useEffect(() => {
    const tick = () => {
      if (finished.current) return;
      const next = restTimerState(endsAt, state.total);
      // Check the deadline frequently, but render only when the visible second changes.
      setState((previous) =>
        previous.remaining === next.remaining && previous.total === next.total ? previous : next,
      );
      if (
        (next.remaining === 3 || next.remaining === 2 || next.remaining === 1) &&
        !playedCountdownTicks.current.has(next.remaining)
      ) {
        playedCountdownTicks.current.add(next.remaining);
        hapticRestTick();
      }
      if (next.done) endRest(true);
    };
    tick();
    const interval = window.setInterval(() => {
      if (!document.hidden) tick();
    }, 250);
    // Recompute the instant we regain focus rather than waiting for a tick, so
    // returning to the app never shows a stale number.
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [endsAt, state.total, endRest]);

  // Skipping or unmounting must not leave a notification to fire later.
  useEffect(() => () => void cancelRestAlert(), []);

  const left = state.remaining;
  const total = state.total;
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  return (
    <div
      className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-md px-4 animate-slide-up"
      role="region"
      aria-label="Rest timer"
    >
      <div
        className={`deadset-3d-panel bg-grit-card border border-accent-red ${compact ? "p-3" : "p-4"}`}
      >
        <div className={`flex items-center justify-between gap-2 ${compact ? "" : "mb-3"}`}>
          <div className="min-w-0">
            <div className="label-cap text-accent-red text-[10px]">REST</div>
            <div
              className={`display ${compact ? "text-2xl" : "text-4xl"} font-extrabold tabular-nums text-grit leading-none`}
              role="timer"
              aria-label={`${left} seconds remaining`}
            >
              {left}s
            </div>
            {nextExercise && !compact && (
              <div className="mt-1 max-w-40 truncate text-[10px] font-bold uppercase text-grit-dim">
                Next · {nextExercise}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                hapticSelection();
                playedCountdownTicks.current.clear();
                setEndsAt((current) => extendDeadline(current, 15));
              }}
              aria-label="Add 15 seconds rest"
              className="btn-ghost min-h-11 px-2 py-2 text-xs"
            >
              <Plus size={14} className="mr-1" />
              15s
            </button>
            <button
              onClick={() => {
                hapticSelection();
                endRest(false);
              }}
              className="btn-grit min-h-11 px-2 py-2 text-xs"
            >
              <X size={14} className="mr-1" />
              Skip
            </button>
            <button
              type="button"
              onClick={() => {
                hapticSelection();
                setCompact((v) => !v);
              }}
              aria-label={compact ? "Expand rest timer" : "Minimize rest timer"}
              aria-expanded={!compact}
              className="press grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 text-grit-dim"
            >
              {compact ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
        <div
          className={`${compact ? "mt-2" : ""} h-1.5 bg-[#080808] rounded-full overflow-hidden`}
          role="progressbar"
          aria-label="Rest remaining"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={left}
        >
          <div
            className="h-full origin-left bg-accent-red rounded-full transition-transform duration-1000 ease-linear motion-reduce:transition-none"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
        {onDisable && !compact && (
          <button
            onClick={onDisable}
            className="mt-2.5 w-full text-center label-cap text-[9px] text-grit-dim press"
          >
            Turn off auto-rest
          </button>
        )}
      </div>
    </div>
  );
}
