import { Dumbbell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MuscleDiagram } from "@/components/MuscleDiagram";
import { getExercise } from "@/lib/exercises";
import {
  applyProgrammeWeights,
  parseStrengthSetDraft,
  type WeightRow,
} from "@/lib/programme-weight-setup";
import { toDisplay, toKg, trimNumber, unitOf } from "@/lib/units";
import { useAppState } from "@/lib/storage";
import { hapticFailure, hapticSelection, hapticSetupComplete } from "@/lib/haptics";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import type { DayKey } from "@/lib/types";
import {
  applyWeeklyStrengthCheckIn,
  type StrengthCheckInAnswer,
} from "@/lib/weekly-strength-check-in";

const DAY_LABEL: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export function ProgrammeWeightSetup({ rows: derivedRows }: { rows: WeightRow[] }) {
  const [state, set] = useAppState();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const weightInput = useRef<HTMLInputElement>(null);
  const repsInput = useRef<HTMLInputElement>(null);
  const answers = useRef(new Map<string, StrengthCheckInAnswer>());
  const unit = unitOf(state);
  const automaticValues = useMemo(
    () =>
      new Map(
        derivedRows
          .filter((row) => row.autoApply && row.weightKg > 0)
          .map((row) => [row.exerciseId, row.weightKg]),
      ),
    [derivedRows],
  );
  const rows = useMemo(() => derivedRows.filter((row) => !row.autoApply), [derivedRows]);

  useEffect(() => {
    if (automaticValues.size === 0) return;
    set((current) => applyProgrammeWeights(current, automaticValues, { fillMissingOnly: true }));
  }, [automaticValues, set]);

  useEffect(() => {
    if (rows.length === 0) return;
    return lockBodyScroll();
  }, [rows.length]);

  if (!state.profile || rows.length === 0) return null;
  const activeStep = Math.min(step, rows.length - 1);
  const row = rows[activeStep]!;
  const savedAnswer = answers.current.get(row.exerciseId);
  const initialWeightKg = savedAnswer?.value ?? row.weightKg;
  const definition = getExercise(row.exerciseId, state.savedExercises);
  const highlightedMuscles = definition?.primaryMuscles?.length
    ? definition.primaryMuscles
    : definition?.muscleGroup
      ? [definition.muscleGroup]
      : [];

  return (
    <div
      className="fixed inset-0 z-[140] w-screen min-w-0 max-w-[100dvw] overflow-x-clip overflow-y-auto bg-black/95 px-3 py-8 backdrop-blur-sm"
      data-no-horizontal-overflow="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="programme-weight-title"
      aria-describedby="programme-weight-description"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto box-border w-full min-w-0 max-w-md overflow-x-clip rounded-3xl border border-accent-red/50 bg-[#101010] p-4 shadow-[0_0_60px_rgba(230,50,34,0.18)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="label-cap text-[10px] text-accent-red">FINAL SETUP · STARTING LOADS</p>
          <p className="label-cap text-[9px] text-grit-dim">
            {activeStep + 1} OF {rows.length}
          </p>
        </div>
        <h2
          id="programme-weight-title"
          className="display mt-1 text-3xl font-extrabold uppercase leading-none text-white"
        >
          Calibrate your week
        </h2>
        <p id="programme-weight-description" className="mt-3 text-xs leading-relaxed text-grit-dim">
          One movement at a time. Repeats use the same load everywhere, and your Strength Map stays
          honest until you log real sets.
        </p>

        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#242424]"
          role="progressbar"
          aria-label="Starting load setup"
          aria-valuemin={1}
          aria-valuemax={rows.length}
          aria-valuenow={activeStep + 1}
        >
          <div
            className="h-full rounded-full bg-accent-red transition-[width] duration-500 ease-out"
            style={{ width: `${((activeStep + 1) / rows.length) * 100}%` }}
          />
        </div>

        <form
          key={row.key}
          className="mt-5 space-y-3 animate-slide-up"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseStrengthSetDraft(
              weightInput.current?.value ?? "",
              repsInput.current?.value ?? "",
            );
            if (!parsed) {
              hapticFailure();
              setError(`Enter the load and 1–100 reps you can honestly complete for ${row.name}.`);
              weightInput.current?.focus();
              return;
            }
            answers.current.set(row.exerciseId, {
              exerciseId: row.exerciseId,
              kind: "RATIO",
              value: toKg(parsed.displayWeight, unit),
              reps: parsed.reps,
            });
            setError(null);
            if (activeStep < rows.length - 1) {
              hapticSelection();
              setStep(activeStep + 1);
              return;
            }
            const values = [...answers.current.values()];
            set((current) => applyWeeklyStrengthCheckIn(current, values));
            answers.current.clear();
            setStep(0);
            hapticSetupComplete();
          }}
        >
          <label className="block min-w-0 max-w-full overflow-x-clip rounded-2xl border border-grit bg-[#080808] p-4 sm:p-5">
            <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(72px,88px)] items-center gap-2 sm:gap-3">
              <span className="min-w-0">
                <span className="display block text-xl font-extrabold uppercase text-white">
                  {row.name}
                </span>
                <span className="mt-1 block text-[10px] leading-relaxed text-grit-dim">
                  {row.days.map((day) => DAY_LABEL[day]).join(" · ")}
                  {row.days.length > 1 ? " · one answer fills every repeat" : ""}
                </span>
              </span>
              <span className="block min-w-0 overflow-hidden" aria-hidden="true">
                <MuscleDiagram primary={highlightedMuscles} size={84} view="both" />
              </span>
            </span>
            <span className="mt-5 grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_minmax(72px,90px)] gap-2 overflow-x-clip">
              <span className="min-w-0">
                <span className="label-cap mb-1 block text-[8px] text-grit-dim">WORKING LOAD</span>
                <span className="flex min-h-14 w-full min-w-0 max-w-full items-center overflow-hidden rounded-xl border border-grit bg-black px-3 focus-within:border-accent-red">
                  <input
                    key={`${row.key}-weight`}
                    ref={weightInput}
                    name="weight"
                    type="text"
                    size={1}
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={
                      initialWeightKg > 0 ? trimNumber(toDisplay(initialWeightKg, unit)) : ""
                    }
                    placeholder="Tap to set"
                    className="box-border w-full min-w-0 max-w-full flex-1 bg-transparent text-2xl font-black tabular-nums text-white outline-none placeholder:text-sm placeholder:font-bold placeholder:text-grit-dim"
                  />
                  <span className="label-cap text-[8px] text-grit-dim">{unit}</span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="label-cap mb-1 block text-[8px] text-grit-dim">REPS</span>
                <input
                  key={`${row.key}-reps`}
                  ref={repsInput}
                  name="reps"
                  type="text"
                  size={1}
                  inputMode="numeric"
                  autoComplete="off"
                  defaultValue={String(savedAnswer?.reps ?? row.reps)}
                  className="box-border min-h-14 w-full min-w-0 max-w-full rounded-xl border border-grit bg-black px-2 text-center text-2xl font-black tabular-nums text-white outline-none focus:border-accent-red"
                />
              </span>
            </span>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-accent-red/50 bg-accent-red/10 px-3 py-2 text-xs font-bold text-accent-red"
            >
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => {
                hapticSelection();
                setError(null);
                setStep((current) => Math.max(0, current - 1));
              }}
              className="btn-ghost min-h-14 rounded-2xl disabled:opacity-30"
            >
              Back
            </button>
            <button
              type="submit"
              className="btn-grit flex min-h-14 items-center justify-center rounded-2xl"
            >
              <Dumbbell size={17} className="mr-2" />
              {activeStep === rows.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
