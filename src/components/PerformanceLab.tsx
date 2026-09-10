import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft, ChevronRight, FlaskConical, Search, Trophy } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useToday } from "@/hooks/useToday";
import { hapticSelection } from "@/lib/haptics";
import { formatSet } from "@/lib/set-tracking";
import { formatWeight, toDisplay, toKg, type WeightUnit } from "@/lib/units";
import { calendarDaysUntil } from "@/lib/weekly-consistency";
import {
  GRADED_MUSCLES,
  TIER_COLOR,
  type ExerciseGrade,
  type StrengthReport,
} from "@/lib/strength-grades";
import {
  buildPerformanceLedger,
  parsePreviewNumber,
  previewPerformance,
  rankRoadmap,
  recordForGrade,
  evidenceMatchesGrade,
  standardDescription,
  type EvidenceSource,
  type ExercisePerformance,
  type PerformanceLibrary,
  type PerformanceMetric,
  type PerformanceRecord,
  type PreviewResult,
} from "@/lib/performance-lab";
import type { AppState, MuscleGroup } from "@/lib/types";

export type PerformanceTab = "ROADMAP" | "RECORDS";
const METRIC_LABEL: Record<PerformanceMetric, string> = {
  LOAD: "Estimated max",
  REPS: "Bodyweight reps",
  HOLD: "Hold time",
  DISTANCE: "Distance",
};
const SOURCE_LABEL: Record<EvidenceSource, string> = {
  WORKOUT: "Completed workout",
  CHECK_IN: "Self-reported check-in",
  LEGACY: "Legacy log",
};
const compactDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
const tierLabel = (tier: string) => tier.replaceAll("_", " ");

function measuredLabel(value: number, metric: PerformanceMetric, unit: WeightUnit): string {
  if (metric === "LOAD") return `${formatWeight(value, unit)} e1RM`;
  return `${Math.round(value * 10) / 10} ${metric === "REPS" ? "reps" : metric === "HOLD" ? "seconds" : "m"}`;
}

