import { useMemo } from "react";

import { buildPlannedSetGrid, SET_GRID_DAYS } from "@/lib/planned-set-grid";
import { hapticSelection } from "@/lib/haptics";
import type { AppState, FocusMuscle } from "@/lib/types";

const SWEET_SPOT_MIN = 10;
const SWEET_SPOT_MAX = 20;

export function WeeklySetGrid({
  state,
  onSelectMuscle,
  compact = false,
}: {
  state: AppState;
  onSelectMuscle?: (muscle: FocusMuscle) => void;
  compact?: boolean;
}) {
  const grid = useMemo(() => buildPlannedSetGrid(state), [state]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111214]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="label-cap text-[8px] text-accent-red">WEEKLY SET MAP</p>
          <p className="display mt-0.5 text-lg font-black uppercase text-grit">
            Every muscle. Every day.
          </p>
        </div>
        <div className="text-right">
          <p className="display text-xl font-black tabular-nums text-grit">{grid.totalSets}</p>
          <p className="label-cap text-[7px] text-grit-dim">PLANNED SETS</p>
        </div>
      </div>

      <div className="min-w-0 px-2 pb-3 pt-2 sm:px-3">
        <div className="min-w-0">
          <div className="grid min-w-0 grid-cols-[minmax(46px,72px)_repeat(7,minmax(0,1fr))] gap-1">
            <span />
            {SET_GRID_DAYS.map((day) => (
              <span key={day} className="label-cap py-1 text-center text-[7px] text-grit-dim">
                {day.slice(0, 1)}
              </span>
            ))}
            {grid.rows.map((row) => {
              const under = row.totalSets > 0 && row.totalSets < SWEET_SPOT_MIN;
              const over = row.totalSets > SWEET_SPOT_MAX;
              return (
                <div key={row.muscle} className="contents">
                  <button
                    type="button"
                    disabled={!onSelectMuscle}
                    onClick={() => {
                      if (!onSelectMuscle) return;
                      hapticSelection();
                      onSelectMuscle(row.muscle);
                    }}
                    className="flex min-h-9 min-w-0 items-center justify-between gap-0.5 pr-0.5 text-left disabled:cursor-default sm:gap-1 sm:pr-1"
                    aria-label={`${row.muscle.toLowerCase()}, ${row.totalSets} planned sets`}
                  >
                    <span className="truncate text-[8px] font-black uppercase text-grit">
                      {row.muscle}
                    </span>
                    <span
                      className={`text-[8px] font-black tabular-nums ${
                        over ? "text-amber-300" : under ? "text-grit-dim" : "text-accent-red"
                      }`}
                    >
                      {row.totalSets || "—"}
                    </span>
                  </button>
                  {row.cells.map((cell) => {
                    const intensity = Math.min(1, cell.sets / 6);
                    return (
                      <div
                        key={`${row.muscle}-${cell.day}`}
                        className="relative grid min-h-9 place-items-center rounded-[5px] border border-white/[0.06]"
                        style={{
                          background:
                            cell.sets > 0
                              ? `rgba(230,50,34,${0.12 + intensity * 0.72})`
                              : "rgba(255,255,255,0.025)",
                        }}
                        title={`${cell.day}: ${cell.sets} ${row.muscle.toLowerCase()} sets across ${cell.exercises} exercise${cell.exercises === 1 ? "" : "s"}`}
                      >
                        {cell.sets > 0 ? (
                          <span className="text-[9px] font-black tabular-nums text-white">
                            {cell.sets}
                          </span>
                        ) : (
                          <span className="h-1 w-1 rounded-full bg-white/10" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <p className="text-[9px] leading-relaxed text-grit-dim">
            {onSelectMuscle
              ? "Tap a muscle for its growth plan. Grey means no exercise is scheduled."
              : "Darker squares mean more planned working sets. Grey means no exercise is scheduled."}
          </p>
          <span className="label-cap shrink-0 text-[7px] text-grit-dim">
            {grid.coveredMuscles}/6 COVERED
          </span>
        </div>
      )}
    </div>
  );
}
