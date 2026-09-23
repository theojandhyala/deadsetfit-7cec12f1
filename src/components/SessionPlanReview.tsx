import { Check, ChevronDown, ChevronUp, Gauge, Minus, Plus, Target, X } from "lucide-react";
import { useMemo, useState } from "react";

import { hapticSelection } from "@/lib/haptics";
import { buildSessionPlanReview, type SessionReviewStatus } from "@/lib/session-review";
import type { WorkoutSession } from "@/lib/types";

export function SessionPlanReview({ session }: { session: WorkoutSession }) {
  const [expanded, setExpanded] = useState(false);
  const review = useMemo(() => buildSessionPlanReview(session), [session]);
  const visibleRows = expanded ? review.rows : review.rows.slice(0, 4);

  return (
    <section
      className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#111214]"
      aria-labelledby="plan-review-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3.5">
        <div>
          <p className="label-cap text-[9px] text-accent-red">Plan vs completed</p>
          <h2
            id="plan-review-title"
            className="display mt-1 text-xl font-black uppercase leading-none text-grit"
          >
            Session receipt
          </h2>
        </div>
        <div className="text-right">
          <p className="display text-2xl font-black leading-none text-grit">
            {review.adherencePercent}%
          </p>
          <p className="mt-1 text-[8px] font-black uppercase tracking-[.12em] text-grit-dim">
            Plan hit
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/8">
        <ReviewMetric
          icon={Target}
          value={`${review.completedSets}/${review.plannedSets}`}
          label="Work sets"
        />
        <ReviewMetric
          icon={Check}
          value={`${review.exercisesHit}/${review.exercisesPlanned}`}
          label="Movements hit"
        />
        <ReviewMetric
          icon={Gauge}
          value={review.averageRpe == null ? "—" : review.averageRpe.toFixed(1)}
          label="Avg RPE"
        />
      </div>

      {session.timeBudgetMinutes && (
        <div className="border-b border-accent-red/20 bg-accent-red/[.06] px-4 py-2.5 text-[10px] leading-relaxed text-grit-dim">
          Time Fit kept {session.exercises.length} of{" "}
          {session.originalExerciseCount ?? session.exercises.length} movements and{" "}
          {review.plannedSets} of {session.originalPlannedSets ?? review.plannedSets} planned sets
          inside today's {session.timeBudgetMinutes}-minute target.
        </div>
      )}

      <ol className="divide-y divide-white/[.065] px-4">
        {visibleRows.map((row) => (
          <li key={row.exerciseId} className="flex min-h-12 items-center gap-2.5 py-2">
            <StatusIcon status={row.status} />
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-grit">{row.name}</span>
            <span className="shrink-0 text-right">
              <span className="block text-[10px] font-black text-grit">
                {row.completedSets}/{row.plannedSets} sets
              </span>
              <span
                className={`mt-0.5 block text-[8px] font-black uppercase tracking-[.12em] ${statusColor(row.status)}`}
              >
                {row.status === "HIT"
                  ? "On plan"
                  : row.status === "ABOVE"
                    ? "Extra work"
                    : row.status === "SHORT"
                      ? "Adjusted"
                      : "Skipped"}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {review.rows.length > 4 && (
        <button
          type="button"
          onClick={() => {
            hapticSelection();
            setExpanded((value) => !value);
          }}
          aria-expanded={expanded}
          className="press flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-white/8 text-[9px] font-black uppercase tracking-[.13em] text-grit-dim"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? "Show less" : `Show ${review.rows.length - 4} more`}
        </button>
      )}
    </section>
  );
}

function ReviewMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Target;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-[#121315] px-2 py-3 text-center">
      <Icon size={13} className="mx-auto text-accent-red" />
      <p className="display mt-1 text-lg font-black leading-none text-grit">{value}</p>
      <p className="mt-1 text-[7px] font-black uppercase tracking-[.11em] text-grit-dim">{label}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: SessionReviewStatus }) {
  const Icon =
    status === "ABOVE" ? Plus : status === "SHORT" ? Minus : status === "SKIPPED" ? X : Check;
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${statusBorder(status)}`}
    >
      <Icon size={13} strokeWidth={2.6} />
    </span>
  );
}

function statusColor(status: SessionReviewStatus) {
  if (status === "HIT" || status === "ABOVE") return "text-emerald-400";
  if (status === "SHORT") return "text-amber-300";
  return "text-grit-dim";
}

function statusBorder(status: SessionReviewStatus) {
  if (status === "HIT" || status === "ABOVE")
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-400";
  if (status === "SHORT") return "border-amber-300/25 bg-amber-300/10 text-amber-300";
  return "border-white/10 bg-white/[.035] text-grit-dim";
}
