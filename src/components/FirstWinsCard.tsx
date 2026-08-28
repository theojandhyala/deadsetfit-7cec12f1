import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, CheckCircle2, ChevronDown, ChevronRight, Circle, X } from "lucide-react";

import { getFirstWinSteps, type FirstWinId } from "@/lib/first-wins";
import { useAppState } from "@/lib/storage";

const DISMISSED_KEY = "deadset_first_wins_dismissed_v1";

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* Dismissal is optional when storage is unavailable. */
  }
}

function StepLink({
  id,
  className,
  children,
}: {
  id: FirstWinId;
  className: string;
  children: React.ReactNode;
}) {
  if (id === "PLAN")
    return (
      <Link to="/plan" className={className}>
        {children}
      </Link>
    );
  if (id === "WORKOUT") {
    return (
      <Link to="/workout/live" search={{}} className={className}>
        {children}
      </Link>
    );
  }
  if (id === "NUTRITION")
    return (
      <Link to="/diet" className={className}>
        {children}
      </Link>
    );
  return (
    <Link to="/progress" hash="progress-body" className={className}>
      {children}
    </Link>
  );
}

export function FirstWinsCard() {
  const [state] = useAppState();
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(wasDismissed);
  const steps = getFirstWinSteps(state);
  const completed = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);

  if (hidden || !next) return null;

  return (
    <section className="deadset-section" aria-labelledby="first-wins-title">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111214] shadow-[0_16px_40px_rgba(0,0,0,.28)]">
        <div className="flex items-start gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-red/12 text-accent-red">
            <CheckCircle2 size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="deadset-kicker">First wins</p>
            <h2
              id="first-wins-title"
              className="display mt-1 text-xl font-black uppercase text-grit"
            >
              Build your baseline
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-grit-dim">
              {completed} of {steps.length} complete. Finish these once and DEADSET becomes much
              more useful.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              dismiss();
              setHidden(true);
            }}
            aria-label="Dismiss getting started checklist"
            className="grid h-11 w-11 shrink-0 place-items-center text-grit-dim"
          >
            <X size={17} />
          </button>
        </div>

        <div className="h-1 bg-white/[0.06]" aria-hidden="true">
          <div
            className="h-full bg-accent-red transition-[width] duration-300"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-4 pt-3">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent-red/35 bg-accent-red/10 text-xs font-black text-accent-red">
              {completed + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-grit">{next.title}</p>
              <p className="mt-0.5 truncate text-[11px] text-grit-dim">{next.detail}</p>
            </div>
          </div>
          <StepLink
            id={next.id}
            className="btn-grit mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-xs"
          >
            {next.action}
            <ChevronRight size={15} />
          </StepLink>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-[10px] font-black uppercase text-grit-dim"
          >
            {expanded ? "Hide checklist" : "See all steps"}
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {expanded && (
          <div className="deadset-view-switch border-t border-white/10 px-4 pb-3">
            {steps.map((step) => (
              <StepLink
                key={step.id}
                id={step.id}
                className="flex min-h-14 items-center gap-3 border-b border-white/[0.07] py-2 last:border-0"
              >
                {step.done ? (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-400/12 text-emerald-400">
                    <Check size={14} />
                  </span>
                ) : (
                  <span className="grid h-7 w-7 shrink-0 place-items-center text-grit-dim">
                    <Circle size={17} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-xs font-bold ${step.done ? "text-grit-dim" : "text-grit"}`}
                  >
                    {step.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-grit-dim">
                    {step.detail}
                  </span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-grit-dim" />
              </StepLink>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
