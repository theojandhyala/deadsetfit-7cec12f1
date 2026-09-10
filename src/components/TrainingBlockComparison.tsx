import { useMemo, type Dispatch, type SetStateAction } from "react";
import { ArrowUpRight, CalendarRange, Search } from "lucide-react";
import { compareTrainingBlocks, type BlockDays, type ChangeKind } from "@/lib/training-blocks";
import type { PerformanceLibrary, PerformanceMetric } from "@/lib/performance-lab";
import type { AppState } from "@/lib/types";
import { formatWeight, type WeightUnit } from "@/lib/units";
import { hapticSelection } from "@/lib/haptics";

const LABEL: Record<ChangeKind, string> = {
  IMPROVED: "Higher best",
  UNCHANGED: "Same best",
  LOWER: "Lower best",
  NEW: "New this period",
  PREVIOUS_ONLY: "Previous period only",
};
export interface ComparisonSettings {
  days: BlockDays;
  filter: ChangeKind | "ALL";
  query: string;
  limit: number;
}
const METRIC: Record<PerformanceMetric, string> = {
  LOAD: "Estimated max",
  REPS: "Bodyweight reps",
  HOLD: "Hold time",
  DISTANCE: "Distance",
};
const display = (value: number | null, metric: PerformanceMetric, unit: WeightUnit) =>
  value === null
    ? "No record"
    : metric === "LOAD"
      ? formatWeight(value, unit)
      : `${Math.round(value * 10) / 10} ${metric === "REPS" ? "reps" : metric === "HOLD" ? "sec" : "m"}`;
const dateLabel = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

