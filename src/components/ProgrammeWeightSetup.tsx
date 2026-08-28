import { Dumbbell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MuscleDiagram } from "@/components/MuscleDiagram";
import { getExercise } from "@/lib/exercises";
import {
  applyProgrammeWeights,
  parseDisplayWeight,
  type WeightRow,
} from "@/lib/programme-weight-setup";
import { toDisplay, toKg, trimNumber, unitOf } from "@/lib/units";
import { useAppState } from "@/lib/storage";
import { hapticFailure, hapticSelection, hapticSetupComplete } from "@/lib/haptics";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import type { DayKey } from "@/lib/types";

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
  const answers = useRef(new Map<string, number>());
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
  const definition = getExercise(row.exerciseId, state.savedExercises);
  const highlightedMuscles = definition?.primaryMuscles?.length
    ? definition.primaryMuscles
    : definition?.muscleGroup
      ? [definition.muscleGroup]
      : [];

  return (
    <div
      className="fixed inset-0 z-[140] overflow-y-auto bg-black/95 px-5 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="programme-weight-title"
      aria-describedby="programme-weight-description"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto max-w-md rounded-3xl border border-accent-red/50 bg-[#101010] p-5 shadow-[0_0_60px_rgba(230,50,34,0.18)]">
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
            className="h-full rounded-full bg-accent-red transition-all"
            style={{ width: `${((activeStep + 1) / rows.length) * 100}%` }}
          />
        </div>

        <form
          key={row.key}
          className="mt-5 space-y-3 animate-slide-up"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const display = parseDisplayWeight(data.get("weight"));
            if (display == null) {
              hapticFailure();
              setError(`Enter a weight above 0 ${unit} for ${row.name}. Decimals are allowed.`);
              return;
            }
            answers.current.set(row.exerciseId, toKg(display, unit));
            setError(null);
            if (activeStep < rows.length - 1) {
              hapticSelection();
              setStep(activeStep + 1);
              return;
            }
            const values = new Map(answers.current);
            set((current) => applyProgrammeWeights(current, values));
            answers.current.clear();
            setStep(0);
            hapticSetupComplete();
          }}
        >
          <label className="block rounded-2xl border border-grit bg-[#080808] p-5">
            <span className="grid grid-cols-[1fr_92px] items-center gap-3">
              <span className="min-w-0">
                <span className="display block text-xl font-extrabold uppercase text-white">
                  {row.name}
                </span>
                <span className="mt-1 block text-[10px] leading-relaxed text-grit-dim">
                  {row.days.map((day) => DAY_LABEL[day]).join(" · ")}
                  {row.days.length > 1 ? " · one answer fills every repeat" : ""}
                </span>
              </span>
              <span className="block" aria-hidden="true">
                <MuscleDiagram primary={highlightedMuscles} size={86} view="both" />
              </span>
            </span>
            <span className="mt-5 flex items-center gap-2">
              <input
                key={row.key}
                name="weight"
                autoFocus
                type="text"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={trimNumber(
                  toDisplay(answers.current.get(row.exerciseId) ?? row.weightKg, unit),
                )}
                placeholder={`e.g. ${unit === "kg" ? "62.5" : "135"}`}
                className="min-h-14 min-w-0 flex-1 rounded-xl border border-grit bg-black px-4 text-2xl font-black tabular-nums text-white outline-none focus:border-accent-red"
              />
              <span className="display w-8 text-sm font-extrabold uppercase text-grit-dim">
                {unit}
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
