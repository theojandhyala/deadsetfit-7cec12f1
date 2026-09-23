import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Clock3, ShieldCheck, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

import { usePro } from "@/hooks/usePro";
import { hapticSelection, hapticWorkoutStart } from "@/lib/haptics";
import { openPaywall } from "@/lib/paywall-events";
import {
  buildTimeBudgetPlan,
  estimateWorkoutMinutes,
  type TimeBudgetExercise,
  type WorkoutTimeBudget,
} from "@/lib/time-budget-workout";
import type { DayKey } from "@/lib/types";

const BUDGETS: WorkoutTimeBudget[] = [20, 30, 45];

export function TimeFitPlanner({
  exercises,
  day,
  source,
}: {
  exercises: TimeBudgetExercise[];
  day: DayKey;
  source: "program" | "schedule";
}) {
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState<WorkoutTimeBudget>(30);
  const { isPro, loading } = usePro();
  const originalMinutes = useMemo(() => estimateWorkoutMinutes(exercises), [exercises]);
  const plan = useMemo(() => buildTimeBudgetPlan(exercises, budget), [exercises, budget]);

  if (exercises.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticSelection();
          setOpen(true);
        }}
        className="press mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-accent-red/30 bg-[linear-gradient(110deg,rgba(230,50,34,.14),rgba(255,255,255,.025))] px-3.5 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-red/15 text-accent-red">
          <Clock3 size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="display block text-base font-black uppercase leading-none text-grit">
            Short on time?
          </span>
          <span className="mt-1 block text-[10px] font-semibold text-grit-dim">
            Fit this ≈{originalMinutes} min session into 20, 30 or 45
          </span>
        </span>
        <ArrowRight size={17} className="shrink-0 text-accent-red" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="time-fit-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/90"
            onClick={() => setOpen(false)}
            aria-label="Close Time Fit"
          />
          <div className="deadset-sheet-enter no-scrollbar relative max-h-[92dvh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-t-[1.75rem] border border-white/12 bg-[#0d0e10] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-28px_80px_rgba(0,0,0,.75)]">
            <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-white/15" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-cap text-[9px] text-accent-red">DEADSET PRO · TIME FIT</p>
                <h2
                  id="time-fit-title"
                  className="display mt-1 text-3xl font-black uppercase leading-none text-grit"
                >
                  Make the session fit
                </h2>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-grit-dim">
                  A one-session adaptation. Your programme, weights and next workout stay untouched.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="icon-btn shrink-0 text-grit-dim"
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Choose available workout time">
              {BUDGETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={budget === value}
                  onClick={() => {
                    hapticSelection();
                    setBudget(value);
                  }}
                  className={`min-h-14 rounded-xl border text-center transition-colors ${
                    budget === value
                      ? "border-accent-red bg-accent-red text-white"
                      : "border-white/10 bg-white/[.035] text-grit"
                  }`}
                >
                  <span className="display block text-xl font-black leading-none">{value}</span>
                  <span className="mt-1 block text-[8px] font-black uppercase tracking-[.15em]">
                    minutes
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              <Metric value={`≈${plan.estimatedMinutes}`} label="Planned min" />
              <Metric value={String(plan.exercises.length)} label="Movements" />
              <Metric
                value={String(
                  plan.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0),
                )}
                label="Work sets"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="label-cap text-[9px] text-grit-dim">What stays</p>
                <p className="text-[9px] font-black uppercase text-emerald-400">Order preserved</p>
              </div>
              <ol className="mt-2.5 divide-y divide-white/[.065]">
                {plan.exercises.map((exercise, index) => {
                  const change = plan.reduced.find(
                    (item) => item.exerciseId === exercise.exerciseId,
                  );
                  return (
                    <li
                      key={`${exercise.exerciseId}-${index}`}
                      className="flex min-h-11 items-center gap-2 py-2"
                    >
                      <Check size={14} className="shrink-0 text-emerald-400" />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-grit">
                        {exercise.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-black text-grit-dim">
                        {change ? `${change.from} → ${change.to}` : exercise.targetSets} sets
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {plan.omitted.length > 0 && (
              <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[.045] p-3.5">
                <p className="label-cap text-[9px] text-amber-300">Moved out of today only</p>
                <p className="mt-1 text-[11px] leading-relaxed text-grit-dim">
                  {plan.omitted.map((exercise) => exercise.name).join(" · ")}
                </p>
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[.035] px-3 py-2.5">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
              <p className="text-[10px] leading-relaxed text-grit-dim">
                No silent edits. Starting this version changes only the new live session; tomorrow's
                saved plan remains complete.
              </p>
            </div>

            {isPro && !loading ? (
              <Link
                to="/workout/live"
                search={{ day, source, budget }}
                onClick={hapticWorkoutStart}
                className="btn-grit mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm"
              >
                <Sparkles size={17} /> Start {budget}-minute workout
              </Link>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => openPaywall("time-fit")}
                className="btn-grit mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm disabled:opacity-60"
              >
                <Sparkles size={17} /> {loading ? "Checking Pro…" : "Unlock Time Fit"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#121315] px-2 py-3 text-center">
      <p className="display text-xl font-black text-grit">{value}</p>
      <p className="mt-1 text-[8px] font-black uppercase tracking-[.13em] text-grit-dim">{label}</p>
    </div>
  );
}
