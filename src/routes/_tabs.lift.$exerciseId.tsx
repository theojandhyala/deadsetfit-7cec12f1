import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Trophy } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { estimate1RM } from "@/lib/calc";
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
  const out: SetLog[] = state.logs.filter((l) => l.exerciseId === exerciseId).slice();
  state.sessions.forEach((s) =>
    s.exercises
      .filter((e) => e.exerciseId === exerciseId)
      .forEach((e) =>
        e.sets.forEach((set) =>
          out.push({ exerciseId, weight: set.weight, reps: set.reps, date: s.date }),
        ),
      ),
  );
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
    const m = new Map<string, { date: string; e1rm: number; volume: number; topWeight: number; topReps: number }>();
    for (const l of logs) {
      const d = l.date.slice(0, 10);
      const e = estimate1RM(l.weight, l.reps);
      const vol = l.weight * l.reps;
      const cur = m.get(d) ?? { date: d, e1rm: 0, volume: 0, topWeight: 0, topReps: 0 };
      cur.e1rm = Math.max(cur.e1rm, e);
      cur.volume += vol;
      if (l.weight > cur.topWeight) { cur.topWeight = l.weight; cur.topReps = l.reps; }
      m.set(d, cur);
    }
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  const allTimePR = useMemo(() =>
    all.reduce((m, l) => Math.max(m, l.weight), 0),
  [all]);
  const e1rmPR = useMemo(() =>
    all.reduce((m, l) => Math.max(m, estimate1RM(l.weight, l.reps)), 0),
  [all]);

  const empty = byDay.length === 0;

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-3 flex items-center gap-2">
        <Link to="/progress" className="text-grit-dim"><ChevronLeft size={22} /></Link>
        <div className="min-w-0">
          <p className="label-cap text-grit-dim">LIFT STATS</p>
          <h1 className="display text-2xl font-extrabold uppercase text-grit truncate">{name}</h1>
        </div>
      </header>

      <section className="px-5 mb-4 grid grid-cols-2 gap-3">
        <div className="bg-grit-card border border-grit p-3">
          <p className="label-cap text-[10px] text-grit-dim">ALL-TIME 1RM</p>
          <p className="display text-3xl font-extrabold text-grit leading-none mt-1">
            {allTimePR || "—"}<span className="text-xs text-grit-dim ml-1">kg</span>
          </p>
        </div>
        <div className="bg-grit-card border border-grit p-3">
          <p className="label-cap text-[10px] text-grit-dim">EST. 1RM</p>
          <p className="display text-3xl font-extrabold text-accent-red leading-none mt-1">
            {e1rmPR || "—"}<span className="text-xs text-grit-dim ml-1">kg</span>
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
              borderColor: i === rangeIdx ? "#e63222" : "#262626",
              color: i === rangeIdx ? "#e63222" : "#8a8a8a",
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
                <Line type="monotone" dataKey="e1rm" stroke="#e63222" strokeWidth={2} dot={{ r: 3 }} />
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
                <Bar dataKey="volume" fill="#e63222" />
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

      <div className="h-12" />
    </div>
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
