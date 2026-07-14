import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Trophy } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { estimate1RM } from "@/lib/calc";
import { OneRmCalculator } from "@/components/OneRmCalculator";
import type { SetLog, AppState } from "@/lib/types";

export const Route = createFileRoute("/_tabs/lift/$exerciseId")({
  head: () => ({ meta: [{ title: "DEADSET — Lift History" }] }),
  component: LiftDetailPage,
});

const RANGES = [
  { k: "1M", days: 30 },
  { k: "3M", days: 90 },
  { k: "6M", days: 180 },
  { k: "1Y", days: 365 },
  { k: "ALL", days: 100000 },
] as const;

function gatherLogs(state: AppState, exerciseId: string): SetLog[] {
  // Sessions are the source of truth per day. finishWorkout ALSO writes each
  // exercise's best set into state.logs, so including both for the same day
  // would double-count that top set in volume sums — legacy logs only fill
  // days that have no session data.
  const out: SetLog[] = [];
  const sessionDays = new Set<string>();
  state.sessions.forEach((s) =>
    s.exercises
      .filter((e) => e.exerciseId === exerciseId)
      .forEach((e) =>
        e.sets.forEach((set) => {
          sessionDays.add(s.date.slice(0, 10));
          out.push({ exerciseId, weight: set.weight, reps: set.reps, date: s.date });
        }),
      ),
  );
  state.logs
    .filter((l) => l.exerciseId === exerciseId && !sessionDays.has(l.date.slice(0, 10)))
    .forEach((l) => out.push(l));
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function LiftDetailPage() {
  const { exerciseId } = Route.useParams();
  const [state] = useAppState();
  const [rangeIdx, setRangeIdx] = useState(1);
  const range = RANGES[rangeIdx];

  const ex = getExercise(exerciseId);
  const name = ex?.name ?? exerciseId.replace(/-/g, " ");

  const all = useMemo(() => gatherLogs(state, exerciseId), [state, exerciseId]);

  const cutoff = Date.now() - range.days * 86400000;
  const logs = all.filter((l) => new Date(l.date).getTime() >= cutoff);

  // Per-day: best e1RM, total volume, best set
  const byDay = useMemo(() => {
    const m = new Map<
      string,
      { date: string; e1rm: number; volume: number; topWeight: number; topReps: number }
    >();
    for (const l of logs) {
      const d = l.date.slice(0, 10);
      const e = estimate1RM(l.weight, l.reps);
      const vol = l.weight * l.reps;
      const cur = m.get(d) ?? { date: d, e1rm: 0, volume: 0, topWeight: 0, topReps: 0 };
      cur.e1rm = Math.max(cur.e1rm, e);
      cur.volume += vol;
      if (l.weight > cur.topWeight) {
        cur.topWeight = l.weight;
        cur.topReps = l.reps;
      }
      m.set(d, cur);
    }
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  // Best set of the most recent day with data — prefill for the 1RM calculator.
  const recentBest = useMemo(() => {
    if (!all.length) return null;
    const lastDay = all[all.length - 1].date.slice(0, 10);
    let best: SetLog | null = null;
    for (const l of all) {
      if (l.date.slice(0, 10) !== lastDay) continue;
      if (!best || estimate1RM(l.weight, l.reps) > estimate1RM(best.weight, best.reps)) best = l;
    }
    return best;
  }, [all]);

  const allTimePR = useMemo(() => all.reduce((m, l) => Math.max(m, l.weight), 0), [all]);
  const e1rmPR = useMemo(
    () => all.reduce((m, l) => Math.max(m, estimate1RM(l.weight, l.reps)), 0),
    [all],
  );

  const empty = byDay.length === 0;

  return (
    <div>
      <header className="px-5 pt-6 pb-3 flex items-center gap-2">
        <Link to="/progress" className="text-grit-dim">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0">
          <p className="label-cap text-grit-dim">LIFT STATS</p>
          <h1 className="display text-2xl font-extrabold uppercase text-grit truncate">{name}</h1>
        </div>
      </header>

      <section className="px-5 mb-4 grid grid-cols-2 gap-3">
        <div className="bg-grit-card border border-grit p-3">
          <p className="label-cap text-[10px] text-grit-dim">ALL-TIME 1RM</p>
          <p className="display text-3xl font-extrabold text-grit leading-none mt-1">
            {allTimePR || "—"}
            <span className="text-xs text-grit-dim ml-1">kg</span>
          </p>
        </div>
        <div className="bg-grit-card border border-grit p-3">
          <p className="label-cap text-[10px] text-grit-dim">EST. 1RM</p>
          <p className="display text-3xl font-extrabold text-accent-red leading-none mt-1">
            {e1rmPR || "—"}
            <span className="text-xs text-grit-dim ml-1">kg</span>
          </p>
        </div>
      </section>

      <div className="px-5 mb-4 flex gap-2">
        {RANGES.map((r, i) => (
          <button
            key={r.k}
            onClick={() => setRangeIdx(i)}
            className="px-3 py-1.5 text-[11px] font-extrabold tracking-widest border"
            style={{
              borderColor: i === rangeIdx ? "#E10600" : "#262626",
              color: i === rangeIdx ? "#E10600" : "#8a8a8a",
              background: i === rangeIdx ? "#1a0606" : "transparent",
            }}
          >
            {r.k}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="mx-5 bg-grit-card border border-grit p-8 text-center">
          <Trophy size={28} className="mx-auto text-grit-dim mb-2" />
          <p className="label-cap text-grit-dim">NO DATA IN RANGE</p>
          <p className="text-xs text-grit-dim mt-1">Log a set to start building your history.</p>
        </div>
      ) : (
        <>
          <ChartCard title="ESTIMATED 1RM">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byDay}>
                <CartesianGrid stroke="#1a1a1a" />
                <XAxis dataKey="date" tick={{ fill: "#8a8a8a", fontSize: 10 }} />
                <YAxis tick={{ fill: "#8a8a8a", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626" }} />
                <Line
                  type="monotone"
                  dataKey="e1rm"
                  stroke="#E10600"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="VOLUME PER SESSION">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byDay}>
                <CartesianGrid stroke="#1a1a1a" />
                <XAxis dataKey="date" tick={{ fill: "#8a8a8a", fontSize: 10 }} />
                <YAxis tick={{ fill: "#8a8a8a", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626" }} />
                <Bar dataKey="volume" fill="#E10600" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="TOP SET (WEIGHT × REPS)">
            <ResponsiveContainer width="100%" height={180}>
              <ScatterChart>
                <CartesianGrid stroke="#1a1a1a" />
                <XAxis dataKey="date" tick={{ fill: "#8a8a8a", fontSize: 10 }} type="category" />
                <YAxis dataKey="topWeight" tick={{ fill: "#8a8a8a", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626" }} />
                <Scatter data={byDay} fill="#f5c542" />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}

      <StrengthStandard
        exerciseId={exerciseId}
        e1rm={e1rmPR}
        bodyweightKg={state.profile?.weightKg ?? 80}
      />

      <OneRmCalculator
        key={exerciseId}
        initialWeight={recentBest?.weight}
        initialReps={recentBest?.reps}
      />

      <div className="h-12" />
    </div>
  );
}

const STRENGTH_LEVELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"] as const;
type StrengthLevel = (typeof STRENGTH_LEVELS)[number];

// Multipliers: [bench, squat, deadlift, ohp]
const BIG4_MULTIPLIERS: Record<StrengthLevel, [number, number, number, number]> = {
  Beginner: [0.5, 0.75, 1.0, 0.35],
  Novice: [0.75, 1.25, 1.5, 0.55],
  Intermediate: [1.0, 1.5, 2.0, 0.75],
  Advanced: [1.25, 2.0, 2.5, 1.0],
  Elite: [1.5, 2.5, 3.0, 1.25],
};
const GENERIC_MULTIPLIERS: Record<StrengthLevel, number> = {
  Beginner: 0.25,
  Novice: 0.5,
  Intermediate: 0.75,
  Advanced: 1.0,
  Elite: 1.25,
};
const BIG4_IDS = ["bench-press", "squat", "deadlift", "overhead-press"] as const;
type Big4Id = (typeof BIG4_IDS)[number];

function getStandardKg(exerciseId: string, level: StrengthLevel, bw: number): number {
  const idx = BIG4_IDS.indexOf(exerciseId as Big4Id);
  if (idx >= 0) return Math.round(BIG4_MULTIPLIERS[level][idx] * bw);
  return Math.round(GENERIC_MULTIPLIERS[level] * bw);
}

function StrengthStandard({
  exerciseId,
  e1rm,
  bodyweightKg,
}: {
  exerciseId: string;
  e1rm: number;
  bodyweightKg: number;
}) {
  const thresholds = STRENGTH_LEVELS.map((l) => getStandardKg(exerciseId, l, bodyweightKg));
  // Find current level: highest threshold the user meets
  let currentLevelIdx = -1;
  for (let i = 0; i < thresholds.length; i++) {
    if (e1rm >= thresholds[i]) currentLevelIdx = i;
  }
  const nextIdx = currentLevelIdx + 1;
  const nextLevel = nextIdx < STRENGTH_LEVELS.length ? STRENGTH_LEVELS[nextIdx] : null;
  const nextThreshold = nextLevel ? thresholds[nextIdx] : null;
  const gap = nextThreshold ? nextThreshold - e1rm : 0;

  // Progress within current segment
  const segStart = currentLevelIdx >= 0 ? thresholds[currentLevelIdx] : 0;
  const segEnd = nextThreshold ?? thresholds[thresholds.length - 1];
  const segProgress = nextThreshold
    ? Math.min(100, Math.max(0, ((e1rm - segStart) / (segEnd - segStart)) * 100))
    : 100;

  return (
    <section className="mx-5 mb-4 bg-grit-card border border-grit p-4">
      <p className="label-cap text-[10px] text-grit-dim mb-3">STRENGTH STANDARD</p>
      {/* 5-segment bar */}
      <div className="flex gap-0.5 mb-3">
        {STRENGTH_LEVELS.map((level, i) => {
          const isActive = i === currentLevelIdx;
          const isPast = i < currentLevelIdx;
          const isNext = i === nextIdx;
          return (
            <div key={level} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full h-3"
                style={{
                  background: isActive ? "#E10600" : isPast ? "#7a1410" : "#1a1a1a",
                  outline: isActive ? "1px solid #E10600" : undefined,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isNext && e1rm > 0 && (
                  <div
                    style={{ width: `${segProgress}%`, height: "100%", background: "#7a1410" }}
                  />
                )}
              </div>
              <span
                className="text-[8px] label-cap"
                style={{ color: isActive ? "#E10600" : "#8a8a8a" }}
              >
                {level.slice(0, 3).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>

      {e1rm > 0 ? (
        <div>
          <p className="text-sm text-grit font-bold">
            You lift <span className="text-accent-red">{e1rm}kg</span>
            {currentLevelIdx >= 0 ? ` · ${STRENGTH_LEVELS[currentLevelIdx]}` : " · Below Beginner"}
          </p>
          {nextLevel && nextThreshold && (
            <p className="text-xs text-grit-dim mt-1">
              Next level ({nextLevel}): {nextThreshold}kg
              <span className="text-accent-red ml-1">+{gap}kg away</span>
            </p>
          )}
          {!nextLevel && <p className="text-xs text-grit-dim mt-1">Elite level achieved.</p>}
        </div>
      ) : (
        <p className="text-xs text-grit-dim">Log a set to see your strength standard.</p>
      )}
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-5 mb-4 bg-grit-card border border-grit p-3">
      <p className="label-cap text-[10px] text-grit-dim mb-2">{title}</p>
      {children}
    </section>
  );
}
