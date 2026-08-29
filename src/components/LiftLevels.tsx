import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { estimate1RM } from "@/lib/calc";
import type { AppState } from "@/lib/types";

// Standards (kg) ~ male intermediate from strengthlevel.com, scaled by bodyweight ratio.
// Levels: UNTRAINED < NOVICE < INTERMEDIATE < ADVANCED < ELITE
const STANDARDS: Record<string, [number, number, number, number]> = {
  // multipliers of bodyweight: [novice, intermediate, advanced, elite]
  "bench-press": [0.75, 1.25, 1.75, 2.25],
  squat: [1.0, 1.5, 2.25, 2.75],
  deadlift: [1.25, 1.75, 2.5, 3.25],
};

const LIFTS = [
  { id: "bench-press", label: "BENCH" },
  { id: "squat", label: "SQUAT" },
  { id: "deadlift", label: "DEADLIFT" },
];

const LEVELS = ["UNTRAINED", "NOVICE", "INTERMEDIATE", "ADVANCED", "ELITE"] as const;
const LEVEL_COLOR: Record<string, string> = {
  UNTRAINED: "#8a8a8a",
  NOVICE: "#cbd5e1",
  INTERMEDIATE: "#fbbf24",
  ADVANCED: "#67e8f9",
  ELITE: "#a78bfa",
};

function bestE1RM(state: AppState, exerciseId: string): number {
  let best = 0;
  for (const l of state.logs) {
    if (l.exerciseId !== exerciseId) continue;
    const e = estimate1RM(l.weight, l.reps);
    if (e > best) best = e;
  }
  const manual = state.manualPRs?.[exerciseId];
  if (manual?.value) {
    const reps = manual.reps ?? 1;
    const e = estimate1RM(manual.value, reps);
    if (e > best) best = e;
  }
  return best;
}

function classify(ratio: number, std: [number, number, number, number]): (typeof LEVELS)[number] {
  if (ratio >= std[3]) return "ELITE";
  if (ratio >= std[2]) return "ADVANCED";
  if (ratio >= std[1]) return "INTERMEDIATE";
  if (ratio >= std[0]) return "NOVICE";
  return "UNTRAINED";
}

export function LiftLevels({ state }: { state: AppState }) {
  const rows = useMemo(() => {
    const bw = state.profile?.weightKg || 75;
    return LIFTS.map((lift) => {
      const e1rm = bestE1RM(state, lift.id);
      const ratio = e1rm / bw;
      const std = STANDARDS[lift.id];
      const level = classify(ratio, std);
      const levelIdx = LEVELS.indexOf(level);
      // progress to next level
      const lower = levelIdx === 0 ? 0 : std[levelIdx - 1];
      const upper = levelIdx === 4 ? std[3] * 1.15 : std[levelIdx];
      const pct = Math.min(100, Math.max(0, ((ratio - lower) / (upper - lower)) * 100));
      const nextTarget = levelIdx < 4 ? std[levelIdx] * bw : null;
      return { lift, e1rm, ratio, level, pct, nextTarget };
    });
  }, [state]);

  return (
    <section className="px-5 mb-6">
      <p className="label-cap mb-2 flex items-center gap-1.5">
        <TrendingUp size={12} className="text-accent-red" /> Lift Levels
      </p>
      <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
        {rows.map((r) => (
          <div key={r.lift.id} className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="display font-extrabold text-grit text-sm">{r.lift.label}</p>
                <p className="text-[10px] text-grit-dim">
                  {r.e1rm > 0
                    ? `${Math.round(r.e1rm)}kg e1RM · ${r.ratio.toFixed(2)}× BW`
                    : "No data yet"}
                </p>
              </div>
              <span
                className="label-cap text-[10px] px-2 py-0.5 border"
                style={{ borderColor: LEVEL_COLOR[r.level], color: LEVEL_COLOR[r.level] }}
              >
                {r.level}
              </span>
            </div>
            <div className="h-1 bg-grit overflow-hidden">
              <div
                className="h-1 transition-[width] duration-500 ease-out"
                style={{ width: `${r.pct}%`, background: LEVEL_COLOR[r.level] }}
              />
            </div>
            {r.nextTarget && r.e1rm > 0 && (
              <p className="text-[9px] text-grit-dim mt-1 label-cap">
                NEXT TIER: {Math.round(r.nextTarget)}KG
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
