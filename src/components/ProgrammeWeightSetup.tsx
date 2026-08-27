import { Dumbbell } from "lucide-react";
import { useMemo } from "react";

import { getExercise } from "@/lib/exercises";
import { requiresWorkingWeight } from "@/lib/workout-flow";
import { trackingModeFor } from "@/lib/set-tracking";
import { increment, toDisplay, toKg, trimNumber, unitOf } from "@/lib/units";
import { useAppState } from "@/lib/storage";
import type { DayKey, Schedule } from "@/lib/types";

type WeightRow = {
  key: string;
  source: "schedule" | "program";
  day: DayKey;
  exerciseId: string;
  name: string;
  weightKg: number;
  programId?: string;
  programIndex?: number;
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
  const unit = unitOf(state);
  const rows = useMemo<WeightRow[]>(() => {
    const result: WeightRow[] = [];
    const historyWeight = (exerciseId: string) => {
      const sessions = [...state.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      for (const session of sessions) {
        const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
        const weighted = [...(exercise?.sets ?? [])].reverse().find((set) => set.weight > 0);
        if (weighted) return weighted.weight;
      }
      return 0;
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
          result.push({
            key: `schedule:${day}:${exerciseId}`,
            source: "schedule",
            day,
            exerciseId,
            name: exercise.name,
            weightKg: historyWeight(exerciseId),
          });
        }
      }
    }

    const active = state.programs.find((program) => program.id === state.activeProgramId);
    if (active) {
      for (const day of Object.keys(active.days) as DayKey[]) {
        active.days[day].items.forEach((item, index) => {
          const definition = getExercise(item.id, state.savedExercises);
          const tracking = trackingModeFor(definition ?? { name: item.name }, item.reps);
          if (!requiresWorkingWeight({ tracking }, definition?.equipment ?? item.equipment)) return;
          if ((item.weightKg ?? 0) > 0) return;
          result.push({
            key: `program:${active.id}:${day}:${index}`,
            source: "program",
            day,
            exerciseId: item.id,
            name: item.name,
            weightKg: historyWeight(item.id),
            programId: active.id,
            programIndex: index,
          });
        });
      }
    }
    return result;
  }, [state]);

  if (!state.profile || rows.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/90 px-5 py-8 backdrop-blur-sm"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto max-w-md rounded-3xl border border-accent-red/50 bg-[#101010] p-5 shadow-[0_0_60px_rgba(230,50,34,0.18)]">
        <p className="label-cap text-[10px] text-accent-red">FINISH YOUR PROGRAMME</p>
        <h2 className="display mt-1 text-3xl font-extrabold uppercase leading-none text-white">
          Set every working weight
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-grit-dim">
          DEADSET uses these loads to prepare every workout. Your completed weight and reps—not
          these estimates—update the strength map and muscle rankings.
        </p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const values = new Map<string, number>();
            for (const row of rows) {
              const display = Number(data.get(row.key));
              if (!Number.isFinite(display) || display <= 0) return;
              values.set(row.key, toKg(display, unit));
            }
            set((current) => {
              const schedule = current.schedule
                ? (Object.fromEntries(
                    (Object.keys(current.schedule) as DayKey[]).map((day) => {
                      const plan = current.schedule![day];
                      const additions = rows.filter(
                        (row) => row.source === "schedule" && row.day === day,
                      );
                      const exerciseConfig = { ...(plan.exerciseConfig ?? {}) };
                      for (const row of additions) {
                        exerciseConfig[row.exerciseId] = {
                          ...(exerciseConfig[row.exerciseId] ?? {}),
                          weightKg: values.get(row.key),
                        };
                      }
                      return [day, { ...plan, exerciseConfig }];
                    }),
                  ) as Schedule)
                : current.schedule;
              const programs = current.programs.map((program) => {
                const additions = rows.filter(
                  (row) => row.source === "program" && row.programId === program.id,
                );
                if (!additions.length) return program;
                const days = { ...program.days };
                for (const day of Object.keys(days) as DayKey[]) {
                  days[day] = {
                    ...days[day],
                    items: days[day].items.map((item, index) => {
                      const row = additions.find(
                        (candidate) => candidate.day === day && candidate.programIndex === index,
                      );
                      return row ? { ...item, weightKg: values.get(row.key) } : item;
                    }),
                  };
                }
                return { ...program, days };
              });
              return { ...current, schedule, programs };
            });
          }}
        >
          {rows.map((row) => (
            <label key={row.key} className="block rounded-2xl border border-grit bg-[#080808] p-4">
              <span className="flex items-baseline justify-between gap-3">
                <span className="display text-base font-extrabold uppercase text-white">
                  {row.name}
                </span>
                <span className="label-cap text-[8px] text-grit-dim">{DAY_LABEL[row.day]}</span>
              </span>
              <span className="mt-3 flex items-center gap-2">
                <input
                  name={row.key}
                  type="number"
                  inputMode="decimal"
                  min={increment(unit)}
                  step={increment(unit)}
                  required
                  defaultValue={
                    row.weightKg > 0 ? trimNumber(toDisplay(row.weightKg, unit)) : undefined
                  }
                  placeholder="Working weight"
                  className="min-h-12 min-w-0 flex-1 rounded-xl border border-grit bg-black px-4 text-xl font-black tabular-nums text-white outline-none focus:border-accent-red"
                />
                <span className="display w-8 text-sm font-extrabold uppercase text-grit-dim">
                  {unit}
                </span>
              </span>
            </label>
          ))}
          <button
            type="submit"
            className="btn-grit flex min-h-14 w-full items-center justify-center rounded-2xl"
          >
            <Dumbbell size={17} className="mr-2" />
            Save weights
          </button>
        </form>
      </div>
    </div>
  );
}
