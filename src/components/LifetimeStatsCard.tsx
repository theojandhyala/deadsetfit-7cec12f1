import { useMemo, useState } from "react";
import { Trophy, Share2 } from "lucide-react";

import { lifetimeStats, avgWeeklyVolume } from "@/lib/lifetime-stats";
import { nextTonnageMilestone } from "@/lib/tonnage-milestones";
import { isoDay } from "@/lib/calc";
import { StoryShareCard } from "@/components/StoryShareCard";
import type { AppState } from "@/lib/types";

/**
 * The athlete's whole story in one card — Wrapped-style lifetime totals with
 * the tonnage translated into something you can picture. Renders nothing
 * until at least one session has been finished.
 */
export function LifetimeStatsCard({ state }: { state: AppState }) {
  const stats = useMemo(
    () => lifetimeStats(state.sessions, state.completedDates),
    [state.sessions, state.completedDates],
  );
  const [sharing, setSharing] = useState(false);

  if (!stats) return null;

  const sinceYear = stats.firstSessionDate ? stats.firstSessionDate.slice(0, 4) : null;

  return (
    <section className="px-5 mb-6">
    <div className="bg-grit-card border border-grit rounded-2xl p-4 relative overflow-hidden">
      <div className="absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-accent-red/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
          <Trophy size={12} /> Your story{sinceYear ? ` · since ${sinceYear}` : ""}
        </p>
        <button
          type="button"
          onClick={() => setSharing(true)}
          className="icon-btn -mr-2 -mt-1 text-grit-dim"
          aria-label="Share your story card"
        >
          <Share2 size={14} />
        </button>
      </div>
      {sharing && (
        <StoryShareCard
          stats={stats}
          displayName={state.profile?.displayName || state.profile?.username || "DEADSET ATHLETE"}
          username={state.profile?.username}
          onClose={() => setSharing(false)}
        />
      )}

      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="display text-3xl font-extrabold text-grit leading-none">
          {stats.totalVolumeKg.toLocaleString()}
        </p>
        <p className="label-cap text-[9px] text-grit-dim">kg lifted, lifetime</p>
      </div>
      {stats.equivalent && (
        <p className="text-xs text-grit-dim mt-1">
          That&apos;s {stats.equivalent.count.toLocaleString()} {stats.equivalent.label} off the
          floor.
        </p>
      )}

      {(() => {
        const next = nextTonnageMilestone(stats.totalVolumeKg);
        if (!next) return null;
        // ETA at the current pace — only when the horizon is believable.
        const weekly = avgWeeklyVolume(state.sessions, isoDay());
        const etaWeeks = weekly
          ? Math.ceil((next.milestone.kg - stats.totalVolumeKg) / weekly)
          : null;
        const eta = etaWeeks && etaWeeks >= 1 && etaWeeks <= 52 ? etaWeeks : null;
        return (
          <div className="mt-2.5">
            <div className="flex items-baseline justify-between">
              <p className="label-cap text-[8px] text-grit-dim whitespace-nowrap overflow-hidden text-ellipsis pr-2">
                Next: {next.milestone.label} {next.milestone.emoji}
                {eta ? ` · ~${eta} wk${eta === 1 ? "" : "s"}` : ""}
              </p>
              <p className="label-cap text-[8px] text-accent-red shrink-0">{next.pct}%</p>
            </div>
            <div className="h-1.5 rounded-full bg-black/40 mt-1 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-red"
                style={{ width: `${Math.max(2, next.pct)}%` }}
              />
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-4 gap-2 mt-3">
        {[
          { v: stats.sessions, l: "sessions" },
          { v: stats.totalReps, l: "reps" },
          { v: stats.hoursTrained, l: "hours" },
          { v: stats.longestStreakDays, l: "best streak" },
        ].map((s) => (
          <div key={s.l} className="bg-black/30 rounded-xl px-2 py-2 text-center">
            <p className="display text-lg font-extrabold text-grit leading-none">
              {s.v.toLocaleString()}
            </p>
            <p className="label-cap text-[8px] text-grit-dim mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      {(stats.heaviestSet || stats.topExercise) && (
        <p className="text-[11px] text-grit-dim leading-relaxed mt-3">
          {stats.heaviestSet && (
            <>
              Heaviest set: <span className="text-grit">{stats.heaviestSet.weight} kg</span> ×{" "}
              {stats.heaviestSet.reps} {stats.heaviestSet.name}.
            </>
          )}
          {stats.topExercise && (
            <>
              {" "}
              Most trained: <span className="text-grit">{stats.topExercise.name}</span> (
              {stats.topExercise.sets.toLocaleString()} sets).
            </>
          )}
        </p>
      )}
    </div>
    </section>
  );
}