export function TrainingBlockComparison({
  state,
  library,
  today,
  unit,
  onOpenExercise,
  settings,
  setSettings,
}: {
  state: AppState;
  library: PerformanceLibrary;
  today: string;
  unit: WeightUnit;
  onOpenExercise: (id: string) => void;
  settings: ComparisonSettings;
  setSettings: Dispatch<SetStateAction<ComparisonSettings>>;
}) {
  const { days, filter, query, limit } = settings;
  const setDays = (days: BlockDays) => setSettings((s) => ({ ...s, days }));
  const setFilter = (filter: ChangeKind | "ALL") => setSettings((s) => ({ ...s, filter }));
  const setQuery = (query: string) => setSettings((s) => ({ ...s, query }));
  const setLimit = (value: SetStateAction<number>) =>
    setSettings((s) => ({ ...s, limit: typeof value === "function" ? value(s.limit) : value }));
  const report = useMemo(
    () => compareTrainingBlocks(state, library, today, days),
    [state, library, today, days],
  );
  const rows = report.changes.filter(
    (row) =>
      (filter === "ALL" || row.change === filter) &&
      row.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const metrics: Array<{ label: string; current: string; previous: string }> = [
    {
      label: "Training days",
      current: String(report.current.trainingDays),
      previous: String(report.previous.trainingDays),
    },
    {
      label: "Workouts",
      current: String(report.current.sessions),
      previous: String(report.previous.sessions),
    },
    {
      label: "Working sets",
      current: String(report.current.workingSets),
      previous: String(report.previous.workingSets),
    },
    {
      label: "Lifting volume",
      current: formatWeight(report.current.volumeKg, unit),
      previous: formatWeight(report.previous.volumeKg, unit),
    },
    {
      label: "Exercises",
      current: String(report.current.exercises),
      previous: String(report.previous.exercises),
    },
  ];
  if (report.current.holdSeconds || report.previous.holdSeconds)
    metrics.push({
      label: "Hold time",
      current: display(report.current.holdSeconds, "HOLD", unit),
      previous: display(report.previous.holdSeconds, "HOLD", unit),
    });
  if (report.current.distanceMeters || report.previous.distanceMeters)
    metrics.push({
      label: "Distance",
      current: display(report.current.distanceMeters, "DISTANCE", unit),
      previous: display(report.previous.distanceMeters, "DISTANCE", unit),
    });
  return (
    <div className="weekly-momentum-details">
      <div className="flex items-center gap-2 text-accent-red">
        <CalendarRange size={18} />
        <h3 className="display text-xl font-black uppercase text-grit">Compare your training</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-grit-dim">
        See what changed between equal-length blocks. More volume or a higher number is not
        automatically better training.
      </p>
      <div role="group" aria-label="Comparison period" className="mt-3 grid grid-cols-3 gap-2">
        {([7, 28, 84] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={days === value}
            className={`min-h-11 rounded-xl border text-xs font-bold ${days === value ? "border-accent-red bg-accent-red/10 text-grit" : "border-grit text-grit-dim"}`}
            onClick={() => {
              hapticSelection();
              setDays(value);
              setLimit(10);
            }}
          >
            {value === 7 ? "1 week" : value === 28 ? "4 weeks" : "12 weeks"}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] leading-relaxed">
        <div className="rounded-xl border border-grit p-3">
          <p className="font-bold text-grit-dim">PREVIOUS {days} DAYS</p>
          <p className="mt-1 text-grit">
            {dateLabel(report.previous.start)} – {dateLabel(report.previous.end)}
          </p>
        </div>
        <div className="rounded-xl border border-accent-red/30 bg-accent-red/[.06] p-3">
          <p className="font-bold text-accent-red">LAST {days} DAYS</p>
          <p className="mt-1 text-grit">
            {dateLabel(report.current.start)} – {dateLabel(report.current.end)}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-grit p-3" aria-label="Training block totals">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,.85fr)_minmax(0,.85fr)] gap-2 border-b border-grit pb-2 text-[10px] font-bold text-grit-dim">
          <span>COMPLETED WORK</span>
          <span className="text-right">PREVIOUS</span>
          <span className="text-right text-accent-red">LATEST</span>
        </div>
        {metrics.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,.85fr)_minmax(0,.85fr)] items-center gap-2 border-b border-white/5 py-3 text-xs last:border-0"
          >
            <span className="text-grit-dim">{item.label}</span>
            <span className="break-words text-right text-grit-dim">{item.previous}</span>
            <span className="break-words text-right font-bold text-grit">{item.current}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-accent-red/30 bg-accent-red/[.06] p-4">
        <p className="display text-2xl font-black text-grit">
          {report.improved} / {report.comparable}
        </p>
        <p className="mt-1 text-xs font-bold text-grit">Comparable records with a higher best</p>
        <p className="mt-2 text-[10px] leading-relaxed text-grit-dim">
          Only the same exercise and metric in both blocks count. These are period bests, not
          necessarily all-time PRs.
        </p>
      </div>
      {!report.current.sessions && (
        <p role="status" className="mt-3 rounded-xl border border-grit p-3 text-xs text-grit-dim">
          No completed working sets in the latest block yet. Rest and time away are not failures.
        </p>
      )}
      <div className="relative mt-4">
        <Search size={15} className="absolute left-3 top-4 text-grit-dim" />
        <input
          type="search"
          defaultValue={query}
          aria-label="Search block comparisons"
          placeholder="Find a movement"
          className="input-grit min-h-11 w-full min-w-0"
          style={{ paddingLeft: 40 }}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setLimit(10);
          }}
        />
      </div>
      <div
        role="group"
        aria-label="Filter performance change"
        className="mt-2 flex flex-wrap gap-2"
      >
        {(["ALL", "IMPROVED", "UNCHANGED", "LOWER", "NEW", "PREVIOUS_ONLY"] as const).map(
          (value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={`min-h-11 rounded-xl border px-3 text-[10px] font-bold ${filter === value ? "border-accent-red text-grit" : "border-grit text-grit-dim"}`}
              onClick={() => {
                hapticSelection();
                setFilter(value);
                setLimit(10);
              }}
            >
              {value === "ALL" ? "All changes" : LABEL[value]}
            </button>
          ),
        )}
      </div>
      <div className="mt-3 space-y-2">
        {rows.slice(0, limit).map((row) => (
          <button
            key={row.exerciseId + "-" + row.metric}
            type="button"
            onClick={() => onOpenExercise(row.exerciseId)}
            className="press block w-full min-w-0 rounded-2xl border border-grit p-3 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 break-words text-sm font-bold text-grit">{row.name}</span>
              <ArrowUpRight size={16} className="shrink-0 text-accent-red" />
            </div>
            <p className="mt-1 text-[10px] text-grit-dim">
              {METRIC[row.metric]} · {LABEL[row.change]}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-grit">
              <span className="text-grit-dim">{display(row.previous, row.metric, unit)}</span>
              <span aria-label="to">→</span>
              <span className="font-bold">{display(row.current, row.metric, unit)}</span>
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-grit-dim">
              {row.previousDays} previous / {row.currentDays} latest training dates
              {Math.min(row.previousDays, row.currentDays) < 2 ? " · Limited evidence" : ""}
            </p>
          </button>
        ))}
        {!rows.length && (
          <p
            role="status"
            className="rounded-xl border border-dashed border-grit p-4 text-xs text-grit-dim"
          >
            No movements match this view. Try another period, filter or search.
          </p>
        )}
      </div>
      {rows.length > limit && (
        <button
          type="button"
          className="mt-3 min-h-11 w-full rounded-xl border border-grit text-xs font-bold text-grit"
          onClick={() => {
            hapticSelection();
            setLimit((v) => v + 10);
          }}
        >
          Show more movements ({rows.length - limit} remaining)
        </button>
      )}
      <p className="mt-4 text-[10px] leading-relaxed text-grit-dim">
        Completed workouts only; check-ins and legacy logs are excluded. Warm-ups, drop sets,
        invalid entries and future dates do not count. Today's block is still in progress. Equipment
        and technique changes can affect comparisons. Nothing here changes your programme or saved
        records.
      </p>
    </div>
  );
}
