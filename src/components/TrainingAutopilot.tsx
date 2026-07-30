import { useMemo } from "react";
import {
  ArrowUp,
  Check,
  Crown,
  Gauge,
  Lock,
  Minus,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { useAppState } from "@/lib/storage";
import {
  applyAutopilotPlan,
  buildAutopilotPlan,
  type AutopilotAction,
  type AutopilotStrategy,
} from "@/lib/training-autopilot";

const STRATEGIES: Array<{ value: AutopilotStrategy; label: string }> = [
  { value: "BALANCED", label: "Balanced" },
  { value: "STRENGTH", label: "Strength" },
  { value: "HYPERTROPHY", label: "Size" },
];

const ACTION_ICON: Record<AutopilotAction, typeof ArrowUp> = {
  INCREASE: ArrowUp,
  HOLD: Minus,
  RESET: RotateCcw,
  BASELINE: Gauge,
};

export function TrainingAutopilot({
  compact = false,
  priority = false,
}: {
  compact?: boolean;
  priority?: boolean;
}) {
  const [state, setState] = useAppState();
  const { isPro, loading } = usePro();
  const strategy = state.trainingAutopilot?.strategy ?? "BALANCED";
  const plan = useMemo(() => buildAutopilotPlan(state, strategy), [state, strategy]);
  const locked = loading || !isPro;
  const actionable = plan.prescriptions.filter(
    (item) => item.prescribedWeightKg > 0 && item.action !== "BASELINE",
  );

  const setStrategy = (next: AutopilotStrategy) => {
    if (locked) {
      openPaywall("autopilot");
      return;
    }
    setState((current) => ({
      ...current,
      trainingAutopilot: {
        ...current.trainingAutopilot,
        enabled: current.trainingAutopilot?.enabled ?? false,
        strategy: next,
      },
    }));
  };

  const apply = () => {
    if (locked) {
      openPaywall("autopilot");
      return;
    }
    if (!state.schedule || actionable.length === 0) {
      toast.info("Complete a weighted session before Autopilot can prescribe new loads.");
      return;
    }
    setState((current) => {
      if (!current.schedule) return current;
      return {
        ...current,
        schedule: applyAutopilotPlan(current.schedule, plan),
        trainingAutopilot: {
          enabled: true,
          strategy,
          lastAppliedAt: new Date().toISOString(),
        },
      };
    });
    toast.success(
      plan.phase === "DELOAD"
        ? "Deload applied to your next sessions."
        : `${actionable.length} next-session loads applied.`,
    );
  };

  return (
    <section
      className={`${compact ? "deadset-section" : "px-5 mb-6"} ${priority ? "order-first" : ""}`}
      aria-labelledby={`autopilot-title-${compact ? "compact" : "full"}`}
    >
      <div
        className="relative overflow-hidden rounded-2xl border p-4"
        style={{
          borderColor: locked ? "rgba(244,195,58,.42)" : "rgba(230,50,34,.4)",
          background: locked
            ? "linear-gradient(145deg, rgba(38,30,11,.96), rgba(13,12,10,.98))"
            : "linear-gradient(145deg, rgba(35,17,15,.96), rgba(11,12,14,.98) 62%)",
          boxShadow: "0 18px 42px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06)",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
            style={{
              color: locked ? "#f4c33a" : "#e63222",
              borderColor: locked ? "rgba(244,195,58,.36)" : "rgba(230,50,34,.42)",
              background: locked ? "rgba(244,195,58,.1)" : "rgba(230,50,34,.12)",
            }}
          >
            <Gauge size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={`label-cap text-[9px] ${locked ? "text-pro" : "text-accent-red"}`}>
                TRAINING AUTOPILOT
              </p>
              {locked ? (
                <span className="pro-chip text-[7px]">PRO</span>
              ) : (
                <span className="flex items-center gap-1 text-[8px] font-black uppercase text-[#55d98a]">
                  <Check size={10} /> Live
                </span>
              )}
            </div>
            <h2
              id={`autopilot-title-${compact ? "compact" : "full"}`}
              className="display mt-1 text-xl font-black uppercase leading-none text-grit"
            >
              {locked ? "Your plan should update itself." : plan.headline}
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-grit-dim">
              {locked
                ? "Automatic loads, stall resets and recovery deloads applied directly to your next workout."
                : plan.explanation}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <AutopilotStat label="PHASE" value={locked ? "AUTO" : plan.phase} />
          <AutopilotStat label="READINESS" value={locked ? "LIVE" : `${plan.readiness}%`} />
          <AutopilotStat
            label="DECISIONS"
            value={locked ? String(Math.max(1, actionable.length)) : String(actionable.length)}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 rounded-xl border border-white/10 bg-black/30 p-1">
          {STRATEGIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStrategy(item.value)}
              className="min-h-9 rounded-lg px-1 text-[9px] font-black uppercase transition"
              style={{
                color: strategy === item.value ? "#fff" : "#8a8a8a",
                background:
                  strategy === item.value
                    ? locked
                      ? "rgba(244,195,58,.18)"
                      : "rgba(230,50,34,.28)"
                    : "transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!locked && plan.prescriptions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {plan.prescriptions.slice(0, compact ? 3 : 6).map((item) => {
              const Icon = ACTION_ICON[item.action];
              return (
                <div
                  key={item.exerciseId}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{
                      color: item.action === "RESET" ? "#f4c33a" : "#e63222",
                      background:
                        item.action === "RESET" ? "rgba(244,195,58,.12)" : "rgba(230,50,34,.12)",
                    }}
                  >
                    <Icon size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-grit">
                      {item.name}
                    </span>
                    <span className="block truncate text-[9px] text-grit-dim">{item.reason}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="display block text-sm font-black text-grit">
                      {item.prescribedWeightKg > 0 ? `${item.prescribedWeightKg}kg` : "LOG"}
                    </span>
                    <span className="block text-[7px] font-black uppercase text-grit-dim">
                      {item.confidence}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={apply}
          className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase ${
            locked ? "border border-pro/40 bg-pro/10 text-pro" : "btn-grit"
          }`}
        >
          {locked ? <Lock size={14} /> : <SlidersHorizontal size={14} />}
          {locked
            ? "Unlock Training Autopilot"
            : actionable.length
              ? `Apply ${actionable.length} decisions to my plan`
              : "Waiting for weighted sessions"}
        </button>

        {locked && (
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[9px] text-grit-dim">
            <Crown size={11} className="text-pro" />
            Non-AI. Your training data and proven progression rules.
          </div>
        )}
      </div>
    </section>
  );
}

function AutopilotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-2">
      <p className="label-cap text-[7px] text-grit-dim">{label}</p>
      <p className="display mt-1 truncate text-sm font-black uppercase text-grit">{value}</p>
    </div>
  );
}
