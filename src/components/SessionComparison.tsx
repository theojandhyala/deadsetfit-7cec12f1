import { useId, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, TrendingUp } from "lucide-react";
import { compareSessionLifts } from "@/lib/session-comparison";
import { formatSet } from "@/lib/set-tracking";
import { hapticSelection } from "@/lib/haptics";
import type { WorkoutSession } from "@/lib/types";
import type { WeightUnit } from "@/lib/units";

export function SessionComparison({
  session,
  history,
  unit,
}: {
  session: WorkoutSession;
  history: WorkoutSession[];
  unit: WeightUnit;
}) {
  const rows = useMemo(() => compareSessionLifts(session, history), [session, history]);
  const [expanded, setExpanded] = useState(false);
  const title = useId();
  if (!rows.length) return null;
  const improved = rows.filter((row) => row.status === "improved").length;
  return (
    <section
      aria-labelledby={title}
      className="mt-3 min-w-0 overflow-hidden rounded-2xl border border-accent-red/25 bg-[linear-gradient(145deg,#241211,#111214)]"
    >
      <div className="px-4 py-4">
        <p className="label-cap flex items-center gap-2 text-[9px] text-accent-red">
          <TrendingUp size={14} /> Your progress, made visible
        </p>
        <h2 id={title} className="display mt-1 text-2xl font-black uppercase text-grit">
          What changed today
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-grit-dim">
          {improved
            ? `${improved} movement${improved === 1 ? "" : "s"} improved. `
            : "Every logged effort is useful evidence. "}
          Compared with the previous recorded session for each movement.
        </p>
      </div>
      <ol className="divide-y divide-white/8 border-t border-white/8 px-4">
        {(expanded ? rows : rows.slice(0, 3)).map((row) => (
          <li key={row.key} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 break-words text-xs font-bold text-grit">{row.name}</p>
              <span
                className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${row.status === "improved" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-grit-dim"}`}
              >
                {row.status === "improved"
                  ? "Improved"
                  : row.status === "matched"
                    ? "Matched"
                    : row.status === "baseline"
                      ? "Baseline"
                      : "Different effort"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
              <div className="min-w-0 break-words text-grit-dim">
                <p className="mb-1 text-[9px]">{row.previousDate ?? "No earlier record"}</p>
                {row.previous ? formatSet(row.previous, false, unit) : "Your starting point"}
              </div>
              <ArrowRight size={14} className="text-accent-red" aria-hidden="true" />
              <div className="min-w-0 break-words text-right font-bold text-grit">
                <p className="mb-1 text-[9px] font-normal text-grit-dim">Today</p>
                {formatSet(row.set, false, unit)}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {rows.length > 3 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            hapticSelection();
            setExpanded((value) => !value);
          }}
          className="press flex min-h-11 w-full items-center justify-center gap-2 border-t border-white/8 text-xs font-bold text-grit-dim"
        >
          {expanded ? "Show less" : `Show ${rows.length - 3} more`}
          <ChevronDown
            size={14}
            className={`transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
      <p className="border-t border-white/8 px-4 py-3 text-[10px] leading-relaxed text-grit-dim">
        Best working efforts, not estimated muscle growth. Warm-ups and drop sets excluded;
        different loads or rep ranges are not labelled a setback.
      </p>
    </section>
  );
}
