import { useMemo } from "react";
import { History } from "lucide-react";

import { throwback } from "@/lib/throwback";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";
import { useUnit } from "@/hooks/useUnit";
import { formatWeight } from "@/lib/units";

const AGO_LABEL: Record<number, string> = {
  365: "One year ago",
  180: "Six months ago",
  90: "Three months ago",
};

/**
 * The receipts of progress — the same lift then vs now, in estimated 1RM.
 * Only renders when there's a genuine gain to show; regression gets
 * silence, not an anniversary card.
 */
export function ThrowbackCard({ state }: { state: AppState }) {
  const unit = useUnit();
  const tb = useMemo(() => throwback(state.sessions, isoDay()), [state.sessions]);

  if (!tb) return null;

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-accent-red/50 rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-accent-red/15 blur-2xl" />
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
          <History size={12} /> {AGO_LABEL[tb.daysAgo] ?? `${tb.daysAgo} days ago`}
        </p>

        <p className="text-xs text-grit-dim leading-relaxed mt-2">
          {AGO_LABEL[tb.daysAgo] ?? "Back then"}, your best {tb.exercise} set was{" "}
          <span className="text-grit">
            {formatWeight(tb.thenWeight, unit)} × {tb.thenReps}
          </span>{" "}
          — an estimated 1RM of {formatWeight(tb.thenE1rm, unit)}.
        </p>

        <div className="flex items-baseline gap-2 mt-2">
          <p className="display text-3xl font-extrabold text-grit leading-none">
            +{formatWeight(tb.gainKg, unit)}
          </p>
          <p className="label-cap text-[9px] text-grit-dim">
            e1RM today: {formatWeight(tb.nowE1rm, unit)}
          </p>
        </div>

        <p className="text-[11px] text-grit-dim leading-relaxed mt-2">
          Same lift, same you — just {formatWeight(tb.gainKg, unit)} stronger. Keep the receipts
          coming.
        </p>
      </div>
    </section>
  );
}
