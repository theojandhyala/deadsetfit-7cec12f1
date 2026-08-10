import { useMemo } from "react";
import { Flame } from "lucide-react";

import { adaptiveTdee } from "@/lib/adaptive-tdee";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/**
 * The measured alternative to the Mifflin-St Jeor guess: maintenance calories
 * computed from what was actually logged and how bodyweight actually moved.
 * Renders nothing until there is enough data to be honest — a card that
 * guesses would be worse than no card.
 */
export function AdaptiveTdeeCard({ state, formulaTarget }: { state: AppState; formulaTarget: number }) {
  const result = useMemo(
    () => adaptiveTdee(state.foodLog, state.weights, isoDay()),
    [state.foodLog, state.weights],
  );

  if (!result) return null;

  const trend = result.trendKgPerWeek;
  const trendLabel =
    Math.abs(trend) < 0.05
      ? "holding steady"
      : `${trend > 0 ? "gaining" : "losing"} ${Math.abs(trend).toFixed(2)} kg/week`;
  const delta = result.tdee - formulaTarget;

  return (
    <div className="bg-grit-card border border-accent-red/50 rounded-2xl p-4 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent-red/15 blur-2xl" />
      <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
        <Flame size={12} /> Adaptive TDEE
      </p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="display text-3xl font-extrabold text-grit leading-none">
          {result.tdee.toLocaleString()}
        </p>
        <p className="label-cap text-[9px] text-grit-dim">kcal measured burn</p>
      </div>
      <p className="text-xs text-grit-dim leading-relaxed mt-2">
        From {result.foodDays} logged days averaging {result.avgIntake.toLocaleString()} kcal while{" "}
        {trendLabel} — this is your real maintenance, not a formula's guess
        {Math.abs(delta) >= 100
          ? ` (${Math.abs(delta)} kcal ${delta > 0 ? "above" : "below"} the estimate)`
          : ""}
        .
      </p>
    </div>
  );
}
