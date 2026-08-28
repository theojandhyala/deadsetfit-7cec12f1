import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Dumbbell, Grid3X3, TrendingUp } from "lucide-react";

import { MuscleDiagram } from "@/components/MuscleDiagram";
import { hapticSelection } from "@/lib/haptics";
import { useAppState } from "@/lib/storage";
import { increment, snapToLoadable, toDisplay, unitOf } from "@/lib/units";
import type { FocusMuscle } from "@/lib/types";

const STEPS = [
  {
    icon: Grid3X3,
    label: "Plan",
    title: "Sets create the pattern",
    body: "Every exercise adds working sets to its muscle squares. Missing areas stay grey so gaps are obvious.",
  },
  {
    icon: Dumbbell,
    label: "Lift",
    title: "Log the weight you really used",
    body: "Complete the target reps with clean form. DEADSET remembers the load, reps and effort for that movement.",
  },
  {
    icon: TrendingUp,
    label: "Grow",
    title: "Earn the next load",
    body: "Hit every set and the next workout moves up. Miss the target and the app tells you to hold the weight—not guess.",
  },
] as const;

const DIAGRAM_LABEL: Record<FocusMuscle, string[]> = {
  CHEST: ["chest"],
  BACK: ["back", "lats"],
  SHOULDERS: ["shoulders", "delts"],
  ARMS: ["arms", "biceps", "triceps"],
  LEGS: ["legs", "quads", "hamstrings", "glutes"],
  CORE: ["core", "abs", "obliques"],
};

const BACK_VIEW = new Set<FocusMuscle>(["BACK"]);

/**
 * The load the walkthrough uses as its example, in kilograms.
 *
 * Snapped to what the athlete's own gym can actually load, so a pound gym is
 * shown 135 lb rather than a converted 132.3 — and never a kilogram figure in
 * an app that just asked them for pounds.
 */
const EXAMPLE_KG = 60;

export function StrengthEngineTutorial({ focus }: { focus?: FocusMuscle }) {
  const [state] = useAppState();
  const unit = unitOf(state);
  // Stepped in display space: `increment` is 2.5 kg or 5 lb, so adding it to a
  // kilogram value would step a pound gym by 5 kg.
  const exampleValue = toDisplay(snapToLoadable(EXAMPLE_KG, unit), unit);
  const exampleLabel = `${exampleValue} ${unit.toUpperCase()}`;
  const nextLabel = `${exampleValue + increment(unit)} ${unit.toUpperCase()}`;
  const [step, setStep] = useState(0);
  const muscle = focus ?? "CHEST";
  const active = STEPS[step]!;
  const Icon = active.icon;
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setInterval(
      () => setStep((current) => (current + 1) % STEPS.length),
      2400,
    );
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  function select(next: number) {
    if (next === step) return;
    setStep(next);
    hapticSelection();
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-accent-red/35 bg-[#111214]">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="label-cap text-[8px] text-accent-red">HOW YOUR STRENGTH MAP GROWS</p>
        <p className="display mt-0.5 text-lg font-black uppercase text-grit">
          Plan → lift → progress
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-3 px-4 py-4">
        <div key={step} className="deadset-plan-reveal min-w-0">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-red text-black">
            <Icon size={17} strokeWidth={2.6} />
          </span>
          <p className="display mt-3 text-lg font-black uppercase leading-tight text-grit">
            {active.title}
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-grit-dim">{active.body}</p>
          {step === 0 && (
            <div className="mt-3 flex gap-1" aria-label="Example planned sets">
              {[1, 2, 3, 4, 5, 6].map((square) => (
                <span
                  key={square}
                  className="grid h-6 w-6 place-items-center rounded-[4px] bg-accent-red/70 text-[7px] font-black text-white"
                >
                  {square}
                </span>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-grit">
              <span className="rounded-md border border-white/10 bg-black/35 px-2 py-1.5">
                {exampleLabel}
              </span>
              <span>×</span>
              <span className="rounded-md border border-white/10 bg-black/35 px-2 py-1.5">
                10 REPS
              </span>
              <Check size={14} className="text-emerald-400" />
            </div>
          )}
          {step === 2 && (
            <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-grit">
              <span className="text-grit-dim">{exampleLabel}</span>
              <ChevronRight size={14} className="text-accent-red" />
              <span className="rounded-md bg-accent-red px-2 py-1.5 text-black">
                {nextLabel} NEXT
              </span>
            </div>
          )}
        </div>
        <div className="relative">
          <MuscleDiagram
            view={BACK_VIEW.has(muscle) ? "back" : "front"}
            primary={step === 0 ? [] : DIAGRAM_LABEL[muscle]}
            size={162}
          />
          <span className="label-cap absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[6px] text-grit-dim">
            EXAMPLE · {muscle}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-white/10">
        {STEPS.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => select(index)}
            aria-pressed={index === step}
            className={`min-h-11 border-r border-white/10 text-[8px] font-black uppercase tracking-[0.08em] last:border-r-0 press ${
              index === step ? "bg-accent-red text-black" : "text-grit-dim"
            }`}
          >
            {index + 1} · {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
