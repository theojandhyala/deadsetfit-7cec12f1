import { useMemo } from "react";
import { GraduationCap } from "lucide-react";

import { gradeHistory, GRADE_COLORS } from "@/lib/weekly-report";
import type { AppState } from "@/lib/types";

const GRADE_SCORE: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

/**
 * The report card's memory — the last 8 completed weeks graded side by side,
 * so a slipping month is visible before it becomes a lost one. Hidden until
 * three weeks exist to compare.
 */
export function ReportHistoryCard({ state }: { state: AppState }) {
  const grades = useMemo(() => gradeHistory(state), [state]);

  if (grades.length < 3) return null;

  const recent = grades.slice(-2).reduce((s, g) => s + GRADE_SCORE[g.grade], 0) / 2;
  const earlier =
    grades.slice(0, -2).reduce((s, g) => s + GRADE_SCORE[g.grade], 0) / (grades.length - 2);
  const trend =
    recent - earlier > 0.5 ? "improving" : earlier - recent > 0.5 ? "slipping" : "steady";

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <div className="flex items-baseline justify-between">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
            <GraduationCap size={12} /> Report history
          </p>
          <p className="label-cap text-[9px] text-grit-dim">{grades.length} weeks</p>
        </div>

        <div
          className="flex gap-1.5 mt-3"
          role="img"
          aria-label={`Weekly grades, oldest first: ${grades.map((g) => g.grade).join(", ")}. Trend: ${trend}.`}
        >
          {grades.map((g) => (
            <div
              key={g.weekStart}
              className="flex-1 rounded-lg py-2 text-center"
              style={{ background: `${GRADE_COLORS[g.grade]}1f` }}
              title={`Week of ${g.weekStart}: ${g.sessions} session${g.sessions === 1 ? "" : "s"}`}
            >
              <span
                className="display text-base font-extrabold"
                style={{ color: GRADE_COLORS[g.grade] }}
              >
                {g.grade}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-grit-dim leading-relaxed mt-2.5">
          {trend === "improving"
            ? "Trending up — the last fortnight outgraded the weeks before it."
            : trend === "slipping"
              ? "Grades are slipping vs earlier weeks — one solid week resets the slide."
              : "Holding steady. Consistency is the whole game."}
        </p>
      </div>
    </section>
  );
}
