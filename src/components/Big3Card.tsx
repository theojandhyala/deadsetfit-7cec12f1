import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AppState, SetLog } from "@/lib/types";
import { estimate1RM } from "@/lib/calc";

const BIG3: { id: string; label: string }[] = [
  { id: "bench-press", label: "BENCH" },
  { id: "squat", label: "SQUAT" },
  { id: "deadlift", label: "DEADLIFT" },
];

function allSetsFor(state: AppState, exerciseId: string): SetLog[] {
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
  return out;
}

function bestE1RMBetween(logs: SetLog[], fromMs: number, toMs: number) {
  let best = 0;
  for (const l of logs) {
    const t = new Date(l.date).getTime();
    if (t < fromMs || t > toMs) continue;
    const e = estimate1RM(l.weight, l.reps);
    if (e > best) best = e;
  }
  return best;
}

export function Big3Card({ state }: { state: AppState }) {
  const now = Date.now();
  const d30 = now - 30 * 86400000;
  const d60 = now - 60 * 86400000;

  return (
    <div className="bg-grit-card border border-grit p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="label-cap text-accent-red">BIG 3 · e1RM</p>
        <p className="text-[10px] text-grit-dim">30-DAY TREND</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {BIG3.map(({ id, label }) => {
          const logs = allSetsFor(state, id);
          const current = bestE1RMBetween(logs, 0, now);
          const recent = bestE1RMBetween(logs, d30, now);
          const prior = bestE1RMBetween(logs, d60, d30);
          let trendIcon = <Minus size={12} />;
          let trendColor = "#8a8a8a";
          let delta = 0;
          if (recent && prior) {
            delta = recent - prior;
            if (delta > 0) { trendIcon = <TrendingUp size={12} />; trendColor = "#3a8a3a"; }
            else if (delta < 0) { trendIcon = <TrendingDown size={12} />; trendColor = "#e63222"; }
          }
          return (
            <Link
              key={id}
              to="/lift/$exerciseId"
              params={{ exerciseId: id }}
              className="bg-[#0a0a0a] border border-grit p-3 text-center hover:border-accent-red transition-colors"
            >
              <p className="label-cap text-[9px] text-grit-dim">{label}</p>
              <p className="display text-2xl font-extrabold text-grit leading-none mt-1">
                {current || "—"}
                {current ? <span className="text-[10px] text-grit-dim ml-0.5">kg</span> : null}
              </p>
              <div
                className="inline-flex items-center gap-0.5 mt-1.5 text-[10px] font-bold"
                style={{ color: trendColor }}
              >
                {trendIcon}
                <span>{delta > 0 ? "+" : ""}{delta || 0}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
