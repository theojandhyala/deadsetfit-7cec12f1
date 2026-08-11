import { useMemo } from "react";
import { Medal } from "lucide-react";

import { sessionRecords } from "@/lib/session-records";
import type { AppState } from "@/lib/types";

/**
 * Whole-workout records — lift PRs celebrate one set, these celebrate the
 * biggest day you've ever put in. Shows a "record broken" banner when the
 * most recent session set one.
 */
export function SessionRecordsCard({ state }: { state: AppState }) {
  const records = useMemo(() => sessionRecords(state.sessions), [state.sessions]);

  if (!records) return null;
  const { heaviest, mostReps, longest, latestBroke } = records;
  if (!heaviest && !mostReps && !longest) return null;

  const brokeLabel =
    latestBroke.length > 0
      ? latestBroke
          .map((b) =>
            b === "VOLUME" ? "biggest tonnage" : b === "REPS" ? "most reps" : "longest session",
          )
          .join(" + ")
      : null;

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <div className="flex items-baseline justify-between">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
            <Medal size={12} /> Session records
          </p>
          <p className="label-cap text-[9px] text-grit-dim">all time</p>
        </div>

        {brokeLabel && (
          <div className="mt-2 rounded-xl border border-accent-red/50 bg-accent-red/10 px-3 py-2">
            <p className="text-[11px] text-grit">
              Your last session set a record: <span className="text-accent-red">{brokeLabel}</span>.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3">
          {heaviest && (
            <div className="bg-black/30 rounded-xl px-2 py-2 text-center">
              <p className="display text-lg font-extrabold text-grit leading-none">
                {heaviest.volumeKg.toLocaleString()}
              </p>
              <p className="label-cap text-[8px] text-grit-dim mt-1">kg · biggest day</p>
            </div>
          )}
          {mostReps && (
            <div className="bg-black/30 rounded-xl px-2 py-2 text-center">
              <p className="display text-lg font-extrabold text-grit leading-none">
                {mostReps.reps.toLocaleString()}
              </p>
              <p className="label-cap text-[8px] text-grit-dim mt-1">most reps</p>
            </div>
          )}
          {longest && (
            <div className="bg-black/30 rounded-xl px-2 py-2 text-center">
              <p className="display text-lg font-extrabold text-grit leading-none">
                {longest.minutes}
              </p>
              <p className="label-cap text-[8px] text-grit-dim mt-1">min · longest</p>
            </div>
          )}
        </div>

        {heaviest && (
          <p className="text-[11px] text-grit-dim leading-relaxed mt-3">
            Biggest day: {heaviest.label} on {heaviest.date}. Beat it and the banner comes back.
          </p>
        )}
      </div>
    </section>
  );
}
