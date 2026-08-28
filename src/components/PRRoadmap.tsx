import { useMemo, useRef } from "react";
import { Check, Flag, Lock, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { usePro } from "@/hooks/usePro";
import { liftSeriesAll, strengthGoalRoadmaps } from "@/lib/pro-intelligence";
import { openPaywall } from "@/lib/paywall-events";
import { useAppState } from "@/lib/storage";
import { useUnit } from "@/hooks/useUnit";
import { formatWeightValue, toKg } from "@/lib/units";

export function PRRoadmap() {
  const [state, setState] = useAppState();
  const unit = useUnit();
  const { isPro, loading } = usePro();
  const locked = loading || !isPro;
  const exerciseRef = useRef<HTMLSelectElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const tracked = useMemo(() => liftSeriesAll(state, 1), [state]);
  const goals = useMemo(() => strengthGoalRoadmaps(state), [state]);

  if (tracked.length === 0) return null;

  const addGoal = () => {
    if (locked) {
      openPaywall("pr-roadmap");
      return;
    }
    const exerciseId = exerciseRef.current?.value;
    // Typed in the athlete's units; targets are stored in kilograms with
    // every other weight.
    const targetKg = toKg(Number(targetRef.current?.value), unit);
    const lift = tracked.find((item) => item.exerciseId === exerciseId);
    const currentKg = lift?.points[lift.points.length - 1]?.e1rm ?? 0;
    if (!exerciseId || !Number.isFinite(targetKg) || targetKg <= currentKg) {
      toast.error(
        `Set a target above your current ${formatWeightValue(currentKg, unit)}${unit} estimated max.`,
      );
      return;
    }
    setState((current) => ({
      ...current,
      strengthGoals: [
        ...(current.strengthGoals ?? []).filter((goal) => goal.exerciseId !== exerciseId),
        { exerciseId, targetKg, createdAt: new Date().toISOString() },
      ],
    }));
    if (targetRef.current) targetRef.current.value = "";
    toast.success("PR target added to your roadmap.");
  };

  return (
    <section className="px-5 mb-6">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="label-cap flex items-center gap-1.5 text-[9px] text-pro">
            <Flag size={11} /> PRO
          </p>
          <h2 className="display text-xl font-black uppercase text-grit">PR Roadmap</h2>
        </div>
        <p className="max-w-[155px] text-right text-[9px] leading-snug text-grit-dim">
          Set a target e1RM. DEADSET tracks the gap and projects the date.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-grit-card p-4">
        <div
          className={locked ? "pointer-events-none select-none blur-[5px] opacity-55" : undefined}
        >
          <div className="grid grid-cols-[1fr_88px_44px] gap-2">
            <select ref={exerciseRef} className="input-grit min-w-0" aria-label="Tracked lift">
              {tracked.map((lift) => (
                <option key={lift.exerciseId} value={lift.exerciseId}>
                  {lift.name}
                </option>
              ))}
            </select>
            <input
              ref={targetRef}
              className="input-grit min-w-0"
              inputMode="decimal"
              placeholder={`Goal ${unit}`}
              aria-label={`Target estimated one-rep max in ${unit}`}
            />
            <button
              type="button"
              onClick={addGoal}
              className="btn-grit flex min-h-11 items-center justify-center rounded-xl px-0"
              aria-label="Add PR target"
            >
              <Plus size={17} />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {goals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 px-4 py-5 text-center">
                <Target size={18} className="mx-auto text-grit-dim" />
                <p className="mt-2 text-xs font-bold text-grit">Set the number you are chasing</p>
                <p className="mt-1 text-[10px] text-grit-dim">
                  Targets use your best estimated one-rep max from completed sets.
                </p>
              </div>
            ) : (
              goals.map((goal) => (
                <div
                  key={goal.exerciseId}
                  className="rounded-xl border border-white/10 bg-black/30 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-grit">{goal.name}</p>
                      <p className="mt-0.5 text-[9px] text-grit-dim">
                        {goal.currentKg}kg now · {goal.targetKg}kg target
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="display text-xl font-black leading-none"
                        style={{ color: goal.reached ? "#55d98a" : "#f4c33a" }}
                      >
                        {goal.progress}%
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setState((current) => ({
                            ...current,
                            strengthGoals: (current.strengthGoals ?? []).filter(
                              (item) => item.exerciseId !== goal.exerciseId,
                            ),
                          }))
                        }
                        className="grid h-9 w-9 place-items-center rounded-lg text-grit-dim press"
                        aria-label={`Remove ${goal.name} target`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#090909]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${goal.progress}%`,
                        background: goal.reached ? "#55d98a" : "#f4c33a",
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[9px]">
                    <span className="font-bold text-grit">
                      {goal.reached ? (
                        <span className="inline-flex items-center gap-1 text-[#55d98a]">
                          <Check size={10} /> Target reached
                        </span>
                      ) : (
                        `${goal.remainingKg}kg remaining`
                      )}
                    </span>
                    <span className="text-right text-grit-dim">
                      {goal.etaDate
                        ? `Projected ${new Date(goal.etaDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                        : "Log 3+ sessions for an ETA"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {locked && (
          <button
            type="button"
            onClick={() => openPaywall("pr-roadmap")}
            className="absolute inset-0 z-10 flex w-full flex-col items-center justify-center p-6 text-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-pro/40 bg-pro/10 text-pro">
              <Lock size={17} />
            </span>
            <span className="display mt-2 text-xl font-black uppercase text-pro-gradient">
              Put a date on the next PR
            </span>
            <span className="mt-1 max-w-[260px] text-[10px] leading-relaxed text-[#b7ac8e]">
              Set targets for every lift and see the gap, pace and projected milestone date.
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
