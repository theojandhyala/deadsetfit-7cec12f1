import { useMemo } from "react";

import { buildHeatmap } from "@/lib/training-heatmap";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/** Volume intensity ramp: untrained → brand red at full quartile. */
const LEVEL_BG = [
  "rgba(255,255,255,0.05)",
  "rgba(230,50,34,0.28)",
  "rgba(230,50,34,0.5)",
  "rgba(230,50,34,0.74)",
  "#e63222",
];

/**
 * Twelve weeks of training at a glance, GitHub-contributions style. Density is
 * the point: a lifter should see their consistency (or the hole in it) in one
 * look, without reading a single number.
 */
export function TrainingHeatmap({ state }: { state: AppState }) {
  const { columns, maxVolume } = useMemo(
    () => buildHeatmap(state.sessions, state.completedDates, isoDay(), 12),
    [state.sessions, state.completedDates],
  );
  const trainedDays = columns.flat().filter((c) => c.trained).length;

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="label-cap text-[10px] text-accent-red">Last 12 weeks</p>
        <p className="label-cap text-[9px] text-grit-dim">
          {trainedDays} session day{trainedDays === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex gap-[3px]" role="img" aria-label={`Training heatmap: ${trainedDays} session days in the last 12 weeks`}>
        {columns.map((week, i) => (
          <div key={i} className="flex flex-col gap-[3px] flex-1">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date}${cell.volume ? ` — ${Math.round(cell.volume).toLocaleString()} kg` : cell.trained ? " — trained" : ""}`}
                className="aspect-square rounded-[3px]"
                style={{ background: LEVEL_BG[cell.level] }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-3">
        <span className="label-cap text-[8px] text-grit-dim">Less</span>
        {LEVEL_BG.map((bg) => (
          <span key={bg} className="w-2.5 h-2.5 rounded-[3px]" style={{ background: bg }} />
        ))}
        <span className="label-cap text-[8px] text-grit-dim">
          More{maxVolume > 0 ? ` · peak ${Math.round(maxVolume).toLocaleString()} kg` : ""}
        </span>
      </div>
    </div>
  );
}
