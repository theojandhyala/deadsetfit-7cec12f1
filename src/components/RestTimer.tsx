import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { restDoneChime } from "@/lib/feedback";
import {
  cancelRestAlert,
  extendDeadline,
  restTimerState,
  scheduleRestAlert,
  startRestActivity,
} from "@/lib/rest-timer";

export function RestTimer({
  seconds,
  nextExercise,
  onDone,
  onDisable,
}: {
  seconds: number;
  /** Named in the notification so the alert is useful from the lock screen. */
  nextExercise?: string;
  onDone: () => void;
  onDisable?: () => void;
}) {
  // A deadline, not a counter. iOS suspends JS timers when the app leaves the
  // foreground, so anything that counts ticks freezes while the phone is in a
  // pocket — which is where it spends most of a rest period.
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [state, setState] = useState(() => restTimerState(endsAt, seconds));
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    void cancelRestAlert();
    restDoneChime();
    onDone();
  }, [onDone]);

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
      const next = restTimerState(endsAt, state.total);
      setState(next);
      if (next.done) finish();
    };
    const interval = window.setInterval(tick, 250);
    // Recompute the instant we regain focus rather than waiting for a tick, so
    // returning to the app never shows a stale number.
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [endsAt, state.total, finish]);

  // Skipping or unmounting must not leave a notification to fire later.
  useEffect(() => () => void cancelRestAlert(), []);

  const left = state.remaining;
  const total = state.total;
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-md px-4 animate-slide-up">
      <div className="deadset-3d-panel bg-grit-card border border-accent-red p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="label-cap text-accent-red text-[10px]">REST</div>
            <div className="display text-4xl font-extrabold text-grit leading-none">{left}s</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEndsAt((current) => extendDeadline(current, 15))}
              className="btn-ghost px-3 py-2 text-xs"
            >
              <Plus size={14} className="mr-1" />
              15s
            </button>
            <button onClick={finish} className="btn-grit px-3 py-2 text-xs">
              <X size={14} className="mr-1" />
              Skip
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-[#080808] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-red rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        {onDisable && (
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
