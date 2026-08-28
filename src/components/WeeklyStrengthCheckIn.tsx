import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight, Clock3, Dumbbell, RefreshCw, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MuscleDiagram } from "@/components/MuscleDiagram";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { hapticFailure, hapticSelection, hapticStrengthMapUpdated } from "@/lib/haptics";
import { parseDisplayWeight } from "@/lib/programme-weight-setup";
import { strengthReport } from "@/lib/strength-grades";
import { OPEN_STRENGTH_CHECK_IN_EVENT } from "@/lib/strength-check-in-events";
import { useAppState } from "@/lib/storage";
import type { DayKey } from "@/lib/types";
import { toDisplay, toKg, trimNumber, unitOf } from "@/lib/units";
import {
  applyWeeklyStrengthCheckIn,
  snoozeWeeklyStrengthCheckIn,
  strengthCheckInLibrary,
  weeklyStrengthCheckInDue,
  weeklyStrengthCheckInRows,
  type StrengthCheckInAnswer,
} from "@/lib/weekly-strength-check-in";

const DAY_SHORT: Record<DayKey, string> = {
  MON: "MON",
  TUE: "TUE",
  WED: "WED",
  THU: "THU",
  FRI: "FRI",
  SAT: "SAT",
  SUN: "SUN",
};

type Result = {
  beforeScore: number;
  afterScore: number;
  changedMuscles: string[];
  reviewedCount: number;
};