export function PerformanceLab({
  state,
  report,
  library,
  unit,
  initialTab,
  initialExerciseId,
  onClose,
  onBuildMuscle,
}: {
  state: AppState;
  report: StrengthReport;
  library: PerformanceLibrary;
  unit: WeightUnit;
  initialTab: PerformanceTab;
  initialExerciseId?: string;
  onClose: () => void;
  onBuildMuscle: (muscle: MuscleGroup) => void;
}) {
  const today = useToday();
  const [tab, setTab] = useState<PerformanceTab>(initialTab);
  const [muscle, setMuscle] = useState<MuscleGroup | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const [selectedId, setSelectedId] = useState<string | null>(initialExerciseId ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [selectedId, tab]);
  const ledger = useMemo(
    () => buildPerformanceLedger(state, library, today),
    [state, library, today],
  );
  const roadmap = useMemo(
    () => rankRoadmap(report, muscle === "ALL" ? undefined : muscle),
    [report, muscle],
  );
  const ledgerById = useMemo(
    () => new Map(ledger.map((entry) => [entry.exerciseId, entry])),
    [ledger],
  );
  const gradesById = useMemo(
    () =>
      new Map(
        report.muscles.flatMap((item) => item.exercises).map((grade) => [grade.exerciseId, grade]),
      ),
    [report],
  );
  const matches = (name: string) =>
    name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const ranks = roadmap.filter((grade) => matches(grade.name));
  const records = ledger.filter(
    (entry) => (muscle === "ALL" || entry.muscle === muscle) && matches(entry.name),
  );
  const selected = selectedId ? ledgerById.get(selectedId) : undefined;
  const selectedGrade = selectedId ? gradesById.get(selectedId) : undefined;
  const resultCount = tab === "ROADMAP" ? ranks.length : records.length;

  function openExercise(id: string) {
    hapticSelection();
    setSelectedId(id);
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-grit bg-[#101113] p-0"
      >
        <div className="shrink-0 border-b border-grit px-5 pb-3 pt-5 pr-14">
          <p className="label-cap text-[9px] text-accent-red">DEADSET PERFORMANCE LAB</p>
          <SheetTitle className="display mt-1 text-2xl font-black uppercase text-grit">
            Make your next move count
          </SheetTitle>
          <SheetDescription className="mt-1 text-xs text-grit-dim">
            Real records. Clear benchmarks. No invented progress.
          </SheetDescription>
        </div>
        <div
          ref={scrollRef}
          className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(24px,env(safe-area-inset-bottom))]"
        >
          {selectedId ? (
            <div className="weekly-momentum-details">
              <button
                type="button"
                className="flex min-h-11 items-center gap-2 text-xs font-bold text-grit"
                onClick={() => {
                  hapticSelection();
                  setSelectedId(null);
                }}
              >
                <ArrowLeft size={15} /> Back to {tab === "ROADMAP" ? "roadmap" : "record book"}
              </button>
              {selected ? (
                <ExerciseEvidence
                  key={`${selectedId}-${unit}`}
                  exercise={selected}
                  grade={selectedGrade}
                  state={state}
                  unit={unit}
                  today={today}
                  onClose={onClose}
                />
              ) : (
                <div className="rounded-2xl border border-grit p-4">
                  <p className="text-sm text-grit">No usable dated evidence found for this lift.</p>
                  <p className="mt-2 text-xs text-grit-dim">
                    Review the lift's saved history before relying on its rank.
                  </p>
                  <Link
                    to="/lift/$exerciseId"
                    params={{ exerciseId: selectedId }}
                    onClick={onClose}
                    className="mt-2 flex min-h-11 items-center text-xs font-bold text-accent-red"
                  >
                    Review lift history
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <Tabs.Root
                value={tab}
                onValueChange={(value) => {
                  hapticSelection();
                  setTab(value as PerformanceTab);
                  setLimit(12);
                }}
                className="pt-4"
              >
                <Tabs.List
                  aria-label="Performance view"
                  className="grid grid-cols-2 gap-2 rounded-2xl border border-grit p-1"
                >
                  <Tabs.Trigger
                    value="ROADMAP"
                    className="min-h-11 rounded-xl text-xs font-bold text-grit-dim data-[state=active]:bg-accent-red data-[state=active]:text-white"
                  >
                    Rank roadmap
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="RECORDS"
                    className="min-h-11 rounded-xl text-xs font-bold text-grit-dim data-[state=active]:bg-accent-red data-[state=active]:text-white"
                  >
                    Record book
                  </Tabs.Trigger>
                </Tabs.List>
                <div className="relative mt-3">
                  <Search size={15} className="absolute left-3 top-4 text-grit-dim" />
                  <input
                    type="search"
                    inputMode="search"
                    defaultValue={query}
                    aria-label="Search your lifts"
                    placeholder="Search your lifts"
                    className="input-grit min-h-11 w-full min-w-0 rounded-xl pl-10"
                    style={{ paddingLeft: 40 }}
                    onChange={(event) => {
                      setQuery(event.currentTarget.value);
                      setLimit(12);
                    }}
                  />
                </div>
                <div
                  className="mt-2 flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Filter muscle group"
                >
                  {(["ALL", ...GRADED_MUSCLES] as const).map((group) => (
                    <button
                      key={group}
                      type="button"
                      aria-pressed={muscle === group}
                      onClick={() => {
                        hapticSelection();
                        setMuscle(group);
                        setLimit(12);
                      }}
                      className={`min-h-11 rounded-xl border px-3 text-[10px] font-bold ${muscle === group ? "border-accent-red bg-accent-red/10 text-grit" : "border-grit text-grit-dim"}`}
                    >
                      {group === "ALL"
                        ? "All muscles"
                        : group.charAt(0) + group.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
                <Tabs.Content value="ROADMAP" className="weekly-momentum-details mt-4">
                  <div className="rounded-2xl border border-accent-red/25 bg-accent-red/[.06] p-3">
                    <p className="text-sm font-bold text-grit">Your closest benchmarks</p>
                    <p className="mt-1 text-xs leading-relaxed text-grit-dim">
                      Sorted by the relative gap to each lift's next tier—not a list of weights to
                      attempt today. Tapping a lift shows the evidence and a separate preview.
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {ranks.slice(0, limit).map((grade) => {
                      const record = recordForGrade(ledgerById.get(grade.exerciseId), grade);
                      const metric =
                        grade.kind === "RATIO"
                          ? "LOAD"
                          : grade.kind === "SECONDS"
                            ? "HOLD"
                            : "REPS";
                      return (
                        <button
                          key={grade.exerciseId}
                          type="button"
                          onClick={() => openExercise(grade.exerciseId)}
                          className="press block w-full min-w-0 rounded-2xl border border-grit bg-black/20 p-3 text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 break-words text-sm font-bold text-grit">
                              {grade.name}
                            </span>
                            <ChevronRight size={15} className="mt-1 shrink-0 text-accent-red" />
                          </div>
                          <p
                            className="mt-1 text-[10px] font-bold"
                            style={{ color: TIER_COLOR[grade.tier] }}
                          >
                            {tierLabel(grade.tier)}{" "}
                            {grade.nextTier
                              ? `→ ${tierLabel(grade.nextTier)}`
                              : "· Top tier reached"}
                          </p>
                          <div
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                              style={{
                                width: `${Math.round(grade.progress * 100)}%`,
                                background: TIER_COLOR[grade.tier],
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-grit">
                            {measuredLabel(grade.value, metric, unit)}
                            {grade.nextAt !== null
                              ? ` · next ${measuredLabel(grade.nextAt, metric, unit)}`
                              : " · Keep building your personal best"}
                          </p>
                          <p className="mt-1 text-[10px] leading-relaxed text-grit-dim">
                            {standardDescription(grade.exerciseId)} ·{" "}
                            {record && evidenceMatchesGrade(record, grade)
                              ? SOURCE_LABEL[record.best.source]
                              : "Evidence needs review"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {ranks.length === 0 && (
                    <EmptyResults
                      message={
                        query
                          ? "No ranked lifts match that search."
                          : "No ranked lifts here yet. Your personal records can still appear in Record book."
                      }
                    />
                  )}
                  {report.ungraded.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-dashed border-grit p-3">
                      <p className="text-xs font-bold text-grit">Build your missing areas</p>
                      <p className="mt-1 text-xs text-grit-dim">
                        Grey means missing ranked data, not weak muscles.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {report.ungraded.map((group) => (
                          <button
                            key={group}
                            type="button"
                            className="min-h-11 rounded-xl border border-grit px-2 text-xs font-bold text-grit"
                            onClick={() => {
                              hapticSelection();
                              onBuildMuscle(group);
                            }}
                          >
                            {group.toLowerCase()} <span aria-hidden="true">→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Tabs.Content>
                <Tabs.Content value="RECORDS" className="weekly-momentum-details mt-4">
                  <p className="text-xs leading-relaxed text-grit-dim">
                    Reps, holds and distance deserve a record too. Metrics stay separate; an
                    estimated max is not a tested one-rep max. Check-ins are labelled, never
                    disguised as workouts.
                  </p>
                  <div className="mt-3 space-y-2">
                    {records.slice(0, limit).map((entry) => (
                      <button
                        key={entry.exerciseId}
                        type="button"
                        className="press block w-full min-w-0 rounded-2xl border border-grit bg-black/20 p-3 text-left"
                        onClick={() => openExercise(entry.exerciseId)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="break-words text-sm font-bold text-grit">
                            {entry.name}
                          </span>
                          <ChevronRight size={15} className="shrink-0 text-accent-red" />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {entry.records.map((record) => (
                            <span
                              key={record.metric}
                              className="rounded-lg border border-grit px-2 py-1 text-[10px] text-grit"
                            >
                              {measuredLabel(record.best.value, record.metric, unit)}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                  {records.length === 0 && (
                    <EmptyResults
                      message={
                        query
                          ? "No records match that search."
                          : "Your completed sets and dated check-ins will build this record book."
                      }
                    />
                  )}
                </Tabs.Content>
              </Tabs.Root>
              {resultCount > limit && (
                <button
                  type="button"
                  className="mt-3 min-h-11 w-full rounded-xl border border-grit text-xs font-bold text-grit"
                  onClick={() => {
                    hapticSelection();
                    setLimit((value) => value + 12);
                  }}
                >
                  Show more ({resultCount - limit} remaining)
                </button>
              )}
              <p className="mt-4 text-[10px] leading-relaxed text-grit-dim">
                Benchmarks are DEADSET estimates, not verified population percentiles or
                measurements of muscle size. Equipment, technique and logging conventions affect
                comparisons. Warm-ups, drop sets, unfinished workouts and invalid/future dates are
                excluded from this evidence book.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyResults({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-grit p-5 text-center">
      <Trophy size={22} className="mx-auto text-accent-red" />
      <p className="mt-2 text-xs leading-relaxed text-grit-dim">{message}</p>
    </div>
  );
}

function ExerciseEvidence({
  exercise,
  grade,
  state,
  unit,
  today,
  onClose,
}: {
  exercise: ExercisePerformance;
  grade?: ExerciseGrade;
  state: AppState;
  unit: WeightUnit;
  today: string;
  onClose: () => void;
}) {
  const [requestedMetric, setMetric] = useState<PerformanceMetric>(() =>
    grade
      ? (recordForGrade(exercise, grade)?.metric ?? exercise.records[0].metric)
      : exercise.records[0].metric,
  );
  const [evidenceLimit, setEvidenceLimit] = useState(8);
  // A sync or history edit can remove the selected metric while the sheet is open.
  const record =
    exercise.records.find((item) => item.metric === requestedMetric) ?? exercise.records[0];
  const metric = record.metric;
  const age = calendarDaysUntil(record.best.date, today) ?? 0;
  const recentMax = Math.max(...record.recent.map((item) => item.value), 1);
  return (
    <div className="pb-2">
      <h3 className="display break-words text-2xl font-black uppercase text-grit">
        {exercise.name}
      </h3>
      <p className="mt-1 text-[10px] leading-relaxed text-grit-dim">
        {grade
          ? standardDescription(exercise.exerciseId)
          : "Personal records · not every metric has an applicable strength rank"}
      </p>
      {grade && !evidenceMatchesGrade(recordForGrade(exercise, grade), grade) && (
        <p className="mt-2 rounded-xl border border-amber-500/30 p-3 text-xs leading-relaxed text-amber-200">
          The map's value does not match the valid dated evidence below. Review the lift's history
          and check-in dates before relying on that rank. No records have been changed.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Record metric">
        {exercise.records.map((item) => (
          <button
            key={item.metric}
            type="button"
            aria-pressed={metric === item.metric}
            onClick={() => {
              hapticSelection();
              setMetric(item.metric);
              setEvidenceLimit(8);
            }}
            className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${metric === item.metric ? "border-accent-red bg-accent-red/10 text-grit" : "border-grit text-grit-dim"}`}
          >
            {METRIC_LABEL[item.metric]}
          </button>
        ))}
      </div>
      <section
        className="mt-3 rounded-2xl border border-grit bg-accent-red/[.06] p-4"
        aria-label="Personal best evidence"
      >
        <p className="label-cap text-[9px] text-accent-red">
          PERSONAL BEST · {METRIC_LABEL[metric]}
        </p>
        <p className="display mt-2 text-2xl font-black text-grit">
          {measuredLabel(record.best.value, metric, unit)}
        </p>
        <p className="mt-1 text-sm text-grit">From {formatSet(record.best.set, false, unit)}</p>
        <p className="mt-2 text-xs text-grit-dim">
          {SOURCE_LABEL[record.best.source]} · {compactDate(record.best.date)}
        </p>
        <p className="mt-1 text-xs text-grit-dim">
          {age === 0 ? "Recorded today" : `${age} ${age === 1 ? "day" : "days"} ago`} ·{" "}
          {record.trainingDays} completed training {record.trainingDays === 1 ? "day" : "days"}
        </p>
        {record.best.source === "CHECK_IN" && (
          <p className="mt-2 text-xs leading-relaxed text-grit-dim">
            This reference was entered during setup or Strength Sync. It is self-reported, not a
            completed workout or independently verified lift.
          </p>
        )}
        {age > 90 && (
          <p className="mt-2 text-xs leading-relaxed text-grit-dim">
            An older personal best is still yours. It may not represent today's capacity; don't
            treat it as a starting load after a break.
          </p>
        )}
      </section>
      <section className="mt-4" aria-label="Recent comparable workouts">
        <p className="label-cap text-[10px] text-grit">RECENT TRAINING DAYS</p>
        <p className="mt-1 text-xs leading-relaxed text-grit-dim">
          {record.delta === null
            ? "Complete this movement on two different days to compare performances. Check-ins do not count as workouts."
            : `${record.delta > 0 ? "Up" : record.delta < 0 ? "Down" : "Unchanged"}${record.delta ? ` ${measuredLabel(Math.abs(record.delta), metric, unit)}` : ""} versus the previous training day. A single change is not a trend.`}
        </p>
        <div className="mt-3 space-y-2">
          {[...record.recent].reverse().map((entry) => (
            <div key={entry.date}>
              <div className="flex flex-wrap justify-between gap-1 text-[10px] text-grit-dim">
                <span>{compactDate(entry.date)}</span>
                <span>{measuredLabel(entry.value, metric, unit)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/5" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-accent-red"
                  style={{ width: `${(entry.value / recentMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <PerformancePreview
        key={metric}
        exercise={exercise}
        record={record}
        state={state}
        unit={unit}
      />
      <section className="mt-4">
        <p className="label-cap text-[10px] text-grit">THE RECORD TRAIL</p>
        <div className="mt-2 space-y-2">
          {record.evidence.slice(0, evidenceLimit).map((entry, index) => (
            <div
              key={`${entry.date}-${entry.source}-${index}`}
              className="rounded-xl border border-grit p-3"
            >
              <p className="text-xs font-bold text-grit">{formatSet(entry.set, false, unit)}</p>
              <p className="mt-1 text-[10px] text-grit-dim">
                {compactDate(entry.date)} · {SOURCE_LABEL[entry.source]}
              </p>
            </div>
          ))}
        </div>
        {record.evidence.length > evidenceLimit && (
          <button
            type="button"
            className="mt-2 min-h-11 w-full rounded-xl border border-grit text-xs font-bold text-grit"
            onClick={() => {
              hapticSelection();
              setEvidenceLimit((value) => value + 12);
            }}
          >
            Show more evidence
          </button>
        )}
      </section>
      <Link
        to="/lift/$exerciseId"
        params={{ exerciseId: exercise.exerciseId }}
        onClick={() => {
          hapticSelection();
          onClose();
        }}
        className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-accent-red px-3 text-xs font-bold text-white"
      >
        Open full lift history
      </Link>
    </div>
  );
}

function PerformancePreview({
  exercise,
  record,
  state,
  unit,
}: {
  exercise: ExercisePerformance;
  record: PerformanceRecord;
  state: AppState;
  unit: WeightUnit;
}) {
  const valueRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const valueLabel =
    record.metric === "LOAD"
      ? `Weight (${unit})`
      : record.metric === "REPS"
        ? "Reps"
        : record.metric === "HOLD"
          ? "Seconds"
          : "Metres";
  function preview(event: React.FormEvent) {
    event.preventDefault();
    hapticSelection();
    const input = parsePreviewNumber(valueRef.current?.value ?? "");
    setResult(
      previewPerformance({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        muscle: exercise.muscle,
        metric: record.metric,
        value: record.metric === "LOAD" ? toKg(input, unit) : input,
        reps: parsePreviewNumber(repsRef.current?.value ?? "1"),
        bodyweightKg: state.profile?.weightKg ?? 0,
        gender: state.profile?.gender,
      }),
    );
  }
  return (
    <section
      className="mt-4 rounded-2xl border border-accent-red/30 bg-accent-red/[.06] p-3"
      aria-label="What-if preview"
    >
      <p className="label-cap flex items-center gap-2 text-[10px] text-grit">
        <FlaskConical size={14} className="text-accent-red" /> WHAT IF?
      </p>
      <p className="mt-2 text-xs leading-relaxed text-grit-dim">
        Explore a number without changing your history, plan or rank. This is a calculator—not a
        weight recommendation.
      </p>
      <form onSubmit={preview} noValidate className="mt-3">
        <div
          className={`grid min-w-0 gap-2 ${record.metric === "LOAD" ? "grid-cols-2" : "grid-cols-1"}`}
        >
          <label className="min-w-0 text-xs text-grit-dim">
            {valueLabel}
            <input
              ref={valueRef}
              type="text"
              inputMode={record.metric === "REPS" ? "numeric" : "decimal"}
              defaultValue={
                record.metric === "LOAD"
                  ? toDisplay(record.best.set.weight, unit)
                  : record.best.value
              }
              onChange={() => setResult(null)}
              className="input-grit mt-1 min-h-11 w-full min-w-0 rounded-xl"
            />
          </label>
          {record.metric === "LOAD" && (
            <label className="min-w-0 text-xs text-grit-dim">
              Reps (1–12)
              <input
                ref={repsRef}
                type="text"
                inputMode="numeric"
                defaultValue={Math.min(12, record.best.set.reps)}
                onChange={() => setResult(null)}
                className="input-grit mt-1 min-h-11 w-full min-w-0 rounded-xl"
              />
            </label>
          )}
        </div>
        <button
          type="submit"
          className="mt-2 min-h-11 w-full rounded-xl bg-accent-red px-3 text-xs font-bold text-white"
        >
          Preview only
        </button>
      </form>
      <div role="status" className="mt-2 text-xs leading-relaxed text-grit">
        {result &&
          (result.ok ? (
            <>
              <p>
                {measuredLabel(result.value, record.metric, unit)}
                {result.grade
                  ? ` · ${tierLabel(result.grade.tier)}`
                  : " · Personal metric, no applicable rank"}
              </p>
              <p className="mt-1 text-grit-dim">
                {result.value > record.best.value
                  ? "That would exceed this recorded personal best."
                  : "Compared with your current recorded best."}{" "}
                Nothing saved.
              </p>
            </>
          ) : (
            <p className="text-red-400">{result.error}</p>
          ))}
      </div>
    </section>
  );
}
