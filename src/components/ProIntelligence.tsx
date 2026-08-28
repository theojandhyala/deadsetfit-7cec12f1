import { useMemo } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Scale,
  Target,
  ShieldCheck,
} from "lucide-react";
import type { AppState } from "@/lib/types";
import {
  weeklyVolume,
  volumeZoneMeta,
  plateaus,
  trajectories,
  muscleBalance,
} from "@/lib/pro-intelligence";
import { ProBadge } from "@/components/ProBadge";
import { useUnit } from "@/hooks/useUnit";

const MUSCLE_LABEL: Record<string, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  ARMS: "Arms",
  LEGS: "Legs",
  CORE: "Core",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SectionTitle({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Activity;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <Icon size={16} className="text-pro mt-0.5 shrink-0" />
      <div>
        <p className="display text-base font-extrabold uppercase text-grit leading-none">{title}</p>
        <p className="text-[11px] text-grit-dim mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

export function ProIntelligence({ state }: { state: AppState }) {
  const unit = useUnit();
  // Stable within a mount — a raw Date.now() would change every render and
  // defeat the memoization below (three full passes over history per render).
  const now = useMemo(() => Date.now(), []);
  const volume = useMemo(() => weeklyVolume(state, now), [state, now]);
  const stalls = useMemo(() => plateaus(state, 3, now), [state, now]);
  const traj = useMemo(() => trajectories(state, now), [state, now]);
  const balance = useMemo(() => muscleBalance(state, now), [state, now]);

  const hasHistory = (state.sessions ?? []).some((s) => s.endedAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="label-cap text-pro">DEADSET Intelligence</p>
        <ProBadge size="sm" />
      </div>

      {!hasHistory && (
        <div className="bg-grit-card border border-grit p-6 text-center rounded-2xl">
          <p className="text-sm text-grit-dim">
            Log a few sessions and your personal intelligence report builds itself.
          </p>
        </div>
      )}

      {/* 1. Volume Optimizer */}
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <SectionTitle
          icon={Activity}
          title="Volume Optimizer"
          sub="Weekly sets per muscle vs your science-based growth landmarks"
        />
        <div className="flex flex-col gap-3 mt-1">
          {volume.map((v) => {
            const meta = volumeZoneMeta(v.zone);
            const scaleMax = Math.max(v.landmark.mrv, v.sets, 1);
            const pct = (n: number) => `${Math.min(100, (n / scaleMax) * 100)}%`;
            return (
              <div key={v.muscle}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-grit">
                    {MUSCLE_LABEL[v.muscle]}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: meta.color }}>
                    {v.sets} sets · {meta.label}
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-[#0a0a0a] overflow-hidden">
                  {/* optimal band (MAV→MRV) marker */}
                  <div
                    className="absolute inset-y-0 opacity-25"
                    style={{
                      left: pct(v.landmark.mav),
                      right: `calc(100% - ${pct(v.landmark.mrv)})`,
                      background: "#22c55e",
                    }}
                  />
                  <div
                    className="absolute inset-y-0 rounded-full"
                    style={{ width: pct(v.sets), background: meta.color }}
                  />
                </div>
                <p className="text-[11px] text-grit-dim mt-1">{v.advice}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Plateau Breaker */}
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <SectionTitle
          icon={AlertTriangle}
          title="Plateau Breaker"
          sub="Stalled lifts and exactly how to break through"
        />
        {stalls.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-grit mt-1">
            <ShieldCheck size={15} className="text-[#22c55e]" />
            <span>No plateaus detected — every tracked lift is still climbing.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-1">
            {stalls.slice(0, 4).map((p) => (
              <div
                key={p.exerciseId}
                className="rounded-xl border border-[#3a1a10] bg-[#180d0a] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="display font-extrabold uppercase text-grit text-sm">
                    {p.name}
                  </span>
                  <span className="text-[10px] font-bold text-accent-red uppercase">
                    Stalled {p.stalledSessions} sessions
                  </span>
                </div>
                <p className="text-[12px] text-[#c9b8a8] mt-1 leading-relaxed">{p.prescription}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Strength Trajectory */}
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <SectionTitle
          icon={Target}
          title="Strength Trajectory"
          sub="Estimated-1RM trend and your projected milestone dates"
        />
        {traj.length === 0 ? (
          <p className="text-sm text-grit-dim mt-1">
            Log 3+ sessions of a lift to project its trajectory.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5 mt-1">
            {traj.slice(0, 6).map((t) => {
              const TrendIcon =
                t.trend === "up" ? TrendingUp : t.trend === "down" ? TrendingDown : Minus;
              const color =
                t.trend === "up" ? "#22c55e" : t.trend === "down" ? "#e63222" : "#8a8a8a";
              return (
                <div key={t.exerciseId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-grit truncate">{t.name}</p>
                    <p className="text-[11px] text-grit-dim">
                      {t.trend === "up" && t.nextMilestone && t.etaDate
                        ? `On track for ${t.nextMilestone}kg ~${fmtDate(t.etaDate)}`
                        : t.trend === "up"
                          ? "Climbing steadily"
                          : t.trend === "down"
                            ? "Trending down — check Plateau Breaker"
                            : "Holding steady"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="display text-lg font-extrabold tabular-nums text-grit leading-none">
                      {t.currentE1rm}
                      <span className="text-[10px] text-grit-dim ml-0.5">kg e1RM</span>
                    </p>
                    <p
                      className="text-[11px] font-bold inline-flex items-center gap-0.5 justify-end"
                      style={{ color }}
                    >
                      <TrendIcon size={11} />
                      {t.perWeek > 0 ? "+" : ""}
                      {t.perWeek}
                      {unit}/wk
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Muscle Balance */}
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <SectionTitle
          icon={Scale}
          title="Muscle Balance"
          sub="Push, pull and lower-body volume balance from your last 4 weeks"
        />
        {!balance.hasData ? (
          <p className="text-sm text-grit-dim mt-1">Train a bit more to assess your balance.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="display text-3xl font-extrabold tabular-nums"
                style={{
                  color:
                    balance.score >= 80 ? "#22c55e" : balance.score >= 55 ? "#f59e0b" : "#e63222",
                }}
              >
                {balance.score}
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-grit">Balance score</p>
                <p className="text-[11px] text-grit-dim">
                  {balance.score >= 80
                    ? "Your recent training volume is well balanced."
                    : balance.score >= 55
                      ? "A small volume imbalance is worth addressing."
                      : "Your recent volume is notably uneven."}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {balance.ratios.map((r) => (
                <div key={r.key} className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-grit">{r.label}</span>
                    <span className="text-[11px] text-grit-dim ml-2">{r.ratio}:1</span>
                  </div>
                  <span
                    className="text-[11px] text-right max-w-[62%]"
                    style={{ color: r.status === "balanced" ? "#22c55e" : "#f59e0b" }}
                  >
                    {r.advice}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
