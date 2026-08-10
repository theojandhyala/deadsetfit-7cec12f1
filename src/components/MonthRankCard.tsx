import { useMemo } from "react";
import { CalendarRange } from "lucide-react";

import { monthRank } from "@/lib/month-rank";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

const ORDINAL = ["", "biggest", "2nd-biggest", "3rd-biggest"];

/**
 * Session records at calendar scale: where the last completed month ranks
 * among every month ever trained. Needs three completed months of history.
 */
export function MonthRankCard({ state }: { state: AppState }) {
  const rank = useMemo(() => monthRank(state.sessions, isoDay()), [state.sessions]);

  if (!rank) return null;

  const standing =
    rank.rank <= 3 ? ORDINAL[rank.rank] : `#${rank.rank} of ${rank.totalMonths}`;

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <div className="flex items-baseline justify-between">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
            <CalendarRange size={12} /> {rank.label}
          </p>
          <p className="label-cap text-[9px] text-grit-dim">
            {rank.totalMonths} months tracked
          </p>
        </div>

        <div className="flex items-baseline gap-2 mt-1.5">
          <p className="display text-2xl font-extrabold text-grit leading-none">
            {rank.volumeKg.toLocaleString()} kg
          </p>
          <p className="label-cap text-[9px]" style={{ color: rank.rank === 1 ? "#22c55e" : undefined }}>
            {rank.rank <= 3 ? `your ${standing} month ever` : standing}
          </p>
        </div>

        <p className="text-[11px] text-grit-dim leading-relaxed mt-2">
          {rank.rank === 1
            ? "A new record month. The bar is wherever you just put it."
            : `Record to beat: ${rank.bestMonth.label} at ${rank.bestMonth.volumeKg.toLocaleString()} kg.`}
        </p>
      </div>
    </section>
  );
}
