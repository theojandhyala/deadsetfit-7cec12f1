import { useMemo } from "react";
import { AudioWaveform } from "lucide-react";

import { trainingRhythm } from "@/lib/training-rhythm";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

const DAY_SHORT: Record<string, string> = {
  MON: "M",
  TUE: "T",
  WED: "W",
  THU: "T",
  FRI: "F",
  SAT: "S",
  SUN: "S",
};

/**
 * The lifter's real week: average tonnage per weekday with the strongest day
 * highlighted, plus a callout for the scheduled day that keeps being skipped.
 * Needs 8 finished sessions in the window before it says anything.
 */
export function TrainingRhythmCard({ state }: { state: AppState }) {
  const rhythm = useMemo(
    () =>
      trainingRhythm(
        state.sessions,
        state.completedDates,
        state.profile?.trainingDays,
        isoDay(),
      ),
    [state.sessions, state.completedDates, state.profile?.trainingDays],
  );

  if (!rhythm) return null;

  const max = Math.max(...rhythm.days.map((d) => d.avgVolumeKg), 1);

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <div className="flex items-baseline justify-between">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5 whitespace-nowrap">
            <AudioWaveform size={12} /> Your rhythm
          </p>
          <p className="label-cap text-[9px] text-grit-dim whitespace-nowrap">avg kg · 12 weeks</p>
        </div>

        <div
          className="flex items-end gap-1.5 h-20 mt-3"
          role="img"
          aria-label={`Average session volume by weekday. Strongest: ${rhythm.strongestDay ?? "none yet"}.`}
        >
          {rhythm.days.map((d) => {
            const strongest = d.day === rhythm.strongestDay;
            const skipped = d.day === rhythm.mostSkippedDay;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="w-full flex items-end" style={{ height: "56px" }}>
                  <div
                    className="w-full rounded-t-[4px]"
                    style={{
                      height: `${d.avgVolumeKg > 0 ? Math.max(8, (d.avgVolumeKg / max) * 56) : 3}px`,
                      background: strongest
                        ? "#e63222"
                        : d.avgVolumeKg > 0
                          ? "rgba(230,50,34,0.35)"
                          : "rgba(255,255,255,0.08)",
                    }}
                  />
                </div>
                <span
                  className={`label-cap text-[8px] ${
                    strongest ? "text-accent-red" : skipped ? "text-grit" : "text-grit-dim"
                  }`}
                >
                  {DAY_SHORT[d.day]}
                  {skipped ? "!" : ""}
                </span>
              </div>
            );
          })}
        </div>

        {rhythm.advice && (
          <p className="text-[11px] text-grit-dim leading-relaxed mt-3">{rhythm.advice}</p>
        )}
      </div>
    </section>
  );
}
