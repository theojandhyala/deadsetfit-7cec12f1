import { useMemo } from "react";
import { Gauge } from "lucide-react";

import { weekPace } from "@/lib/week-pace";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/**
 * Mid-week pace vs the athlete's own historical rhythm — "ahead of your
 * usual Friday" lands while the week can still be changed. Silent on
 * Mon/Tue and until four active weeks of history exist.
 */
export function WeekPaceCard({ state }: { state: AppState }) {
  const pace = useMemo(() => weekPace(state.sessions, isoDay()), [state.sessions]);

  if (!pace) return null;

  const barPct = Math.min(100, Math.round((pace.currentKg / Math.max(pace.usualKg, 1)) * 100));
  const color =
    pace.verdict === "AHEAD" ? "#22c55e" : pace.verdict === "BEHIND" ? "#e63222" : "#f59e0b";

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4 mb-3">
      <div className="flex items-baseline justify-between">
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
          <Gauge size={12} /> Week pace
        </p>
        <p className="label-cap text-[9px]" style={{ color }}>
          {pace.verdict === "AHEAD" ? "ahead" : pace.verdict === "BEHIND" ? "behind" : "on pace"}
        </p>
      </div>

      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="display text-2xl font-extrabold text-grit leading-none">
          {pace.currentKg.toLocaleString()}
        </p>
        <p className="label-cap text-[9px] text-grit-dim">
          kg so far · usually {pace.usualKg.toLocaleString()} by now
        </p>
      </div>

      <div className="h-1.5 rounded-full bg-black/40 mt-2.5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, barPct)}%`, background: color }}
        />
      </div>

      <p className="text-[11px] text-grit-dim leading-relaxed mt-2">{pace.advice}</p>
    </div>
  );
}
