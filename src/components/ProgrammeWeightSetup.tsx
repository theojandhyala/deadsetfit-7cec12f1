import { Dumbbell } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { getExercise } from "@/lib/exercises";
import { requiresWorkingWeight } from "@/lib/workout-flow";
import { trackingModeFor } from "@/lib/set-tracking";
import { toDisplay, toKg, trimNumber, unitOf } from "@/lib/units";
import { useAppState } from "@/lib/storage";
import type { DayKey, Schedule } from "@/lib/types";

type WeightRow = {
  key: string;
  exerciseId: string;
  name: string;
  weightKg: number;
  days: DayKey[];
};

const DAY_LABEL: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export function ProgrammeWeightSetup() {
  const [state, set] = useAppState();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const answers = useRef(new Map<string, number>());
  const unit = unitOf(state);
  const rows = useMemo<WeightRow[]>(() => {
    const known = new Map<string, number>();
    for (const day of Object.values(state.schedule ?? {})) {
      for (const exerciseId of day.exerciseIds) {
        const stored = day.exerciseConfig?.[exerciseId]?.weightKg ?? 0;
        if (stored > 0) known.set(exerciseId, stored);
      }
    }
    const active = state.programs.find((program) => program.id === state.activeProgramId);
    for (const day of Object.values(active?.days ?? {})) {
      for (const item of day.items) {
        if ((item.weightKg ?? 0) > 0) known.set(item.id, item.weightKg!);
      }
    }
    const historyWeight = (exerciseId: string) => {
      const sessions = [...state.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      for (const session of sessions) {
        const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
        const weighted = [...(exercise?.sets ?? [])].reverse().find((set) => set.weight > 0);
        if (weighted) return weighted.weight;
      }
      return 0;
    };
    const missing = new Map<string, { exerciseId: string; name: string; days: Set<DayKey> }>();
    const addMissing = (exerciseId: string, name: string, day: DayKey) => {
      const row = missing.get(exerciseId) ?? { exerciseId, name, days: new Set<DayKey>() };
      row.days.add(day);
      missing.set(exerciseId, row);
    };

    if (state.schedule) {
      for (const day of Object.keys(state.schedule) as DayKey[]) {
        const plan = state.schedule[day];
        for (const exerciseId of plan.exerciseIds) {
          const exercise = getExercise(exerciseId, state.savedExercises);
          if (!exercise) continue;
          const reps = plan.exerciseConfig?.[exerciseId]?.reps ?? plan.reps ?? exercise.reps;
          const tracking = trackingModeFor(exercise, reps);
          if (!requiresWorkingWeight({ tracking }, exercise.equipment)) continue;
          const stored = plan.exerciseConfig?.[exerciseId]?.weightKg ?? 0;
          if (stored > 0) continue;
          addMissing(exerciseId, exercise.name, day);
        }
      }
    }

    if (active) {
      for (const day of Object.keys(active.days) as DayKey[]) {
        active.days[day].items.forEach((item) => {
          const definition = getExercise(item.id, state.savedExercises);
          const tracking = trackingModeFor(definition ?? { name: item.name }, item.reps);
          if (!requiresWorkingWeight({ tracking }, definition?.equipment ?? item.equipment)) return;
          if ((item.weightKg ?? 0) > 0) return;
          addMissing(item.id, item.name, day);
        });
      }
    }
    return [...missing.values()].map((row) => ({
      key: row.exerciseId,
      exerciseId: row.exerciseId,
      name: row.name,
      days: [...row.days],
      weightKg: known.get(row.exerciseId) ?? historyWeight(row.exerciseId),
    }));
  }, [state]);

  if (!state.profile || rows.length === 0) return null;
  const activeStep = Math.min(step, rows.length - 1);
  const row = rows[activeStep]!;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/90 px-5 py-8 backdrop-blur-sm"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto max-w-md rounded-3xl border border-accent-red/50 bg-[#101010] p-5 shadow-[0_0_60px_rgba(230,50,34,0.18)]">
        <div className="flex items-center justify-between gap-3">
          <p className="label-cap text-[10px] text-accent-red">PROGRAMME SETUP</p>
          <p className="label-cap text-[9px] text-grit-dim">
            {activeStep + 1} OF {rows.length}
          </p>
        </div>
        <h2 className="display mt-1 text-3xl font-extrabold uppercase leading-none text-white">
          Set every working weight
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-grit-dim">
          One exercise at a time. Repeated exercises use this same load everywhere they appear.
          Recent loads are prefilled where possible.
        </p>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#242424]">
          <div
            className="h-full rounded-full bg-accent-red transition-all"
            style={{ width: `${((activeStep + 1) / rows.length) * 100}%` }}
          />
        </div>

        <form
          className="mt-5 space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const display = Number(data.get("weight"));
            if (!Number.isFinite(display) || display <= 0) {
              setError(`Enter a weight above 0 ${unit} for ${row.name}. Decimals are allowed.`);
              return;
            }
            answers.current.set(row.exerciseId, toKg(display, unit));
            setError(null);
            if (activeStep < rows.length - 1) {
              setStep(activeStep + 1);
              return;
            }
            const values = new Map(answers.current);
            set((current) => {
              const schedule = current.schedule
                ? (Object.fromEntries(
                    (Object.keys(current.schedule) as DayKey[]).map((day) => {
                      const plan = current.schedule![day];
                      const exerciseConfig = { ...(plan.exerciseConfig ?? {}) };
                      for (const exerciseId of plan.exerciseIds) {
                        const weightKg = values.get(exerciseId);
                        if (weightKg == null) continue;
                        exerciseConfig[exerciseId] = {
                          ...(exerciseConfig[exerciseId] ?? {}),
                          weightKg,
                        };
                      }
                      return [day, { ...plan, exerciseConfig }];
                    }),
                  ) as Schedule)
                : current.schedule;
              const programs = current.programs.map((program) => {
                if (program.id !== current.activeProgramId) return program;
                const days = { ...program.days };
                for (const day of Object.keys(days) as DayKey[]) {
                  days[day] = {
                    ...days[day],
                    items: days[day].items.map((item) => {
                      const weightKg = values.get(item.id);
                      return weightKg == null ? item : { ...item, weightKg };
                    }),
                  };
                }
                return { ...program, days };
              });
              return { ...current, schedule, programs };
            });
            answers.current.clear();
            setStep(0);
          }}
        >
          <label className="block rounded-2xl border border-grit bg-[#080808] p-5">
            <span className="display block text-xl font-extrabold uppercase text-white">
              {row.name}
            </span>
            <span className="mt-1 block text-[10px] text-grit-dim">
              {row.days.map((day) => DAY_LABEL[day]).join(" · ")}
              {row.days.length > 1 ? " · one weight will fill every repeat" : ""}
            </span>
            <span className="mt-5 flex items-center gap-2">
              <input
                key={row.key}
                name="weight"
                autoFocus
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                defaultValue={trimNumber(
                  toDisplay(answers.current.get(row.exerciseId) ?? row.weightKg, unit),
                )}
                placeholder={`Weight in ${unit}`}
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
