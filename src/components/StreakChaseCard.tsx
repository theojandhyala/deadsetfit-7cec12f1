import { useMemo } from "react";
import { Flame } from "lucide-react";

import { streakChase } from "@/lib/streak-chase";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/**
 * Record chase — the current streak framed against the athlete's own best.
 * Appears only mid-chase: a real record (5+), a real run underway (2+),
 * record not yet beaten.
 */
export function StreakChaseCard({ state }: { state: AppState }) {
  const chase = useMemo(() => streakChase(state.completedDates, isoDay()), [state.completedDates]);

  if (!chase) return null;

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4 mb-3">
      <div className="flex items-baseline justify-between">
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
          <Flame size={12} /> Record chase
        </p>
        <p className="label-cap text-[9px] text-grit-dim">best: {chase.best} days</p>
      </div>

      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="display text-2xl font-extrabold text-grit leading-none">
          {chase.current}
          <span className="text-grit-dim text-base">/{chase.best}</span>
        </p>
        <p className="label-cap text-[9px] text-grit-dim">
          {chase.remaining} more day{chase.remaining === 1 ? "" : "s"} beats your record
        </p>
      </div>

      <div className="h-1.5 rounded-full bg-black/40 mt-2.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent-red"
          style={{ width: `${Math.max(4, chase.pct)}%` }}
        />
      </div>
    </div>
  );
}
