import { useMemo } from "react";
import { Beef } from "lucide-react";

import { proteinSpread } from "@/lib/protein-spread";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/**
 * Per-meal protein distribution — a perfect daily total that all lands at
 * dinner still leaves two dead feedings. Scores meals against a ~0.4 g/kg
 * dose and points at the slot that misses most.
 */
export function ProteinSpreadCard({ state }: { state: AppState }) {
  const spread = useMemo(() => {
    const latestWeight =
      [...(state.weights ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.weight ??
      state.profile?.weightKg ??
      0;
    return proteinSpread(state.foodLog, latestWeight, isoDay());
  }, [state.foodLog, state.weights, state.profile?.weightKg]);

  if (!spread) return null;

  const filled = Math.round(spread.avgQualityMeals);

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4 mt-3">
      <div className="flex items-baseline justify-between">
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
          <Beef size={12} /> Protein spread
        </p>
        <p className="label-cap text-[9px] text-grit-dim">
          {spread.thresholdG} g+ per meal · {spread.daysAnalyzed} days
        </p>
      </div>

      <div className="flex items-center gap-2 mt-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: spread.targetMeals }, (_, i) => (
            <span
              key={i}
              className="h-3.5 w-7 rounded-full"
              style={{
                background: i < filled ? "#e63222" : "rgba(255,255,255,0.08)",
              }}
            />
          ))}
        </div>
        <p className="display text-xl font-extrabold text-grit leading-none">
          {spread.avgQualityMeals}
          <span className="text-grit-dim text-sm">/{spread.targetMeals}</span>
        </p>
      </div>

      <p className="text-[11px] text-grit-dim leading-relaxed mt-2.5">{spread.advice}</p>
    </div>
  );
}