export function WeeklyStrengthCheckIn({
  enabled = true,
  onVisibilityChange,
}: {
  enabled?: boolean;
  onVisibilityChange?: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [state, set] = useAppState();
  const [forcedOpen, setForcedOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const answers = useRef(new Map<string, StrengthCheckInAnswer>());
  const unit = unitOf(state);
  const rows = useMemo(() => weeklyStrengthCheckInRows(state), [state]);
  const due = weeklyStrengthCheckInDue(state);
  const open = enabled && rows.length > 0 && (forcedOpen || due || !!result);

  useEffect(() => {
    onVisibilityChange?.(open);
    return () => onVisibilityChange?.(false);
  }, [onVisibilityChange, open]);

  useEffect(() => {
    const show = () => {
      answers.current.clear();
      setStep(0);
      setError(null);
      setResult(null);
      setForcedOpen(true);
    };
    window.addEventListener(OPEN_STRENGTH_CHECK_IN_EVENT, show);
    return () => window.removeEventListener(OPEN_STRENGTH_CHECK_IN_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  if (!open) return null;

  const finish = () => {
    const collected = [...answers.current.values()];
    let nextResult: Result | null = null;
    set((current) => {
      const before = strengthReport(current, strengthCheckInLibrary(current));
      const next = applyWeeklyStrengthCheckIn(current, collected);
      const after = strengthReport(next, strengthCheckInLibrary(next));
      const beforeScores = new Map(before.muscles.map((muscle) => [muscle.muscle, muscle.score]));
      nextResult = {
        beforeScore: before.score,
        afterScore: after.score,
        changedMuscles: after.muscles
          .filter((muscle) => muscle.score !== beforeScores.get(muscle.muscle))
          .map((muscle) => muscle.muscle),
        reviewedCount: collected.length,
      };
      return next;
    });
    setResult(nextResult);
    hapticStrengthMapUpdated();
  };

  const advance = () => {
    setError(null);
    if (step < rows.length - 1) {
      setStep((current) => current + 1);
      hapticSelection();
    } else {
      finish();
    }
  };

  const close = () => {
    answers.current.clear();
    setForcedOpen(false);
    setResult(null);
    setStep(0);
  };

  if (result) {
    const delta = result.afterScore - result.beforeScore;
    return (
      <div
        className="fixed inset-0 z-[145] grid place-items-center overflow-y-auto bg-black/95 px-5 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="strength-sync-complete-title"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="w-full max-w-md rounded-3xl border border-accent-red/50 bg-[#101010] p-6 text-center shadow-[0_0_70px_rgba(230,50,34,.2)]">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-red text-white shadow-[0_10px_32px_rgba(230,50,34,.35)]">
            <Check size={30} strokeWidth={3} />
          </div>
          <p className="label-cap mt-5 text-[10px] text-accent-red">WEEKLY SYNC COMPLETE</p>
          <h2
            id="strength-sync-complete-title"
            className="display mt-1 text-3xl font-black uppercase leading-none text-white"
          >
            Your map is current
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <SummaryStat label="LIFTS REVIEWED" value={String(result.reviewedCount)} />
            <SummaryStat
              label="STRENGTH SCORE"
              value={`${result.afterScore}${delta > 0 ? ` (+${delta})` : ""}`}
            />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-grit-dim">
            {result.changedMuscles.length > 0
              ? `${result.changedMuscles.join(", ")} changed from the records you confirmed. Every repeated exercise now uses the same next-session load.`
              : "Your records and next-session loads are synced. A colour changes only when the confirmed result crosses a real strength threshold."}
          </p>
          <button
            type="button"
            onClick={() => {
              close();
              void navigate({ to: "/strength" });
            }}
            className="btn-grit mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl"
          >
            See updated Strength Map <ChevronRight size={17} className="ml-1" />
          </button>
          <button
            type="button"
            onClick={close}
            className="btn-ghost mt-2 min-h-12 w-full rounded-2xl"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const activeStep = Math.min(step, rows.length - 1);
  const row = rows[activeStep]!;
  const saved = answers.current.get(row.exerciseId);
  const defaultValue = saved?.value ?? row.value;
  const defaultReps = saved?.reps ?? row.reps;
  const metricLabel =
    row.kind === "RATIO"
      ? "BEST WORKING SET"
      : row.kind === "SECONDS"
        ? "LONGEST HOLD"
        : "BEST SET";

  return (
    <div
      className="fixed inset-0 z-[145] overflow-x-hidden overflow-y-auto bg-black/95 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-strength-title"
      aria-describedby="weekly-strength-description"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto w-full min-w-0 max-w-md overflow-hidden rounded-3xl border border-accent-red/50 bg-[#101010] p-5 shadow-[0_0_70px_rgba(230,50,34,.2)]">
        <div className="flex items-center justify-between gap-3">
          <p className="label-cap flex items-center gap-1.5 text-[10px] text-accent-red">
            <RefreshCw size={12} /> WEEKLY STRENGTH SYNC
          </p>
          <p className="label-cap text-[9px] text-grit-dim">
            {activeStep + 1} OF {rows.length}
          </p>
        </div>
        <h2
          id="weekly-strength-title"
          className="display mt-1 text-3xl font-black uppercase leading-none text-white"
        >
          Keep the map alive
        </h2>
        <p id="weekly-strength-description" className="mt-3 text-xs leading-relaxed text-grit-dim">
          Confirm the best set you actually completed. DEADSET updates your record, your next
          planned load and every matching exercise across the week.
        </p>

        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#242424]"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={rows.length}
          aria-valuenow={activeStep + 1}
        >
          <div
            className="h-full rounded-full bg-accent-red transition-all"
            style={{ width: `${((activeStep + 1) / rows.length) * 100}%` }}
          />
        </div>

        <form
          key={row.exerciseId}
          className="mt-5 animate-slide-up"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (row.kind === "RATIO") {
              const displayWeight = parseDisplayWeight(data.get("value"));
              const reps = Math.round(Number(data.get("reps")));
              if (displayWeight == null || !Number.isFinite(reps) || reps < 1 || reps > 100) {
                hapticFailure();
                setError(`Enter the load you lifted and 1–100 honest reps.`);
                return;
              }
              answers.current.set(row.exerciseId, {
                exerciseId: row.exerciseId,
                kind: row.kind,
                value: toKg(displayWeight, unit),
                reps,
              });
            } else {
              const value = Math.round(Number(data.get("value")));
              const max = row.kind === "SECONDS" ? 86_400 : 1_000;
              if (!Number.isFinite(value) || value < 1 || value > max) {
                hapticFailure();
                setError(
                  row.kind === "SECONDS"
                    ? "Enter a hold between 1 second and 24 hours."
                    : "Enter a rep count between 1 and 1,000.",
                );
                return;
              }
              answers.current.set(row.exerciseId, {
                exerciseId: row.exerciseId,
                kind: row.kind,
                value,
              });
            }
            advance();
          }}
        >
          <div className="rounded-2xl border border-grit bg-[#080808] p-4">
            <div className="grid grid-cols-[1fr_104px] items-center gap-3">
              <div className="min-w-0">
                <p className="label-cap text-[9px] text-accent-red">{metricLabel}</p>
                <p className="display mt-0.5 text-2xl font-black uppercase leading-none text-white">
                  {row.name}
                </p>
                <p className="mt-1 text-[10px] text-grit-dim">
                  {row.days.map((day) => DAY_SHORT[day]).join(" · ")}
                  {row.days.length > 1 ? " · one answer updates every repeat" : ""}
                </p>
              </div>
              <div aria-hidden="true">
                <MuscleDiagram primary={[row.muscleGroup]} view="both" size={98} />
              </div>
            </div>

            {row.kind === "RATIO" ? (
              <div className="mt-4 grid w-full min-w-0 grid-cols-[minmax(0,1.45fr)_minmax(78px,0.72fr)] gap-2">
                <label className="min-w-0">
                  <span className="label-cap mb-1.5 block text-[9px] text-grit-dim">WEIGHT</span>
                  <span className="flex min-h-14 w-full min-w-0 items-center overflow-hidden rounded-xl border border-grit bg-black px-3 focus-within:border-accent-red">
                    <input
                      name="value"
                      autoFocus
                      type="text"
                      size={1}
                      inputMode="decimal"
                      enterKeyHint="next"
                      autoComplete="off"
                      defaultValue={
                        defaultValue > 0 ? trimNumber(toDisplay(defaultValue, unit)) : ""
                      }
                      placeholder={unit === "kg" ? "62.5" : "135"}
                      className="w-full min-w-0 flex-1 bg-transparent text-2xl font-black tabular-nums text-white outline-none"
                    />
                    <span className="label-cap ml-1 shrink-0 text-[9px] text-grit-dim">{unit}</span>
                  </span>
                </label>
                <label className="min-w-0">
                  <span className="label-cap mb-1.5 block text-[9px] text-grit-dim">REPS</span>
                  <input
                    name="reps"
                    type="text"
                    size={1}
                    inputMode="numeric"
                    enterKeyHint="done"
                    autoComplete="off"
                    defaultValue={defaultValue > 0 ? String(defaultReps) : ""}
                    placeholder="8"
                    className="min-h-14 w-full rounded-xl border border-grit bg-black px-3 text-center text-2xl font-black tabular-nums text-white outline-none focus:border-accent-red"
                  />
                </label>
              </div>
            ) : (
              <label className="mt-5 block">
                <span className="label-cap mb-1.5 block text-[9px] text-grit-dim">
                  {row.kind === "SECONDS" ? "SECONDS" : "REPS"}
                </span>
                <input
                  name="value"
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  defaultValue={defaultValue > 0 ? String(Math.round(defaultValue)) : ""}
                  placeholder={row.kind === "SECONDS" ? "60" : "12"}
                  className="min-h-14 w-full rounded-xl border border-grit bg-black px-4 text-2xl font-black tabular-nums text-white outline-none focus:border-accent-red"
                />
              </label>
            )}

            {row.kind === "RATIO" && row.plannedWeightKg > 0 && (
              <p className="mt-2 text-[9px] text-grit-dim">
                Current plan: {trimNumber(toDisplay(row.plannedWeightKg, unit))} {unit}. Saving
                replaces it everywhere this movement repeats.
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-accent-red/50 bg-accent-red/10 px-3 py-2 text-xs font-bold text-accent-red"
            >
              {error}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeStep === 0) {
                  set((current) => snoozeWeeklyStrengthCheckIn(current));
                  close();
                } else {
                  setError(null);
                  setStep((current) => current - 1);
                  hapticSelection();
                }
              }}
              className="btn-ghost min-h-14 rounded-2xl"
            >
              {activeStep === 0 ? (
                <>
                  <Clock3 size={15} className="mr-1.5" /> Tomorrow
                </>
              ) : (
                "Back"
              )}
            </button>
            <button
              type="submit"
              className="btn-grit flex min-h-14 items-center justify-center rounded-2xl"
            >
              {activeStep === rows.length - 1 ? (
                <>
                  <Trophy size={16} className="mr-1.5" /> Sync map
                </>
              ) : (
                <>
                  <Dumbbell size={16} className="mr-1.5" /> Save & next
                </>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={advance}
            className="mt-2 min-h-11 w-full text-center text-[10px] font-bold uppercase tracking-wider text-grit-dim press"
          >
            No change for this exercise
          </button>
        </form>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-grit bg-black/50 p-3">
      <p className="display text-xl font-black tabular-nums text-white">{value}</p>
      <p className="label-cap mt-1 text-[8px] text-grit-dim">{label}</p>
    </div>
  );
}
