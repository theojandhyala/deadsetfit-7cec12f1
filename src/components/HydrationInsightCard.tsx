import { useMemo } from "react";
import { Droplets } from "lucide-react";

import { hydrationInsight } from "@/lib/hydration-insight";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/**
 * The water log's brain: hit rate vs target over two weeks and the weekday
 * that always runs dry. Needs five tracked days before it says anything.
 */
export function HydrationInsightCard({ state }: { state: AppState }) {
  const insight = useMemo(
    () => hydrationInsight(state.water, state.waterTargetMl, isoDay()),
    [state.water, state.waterTargetMl],
  );

  if (!insight) return null;

  const pct = Math.round(insight.hitRate * 100);

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4 mt-3">
      <div className="flex items-baseline justify-between">
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5 whitespace-nowrap">
          <Droplets size={12} /> Hydration
        </p>
        <p className="label-cap text-[9px] text-grit-dim whitespace-nowrap">
          {insight.daysTracked} days tracked
        </p>
      </div>

      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="display text-2xl font-extrabold text-grit leading-none">{pct}%</p>
        <p className="label-cap text-[9px] text-grit-dim">
          days on target · avg {insight.avgMl.toLocaleString()} ml
        </p>
      </div>

      <div className="h-1.5 rounded-full bg-black/40 mt-2.5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(2, pct)}%`,
            background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#e63222",
          }}
        />
      </div>

      <p className="text-[11px] text-grit-dim leading-relaxed mt-2">{insight.advice}</p>
    </div>
  );
}
