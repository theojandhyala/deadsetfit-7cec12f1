import { useMemo } from "react";
import { Repeat } from "lucide-react";

import { calorieCycle } from "@/lib/calorie-cycling";
import { normaliseTrainingDays, isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/**
 * Calorie cycling — the flat daily target redistributed so training days get
 * more fuel and rest days less, holding the weekly average exactly where the
 * goal already put it. Hidden until a calorie goal exists.
 */
export function CalorieCyclingCard({ state, baseCalories }: { state: AppState; baseCalories: number }) {
  const cycle = useMemo(() => {
    const p = state.profile;
    if (!p) return null;
    const days = normaliseTrainingDays(p.trainingDays, p.daysPerWeek);
    return calorieCycle(baseCalories, days, isoDay());
  }, [state.profile, baseCalories]);

  if (!cycle) return null;

  const training = cycle.kind === "TRAINING";

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4 mt-3">
      <div className="flex items-baseline justify-between">
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
          <Repeat size={12} /> Calorie cycling
        </p>
        <p className="label-cap text-[9px] text-grit-dim">
          {training ? "training day" : "rest day"}
        </p>
      </div>

      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="display text-3xl font-extrabold text-grit leading-none">
          {cycle.todayTarget.toLocaleString()}
        </p>
        <p className="label-cap text-[9px] text-grit-dim">
          kcal today ({cycle.delta > 0 ? "+" : ""}
          {cycle.delta})
        </p>
      </div>

      <div className="flex gap-2 mt-3">
        <div
          className={`flex-1 rounded-xl px-3 py-2 ${training ? "border border-accent-red/50 bg-accent-red/10" : "bg-black/30"}`}
        >
          <p className="label-cap text-[8px] text-grit-dim">Training days</p>
          <p className="display text-base font-extrabold text-grit leading-none mt-1">
            {cycle.trainingTarget.toLocaleString()}
          </p>
        </div>
        <div
          className={`flex-1 rounded-xl px-3 py-2 ${!training ? "border border-accent-red/50 bg-accent-red/10" : "bg-black/30"}`}
        >
          <p className="label-cap text-[8px] text-grit-dim">Rest days</p>
          <p className="display text-base font-extrabold text-grit leading-none mt-1">
            {cycle.restTarget.toLocaleString()}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-grit-dim leading-relaxed mt-3">
        Same weekly average as your flat target — the fuel just lands on the days that use it.
      </p>
    </div>
  );
}
