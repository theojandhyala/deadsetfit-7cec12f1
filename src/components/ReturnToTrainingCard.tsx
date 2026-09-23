import { Link } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";

import { hapticWorkoutStart } from "@/lib/haptics";
import { eligibleReturnGap } from "@/lib/return-to-training";
import type { AppState, DayKey } from "@/lib/types";

export function ReturnToTrainingCard({
  state,
  day,
  source,
  hasWorkout,
}: {
  state: AppState;
  day: DayKey;
  source: "program" | "schedule";
  hasWorkout: boolean;
}) {
  const gap = eligibleReturnGap(state.sessions);
  if (!gap || !hasWorkout) return null;

  return (
    <section className="deadset-section" aria-labelledby="return-training-title">
      <div className="overflow-hidden rounded-[1.35rem] border border-sky-300/25 bg-[linear-gradient(135deg,rgba(56,189,248,.12),rgba(255,255,255,.02))] shadow-[0_16px_44px_rgba(0,0,0,.28)]">
        <div className="flex items-start gap-3 px-4 pb-3 pt-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-sky-300/25 bg-sky-300/10 text-sky-300">
            <RotateCcw size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="label-cap text-[8px] text-sky-300">Return protocol · {gap} day gap</p>
            <h2
              id="return-training-title"
              className="display mt-1 text-2xl font-black uppercase leading-none text-grit"
            >
              Welcome back. Earn the rhythm first.
            </h2>
            <p className="mt-2 text-[11px] leading-relaxed text-grit-dim">
              Start one session with about 10% less planned load, one fewer set on larger
              prescriptions and at least 3 reps in reserve.
            </p>
          </div>
        </div>
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[.035] px-3 py-2.5">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
          <p className="text-[9px] leading-relaxed text-grit-dim">
            This changes today only. Your saved plan and normal working weights stay exactly where
            you left them.
          </p>
        </div>
        <Link
          to="/workout/live"
          search={{ day, source, ramp: "return" }}
          onClick={hapticWorkoutStart}
          className="press flex min-h-[52px] items-center justify-between border-t border-sky-300/20 bg-sky-300/[.055] px-4 text-[10px] font-black uppercase tracking-[.13em] text-sky-300"
        >
          Start comeback session
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
