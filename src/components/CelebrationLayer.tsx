import { useEffect, useRef, useState } from "react";
import { Flame, Sparkles } from "lucide-react";
import { onGritEarned, type GritAnimationEvent } from "@/lib/grit-events";

/**
 * Full-screen takeover for the moments that deserve more than a toast:
 * PR detections and rank-ups. Complements GritEarnedLayer (small bursts).
 * Auto-dismisses; tap skips.
 */
export function CelebrationLayer() {
  const [event, setEvent] = useState<GritAnimationEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      onGritEarned((e) => {
        if (e.kind !== "pr" && e.kind !== "rank") return;
        setEvent(e);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setEvent(null), 1900);
      }),
    [],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!event) return null;
  const isRank = event.kind === "rank";
  const Icon = isRank ? Sparkles : Flame;

  return (
    <button
      type="button"
      aria-label="Dismiss celebration"
      onClick={() => setEvent(null)}
      className="fixed inset-0 z-[105] flex items-center justify-center cursor-default"
      // No backdrop-filter: composites as solid black while scrolling in WKWebView/iOS Safari.
      style={{ background: "rgba(5,5,5,0.92)" }}
    >
      <span
        className="celebrate-flash pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 45%, rgba(230,50,34,0.35), transparent 60%)" }}
        aria-hidden="true"
      />
      <span
        className="celebrate-wave pointer-events-none absolute h-40 w-40 rounded-full border-2 border-accent-red/60"
        aria-hidden="true"
      />
      <span
        className="celebrate-wave-late pointer-events-none absolute h-40 w-40 rounded-full border border-accent-red/40"
        aria-hidden="true"
      />
      <span className="celebrate-overlay relative flex flex-col items-center text-center px-8">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-red text-white shadow-[0_0_60px_rgba(230,50,34,0.8)]">
          <Icon size={40} strokeWidth={2.5} />
        </span>
        <span className="label-cap mt-5 text-[11px] text-accent-red">
          {isRank ? "RANK UP" : "NEW PERSONAL RECORD"}
        </span>
        <span className="display mt-1 text-4xl font-black uppercase leading-tight text-grit">
          {event.label && event.label !== "GRIT EARNED" ? event.label.replace(/^NEW PR — /, "") : isRank ? "You promoted" : "PR locked"}
        </span>
        {!isRank && (
          <span className="display mt-2 text-xl font-black text-accent-red">
            +{event.amount} GRIT
          </span>
        )}
      </span>
    </button>
  );
}
