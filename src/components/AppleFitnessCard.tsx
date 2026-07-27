import { useCallback, useEffect, useState } from "react";
import { Activity, Check, Footprints, HeartPulse, RefreshCw, Route, Watch } from "lucide-react";
import { toast } from "sonner";

import { useAppState } from "@/lib/storage";
import {
  connectHealth,
  getFitnessSummary,
  healthSupported,
  type FitnessSummary,
} from "@/lib/health";

const FALLBACK_GOALS = {
  activeKcal: 500,
  exerciseMinutes: 30,
  standHours: 12,
};

export function AppleFitnessCard() {
  const [state, set] = useAppState();
  const [summary, setSummary] = useState<FitnessSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const health = state.healthSync ?? {
    enabled: false,
    importWorkouts: true,
    exportWorkouts: true,
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await getFitnessSummary();
    setSummary(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (health.enabled) void refresh();
  }, [health.enabled, refresh]);

  if (!healthSupported()) return null;

  async function connect() {
    setLoading(true);
    const granted = await connectHealth();
    if (!granted) {
      setLoading(false);
      toast.error("Health access was not granted. You can allow it in iPhone Settings.");
      return;
    }
    set((current) => ({
      ...current,
      healthSync: {
        importWorkouts: true,
        exportWorkouts: true,
        ...current.healthSync,
        enabled: true,
      },
    }));
    toast.success("Apple Health connected");
    await refresh();
  }

  if (!health.enabled) {
    return (
      <section className="px-5 mb-6 animate-slide-up delay-75">
        <div
          className="deadset-3d-panel overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #181818, #101010)",
            border: "1px solid rgba(255,255,255,0.13)",
            borderRadius: 8,
          }}
        >
          <div className="p-4 flex items-start gap-3">
            <div
              className="w-11 h-11 shrink-0 grid place-items-center"
              style={{ background: "#050505", border: "1px solid #303030", borderRadius: 8 }}
            >
              <Watch size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="label-cap text-[10px] text-accent-red">Apple Fitness</p>
              <h2 className="display text-xl font-extrabold uppercase text-white leading-tight">
                Your whole day counts
              </h2>
              <p className="text-[11px] text-grit-dim leading-relaxed mt-1">
                See steps, rings, distance, heart rate and workouts from iPhone and Apple Watch.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={loading}
            className="btn-grit w-full min-h-12 text-xs disabled:opacity-60"
            style={{ borderRadius: 0 }}
          >
            <Watch size={15} />
            {loading ? "Connecting..." : "Connect Apple Health"}
          </button>
        </div>
      </section>
    );
  }

  const goals = {
    activeKcal: summary?.goals.activeKcal || FALLBACK_GOALS.activeKcal,
    exerciseMinutes: summary?.goals.exerciseMinutes || FALLBACK_GOALS.exerciseMinutes,
    standHours: summary?.goals.standHours || FALLBACK_GOALS.standHours,
  };
  const days = summary?.days ?? [];
  const maxSteps = Math.max(1, ...days.map((day) => day.steps));

  return (
    <section className="px-5 mb-6 animate-slide-up delay-75" aria-label="Apple Fitness">
      <div
        className="deadset-3d-panel p-4"
        style={{
          background: "#111",
          border: "1px solid rgba(255,255,255,0.13)",
          borderRadius: 8,
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
              <Check size={11} strokeWidth={3} /> Apple Health connected
            </p>
            <h2 className="display text-xl font-extrabold uppercase text-white">Daily Fitness</h2>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="w-10 h-10 shrink-0 grid place-items-center border border-[#303030] bg-[#181818] text-white disabled:opacity-50"
            style={{ borderRadius: 8 }}
            title="Refresh Apple Fitness data"
            aria-label="Refresh Apple Fitness data"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {!summary && loading ? (
          <div className="h-52 grid place-items-center text-xs text-grit-dim">
            Reading Apple Fitness...
          </div>
        ) : !summary ? (
          <div className="py-8 text-center">
            <Activity size={24} className="mx-auto text-grit-dim mb-2" />
            <p className="text-sm font-bold text-white">Fitness data is not available yet</p>
            <p className="text-[11px] text-grit-dim mt-1">
              Check your Health permissions, then refresh.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1.15fr_1fr] gap-3 mb-4">
              <div
                className="min-h-32 p-3 flex flex-col justify-between border border-[#292929]"
                style={{ background: "#171717", borderRadius: 8 }}
              >
                <Footprints size={18} style={{ color: "#c8ff3d" }} />
                <div>
                  <p className="display text-3xl font-black text-white leading-none">
                    {summary.today.steps.toLocaleString()}
                  </p>
                  <p className="label-cap text-[9px] text-grit-dim mt-1">Steps today</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 content-center">
                <FitnessRing
                  label="Move"
                  value={summary.today.activeKcal}
                  goal={goals.activeKcal}
                  color="#ff3b30"
                />
                <FitnessRing
                  label="Exercise"
                  value={summary.today.exerciseMinutes}
                  goal={goals.exerciseMinutes}
                  color="#b8f20c"
                />
                <FitnessRing
                  label="Stand"
                  value={summary.today.standHours}
                  goal={goals.standHours}
                  color="#29d9f2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <Metric
                icon={<Route size={15} />}
                label="Distance"
                value={`${summary.today.distanceKm.toFixed(1)} km`}
              />
              <Metric
                icon={<HeartPulse size={15} />}
                label="Resting heart rate"
                value={
                  summary.today.restingHeartRate > 0
                    ? `${Math.round(summary.today.restingHeartRate)} bpm`
                    : "No reading"
                }
              />
            </div>

            <div className="border-t border-[#292929] pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="label-cap text-[9px] text-grit-dim">Steps · last 7 days</p>
                <p className="text-[10px] font-bold text-white">
                  {Math.round(
                    days.reduce((sum, day) => sum + day.steps, 0) / Math.max(1, days.length),
                  ).toLocaleString()}{" "}
                  avg
                </p>
              </div>
              <div className="grid grid-cols-7 gap-1.5 h-20 items-end">
                {days.map((day) => {
                  const label = new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(
                    new Date(`${day.date}T12:00:00`),
                  );
                  return (
                    <div
                      key={day.date}
                      className="h-full flex flex-col justify-end items-center gap-1"
                    >
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full min-h-1"
                          style={{
                            height: `${Math.max(5, (day.steps / maxSteps) * 100)}%`,
                            background: day.date === days.at(-1)?.date ? "#c8ff3d" : "#424242",
                            borderRadius: "3px 3px 1px 1px",
                          }}
                          title={`${day.steps.toLocaleString()} steps`}
                        />
                      </div>
                      <span className="text-[8px] font-bold text-grit-dim uppercase">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function FitnessRing({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  const percentage = Math.min(100, Math.max(0, (value / Math.max(goal, 1)) * 100));
  return (
    <div className="min-w-0 text-center">
      <div
        className="aspect-square w-full grid place-items-center"
        style={{
          borderRadius: "50%",
          background: `conic-gradient(${color} ${percentage}%, #292929 ${percentage}% 100%)`,
          padding: 4,
        }}
        title={`${Math.round(value)} of ${Math.round(goal)}`}
      >
        <div
          className="w-full h-full grid place-items-center bg-[#111]"
          style={{ borderRadius: "50%" }}
        >
          <span className="text-[9px] font-black text-white">{Math.round(value)}</span>
        </div>
      </div>
      <p className="text-[8px] font-bold text-grit-dim mt-1 truncate">{label}</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="min-h-16 p-3 border border-[#292929] flex items-center gap-2.5"
      style={{ background: "#171717", borderRadius: 8 }}
    >
      <span className="text-grit-dim shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-extrabold text-white truncate">{value}</span>
        <span className="block text-[8px] font-bold uppercase text-grit-dim truncate">{label}</span>
      </span>
    </div>
  );
}
