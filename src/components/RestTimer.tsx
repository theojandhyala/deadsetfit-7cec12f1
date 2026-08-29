import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
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
  const playedCountdownTicks = useRef(new Set<number>());

  const endRest = useCallback(
    (completedNaturally: boolean) => {
      if (finished.current) return;
      finished.current = true;
      void cancelRestAlert();
      if (completedNaturally) restDoneChime();
      onDone();
    },
    [onDone],
  );

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
      setState(next);
      if (
        (next.remaining === 3 || next.remaining === 2 || next.remaining === 1) &&
        !playedCountdownTicks.current.has(next.remaining)
      ) {
        playedCountdownTicks.current.add(next.remaining);
        hapticRestTick();
      }
      if (next.done) endRest(true);
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
  }, [endsAt, state.total, endRest]);

  // Skipping or unmounting must not leave a notification to fire later.
  useEffect(() => () => void cancelRestAlert(), []);

  const left = state.remaining;
  const total = state.total;
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  // The last three seconds already buzz. They should also be visible: in a gym
  // the phone is on a bench, not in your hand, and "get under the bar" is
  // worth seeing from a metre away.
  const urgent = left <= 3 && left > 0;
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-md px-4 animate-slide-up">
      <div className="deadset-3d-panel bg-grit-card border border-accent-red p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="label-cap text-accent-red text-[10px]">REST</div>
            <div
              key={urgent ? left : "steady"}
              className={`display text-4xl font-extrabold leading-none${urgent ? " rest-urgent" : " text-grit"}`}
              style={urgent ? { color: "#e63222" } : undefined}
            >
              {left}s
            </div>
            {nextExercise && (
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
              className="btn-ghost px-3 py-2 text-xs"
            >
              <Plus size={14} className="mr-1" />
              15s
            </button>
            <button
              onClick={() => {
                hapticSelection();
                endRest(false);
              }}
              className="btn-grit px-3 py-2 text-xs"
            >
              <X size={14} className="mr-1" />
              Skip
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-[#080808] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear${urgent ? " rest-bar-urgent" : ""} bg-accent-red`}
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
