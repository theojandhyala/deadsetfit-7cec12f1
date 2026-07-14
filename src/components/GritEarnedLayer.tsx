import { useEffect, useRef, useState } from "react";
import { Flame, Sparkles, Trophy, Zap } from "lucide-react";

import { onGritEarned, type GritAnimationEvent } from "@/lib/grit-events";

const ICONS = {
  grit: Zap,
  pr: Trophy,
  rank: Sparkles,
  streak: Flame,
  quest: Zap,
};

export function GritEarnedLayer() {
  const [events, setEvents] = useState<GritAnimationEvent[]>([]);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const off = onGritEarned((event) => {
      // PR and rank moments get the full-screen CelebrationLayer — showing
      // the small burst underneath it would double-fire the same event.
      if (event.kind === "pr" || event.kind === "rank") return;
      setEvents((current) => [...current.slice(-2), event]);
      const timer = setTimeout(() => {
        setEvents((current) => current.filter((item) => item.id !== event.id));
      }, 2200);
      timers.current.push(timer);
    });
    return () => {
      off();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+70px)] z-[95] flex flex-col items-center gap-2 px-5">
      {events.map((event) => (
        <GritBurst key={event.id} event={event} />
      ))}
    </div>
  );
}

function GritBurst({ event }: { event: GritAnimationEvent }) {
  const Icon = ICONS[event.kind] ?? Zap;
  const accent = event.kind === "pr" || event.kind === "rank";
  return (
    <div className="grit-earned-burst relative overflow-hidden rounded-full border border-accent-red/70 bg-[#111217] px-4 py-3 shadow-2xl">
      <div className="absolute inset-0 grit-earned-sheen" />
      <div className="absolute -left-8 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-accent-red/25 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-red text-white shadow-[0_0_24px_rgba(230,50,34,.45)]">
          <Icon size={18} strokeWidth={3} />
        </span>
        <span className="min-w-0">
          <span className="block label-cap text-[9px] text-grit-dim">{event.label}</span>
          <span className="display block text-2xl font-black leading-none text-grit">
            +{event.amount}
            <span className="ml-1 text-xs tracking-[0.18em] text-accent-red">
              {accent ? "PR GRIT" : event.kind === "streak" ? "DAY STREAK" : "GRIT"}
            </span>
          </span>
        </span>
      </div>
      <span className="grit-particle grit-particle-a" />
      <span className="grit-particle grit-particle-b" />
      <span className="grit-particle grit-particle-c" />
    </div>
  );
}
