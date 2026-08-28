import { useMemo } from "react";
import { TrendingDown, TrendingUp, Minus, Target } from "lucide-react";
import { isoDay } from "@/lib/calc";
import type { FoodLogItem, Goal } from "@/lib/types";
import { useUnit } from "@/hooks/useUnit";

/**
 * Deterministic 7-day nutrition coaching (no AI). Turns the food log into an
 * adherence score, an energy-balance → projected-weight-change readout, and a
 * goal-aligned verdict + tip.
 */
export function NutritionIntelligence({
  foodLog,
  calorieTarget,
  proteinTarget,
  goal,
}: {
  foodLog: FoodLogItem[];
  calorieTarget: number;
  proteinTarget: number;
  goal?: Goal;
}) {
  const unit = useUnit();
  const r = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => isoDay(new Date(Date.now() - i * 86400000)));
    const perDay = days.map((d) => {
      const items = foodLog.filter((f) => f.date === d);
      return {
        cal: items.reduce((s, f) => s + (f.calories || 0), 0),
        p: items.reduce((s, f) => s + (f.protein || 0), 0),
        logged: items.length > 0,
      };
    });
    const logged = perDay.filter((x) => x.logged);
    if (logged.length === 0) return null;
    const avgCal = Math.round(logged.reduce((s, x) => s + x.cal, 0) / logged.length);
    const avgP = Math.round(logged.reduce((s, x) => s + x.p, 0) / logged.length);
    const calHit = logged.filter(
      (x) => x.cal >= calorieTarget * 0.9 && x.cal <= calorieTarget * 1.1,
    ).length;
    const pHit = logged.filter((x) => x.p >= proteinTarget * 0.9).length;
    const adherence = Math.round(
      ((calHit / logged.length) * 0.5 + (pHit / logged.length) * 0.5) * 100,
    );
    const balance = avgCal - calorieTarget; // +surplus / -deficit per day
    const weeklyKg = Math.round(((balance * 7) / 7700) * 10) / 10;
    return { avgCal, avgP, calHit, pHit, loggedDays: logged.length, adherence, balance, weeklyKg };
  }, [foodLog, calorieTarget, proteinTarget]);

  if (!r) return null;

  // Goal-aligned verdict.
  let verdict: string;
  let aligned = true;
  if (goal === "CUT") {
    if (r.balance > 0) {
      verdict = "You're in a surplus — tighten calories to actually cut.";
      aligned = false;
    } else verdict = `On track — about ${Math.abs(r.weeklyKg)}${unit}/week down at this pace.`;
  } else if (goal === "BULK") {
    if (r.balance < 0) {
      verdict = "You're in a deficit — add calories to grow.";
      aligned = false;
    } else verdict = `Fueling growth — about ${Math.abs(r.weeklyKg)}${unit}/week up at this pace.`;
  } else {
    if (Math.abs(r.balance) > 250) {
      verdict = `Drifting ${r.balance > 0 ? "over" : "under"} maintenance — nudge back to hold weight.`;
      aligned = false;
    } else verdict = "Holding maintenance well.";
  }

  const proteinShort = proteinTarget - r.avgP;
  const tip =
    proteinShort > 15
      ? `Protein runs ~${Math.round(proteinShort)}g short — add a shake or lean meat.`
      : r.loggedDays < 5
        ? "Log a few more days for a sharper read."
        : "Dialled in — keep it consistent.";

  const BalIcon = r.balance < -50 ? TrendingDown : r.balance > 50 ? TrendingUp : Minus;
  const balColor =
    goal === "CUT"
      ? r.balance <= 0
        ? "#22c55e"
        : "#e63222"
      : goal === "BULK"
        ? r.balance >= 0
          ? "#22c55e"
          : "#e63222"
        : Math.abs(r.balance) <= 250
          ? "#22c55e"
          : "#f59e0b";

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div>
          <p className="label-cap text-[9px] text-grit-dim">Adherence</p>
          <p
            className="display text-3xl font-extrabold tabular-nums"
            style={{
              color: r.adherence >= 75 ? "#22c55e" : r.adherence >= 50 ? "#f59e0b" : "#e63222",
            }}
          >
            {r.adherence}
            <span className="text-sm text-grit-dim">%</span>
          </p>
        </div>
        <div className="flex-1 border-l border-grit pl-4">
          <p className="label-cap text-[9px] text-grit-dim">Energy balance</p>
          <p
            className="display text-xl font-extrabold flex items-center gap-1"
            style={{ color: balColor }}
          >
            <BalIcon size={16} />
            {r.balance > 0 ? "+" : ""}
            {r.balance}
            <span className="text-[10px] text-grit-dim">kcal/day</span>
          </p>
          <p className="text-[10px] text-grit-dim mt-0.5">
            ≈ {r.weeklyKg > 0 ? "+" : ""}
            {r.weeklyKg}
            {unit}/week
          </p>
        </div>
      </div>
      <div
        className="flex items-start gap-2 rounded-xl border p-3"
        style={{
          borderColor: aligned ? "#1c3a24" : "#3a1a10",
          background: aligned ? "#0e1a12" : "#180d0a",
        }}
      >
        <Target
          size={14}
          className="mt-0.5 shrink-0"
          style={{ color: aligned ? "#22c55e" : "#f59e0b" }}
        />
        <div>
          <p className="text-xs text-grit leading-snug">{verdict}</p>
          <p className="text-[11px] text-grit-dim mt-1">{tip}</p>
        </div>
      </div>
    </div>
  );
}
