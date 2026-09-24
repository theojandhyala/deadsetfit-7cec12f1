import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, Clock3, Pin, ShieldCheck, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

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
  const [priority, setPriority] = useState<string>();
  const openingPaywall = useRef(false);
  const { isPro, loading } = usePro();
  const choices = useMemo(
    () => [...new Map(exercises.map((item) => [item.exerciseId, item])).values()],
    [exercises],
  );
  const validPriority = choices.some((item) => item.exerciseId === priority) ? priority : undefined;
  const originalMinutes = useMemo(() => estimateWorkoutMinutes(exercises), [exercises]);
  const plan = useMemo(
    () => buildTimeBudgetPlan(exercises, budget, validPriority),
    [exercises, budget, validPriority],
  );
  const reducedByPosition = new Map(plan.reduced.map((item) => [item.position, item]));
  const overBudget = plan.estimatedMinutes > budget;

  if (exercises.length === 0) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          onClick={() => {
            hapticSelection();
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
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/90 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            if (openingPaywall.current) {
              event.preventDefault();
              openingPaywall.current = false;
              openPaywall("time-fit");
            }
          }}
          className="fixed inset-x-0 bottom-0 z-[151] mx-auto flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] border border-white/12 bg-[#0d0e10] shadow-[0_-28px_80px_rgba(0,0,0,.75)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=open]:duration-200 motion-reduce:animate-none"
        >
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
            <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-white/15" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label-cap text-[9px] text-accent-red">DEADSET PRO · TIME FIT</p>
                <Dialog.Title className="display mt-1 text-3xl font-black uppercase leading-none text-grit">
                  Make the session fit
                </Dialog.Title>
                <Dialog.Description className="mt-2 max-w-sm text-xs leading-relaxed text-grit-dim">
                  A one-session adaptation. Your programme, weights and next workout stay untouched.
                </Dialog.Description>
                <p className="mt-2 text-[10px] leading-relaxed text-grit-dim">
                  Estimated work and rest time. Allow extra for warm-ups and busy equipment.
                </p>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="icon-btn min-h-11 min-w-11 shrink-0 text-grit-dim"
                  aria-label="Close Time Fit"
                >
                  <X size={19} />
                </button>
              </Dialog.Close>
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

            <details className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] p-3">
              <summary className="min-h-11 cursor-pointer text-xs font-bold text-grit">
                <span className="inline-flex items-center gap-2">
                  <Pin size={14} className="text-accent-red" />
                  {validPriority ? "Must-keep exercise selected" : "Choose a must-keep exercise"}
                </span>
                <span className="mt-1 block text-[10px] font-normal text-grit-dim">
                  Optional · its superset partners stay too
                </span>
              </summary>
              <div className="mt-2 grid gap-2" role="group" aria-label="Must-keep exercise">
                {[
                  { exerciseId: undefined, name: "Automatic · follow programme order" },
                  ...choices,
                ].map((item) => (
                  <button
                    key={item.exerciseId ?? "automatic"}
                    type="button"
                    aria-pressed={validPriority === item.exerciseId}
                    onClick={() => {
                      hapticSelection();
                      setPriority(item.exerciseId);
                    }}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs ${validPriority === item.exerciseId ? "border-accent-red/70 bg-accent-red/10 text-grit" : "border-white/10 text-grit-dim"}`}
                  >
                    <span className="min-w-0 flex-1 break-words">{item.name}</span>
                    {validPriority === item.exerciseId && (
                      <Check size={15} className="shrink-0 text-accent-red" />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-grit-dim">
                Repeat occurrences stay together. Sets can reduce; weights and exercise order do not
                change.
              </p>
            </details>

            <div
              aria-live="polite"
              aria-atomic="true"
              className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10"
            >
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
                  const change = reducedByPosition.get(index);
                  return (
                    <li
                      key={`${exercise.exerciseId}-${index}`}
                      className="flex min-h-11 items-center gap-2 py-2"
                    >
                      {exercise.exerciseId === validPriority ? (
                        <Pin
                          size={14}
                          className="shrink-0 text-accent-red"
                          aria-label="Must keep"
                        />
                      ) : (
                        <Check size={14} className="shrink-0 text-emerald-400" />
                      )}
                      <span className="min-w-0 flex-1 break-words text-xs font-bold text-grit">
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

            {overBudget && (
              <p
                className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-xs text-amber-200"
                role="status"
              >
                Even one round of the retained movements needs about {plan.estimatedMinutes}{" "}
                minutes. Choose more time or edit the session; this plan exceeds your {budget}
                -minute target.
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[.035] px-3 py-2.5">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
              <p className="text-[10px] leading-relaxed text-grit-dim">
                No silent edits. Starting this version changes only the new live session; tomorrow's
                saved plan remains complete.
              </p>
            </div>
          </div>
          <div className="shrink-0 border-t border-white/10 bg-[#0d0e10] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <p className="mb-2 text-center text-[10px] text-grit-dim">
              ≈{plan.estimatedMinutes} min · {Math.max(0, originalMinutes - plan.estimatedMinutes)}{" "}
              min saved{overBudget ? " · exceeds chosen time" : ""}
            </p>
            {isPro && !loading ? (
              <Link
                to="/workout/live"
                search={{ day, source, budget, priority: validPriority }}
                onClick={hapticWorkoutStart}
                className="btn-grit flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm"
              >
                <Sparkles size={17} />{" "}
                {overBudget
                  ? `Start ≈${plan.estimatedMinutes}-min workout`
                  : `Start ${budget}-minute workout`}
              </Link>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  openingPaywall.current = true;
                  setOpen(false);
                }}
                className="btn-grit flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-sm disabled:opacity-60"
              >
                <Sparkles size={17} /> {loading ? "Checking Pro…" : "Unlock Time Fit"}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
