import { Lock, FileBarChart, TrendingUp, TrendingDown } from "lucide-react";
import { useMemo } from "react";
import { useAppState } from "@/lib/storage";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { weeklyReport, GRADE_COLORS } from "@/lib/weekly-report";

/**
 * Graded week-in-review (Pro): last completed Monday-Sunday week with
 * deltas vs the week before. Free users see it blurred behind an unlock.
 */
export function WeeklyReportCard() {
  const [state] = useAppState();
  const { isPro, loading } = usePro();
  const locked = !loading && !isPro;
  const report = useMemo(() => weeklyReport(state), [state]);

  // Nothing worth grading until there's at least some history.
  if (state.sessions.filter((s) => s.endedAt).length === 0) return null;

  const gradeColor = GRADE_COLORS[report.grade];

  return (
    <section className="deadset-section">
      <div className="bg-grit-card border border-grit rounded-2xl p-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
            <FileBarChart size={11} /> WEEKLY REPORT CARD
          </p>
          <span className="label-cap text-[9px] text-accent-red border border-accent-red/40 rounded px-1.5">
            PRO
          </span>
        </div>
        <div
          className={locked ? "pointer-events-none select-none blur-[6px] opacity-60" : undefined}
          aria-hidden={locked || undefined}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2"
              style={{ borderColor: gradeColor, boxShadow: `0 0 30px ${gradeColor}33` }}
            >
              <span className="display text-4xl font-black" style={{ color: gradeColor }}>
                {report.grade}
              </span>
            </div>
            <div className="min-w-0">
              <p className="label-cap text-[9px] text-grit-dim">
                WEEK OF {report.weekStart.slice(5).replace("-", "/")}
              </p>
              <p className="text-sm text-grit font-bold leading-snug mt-0.5">{report.headline}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            <ReportStat label="SESSIONS" value={String(report.sessions)} delta={report.sessionsDelta} />
            <ReportStat
              label="VOLUME"
              value={`${(report.volumeKg / 1000).toFixed(1)}t`}
              delta={report.volumeDelta}
              deltaFmt={(d) => `${(Math.abs(d) / 1000).toFixed(1)}t`}
            />
            <ReportStat label="SETS" value={String(report.setsLogged)} />
            <ReportStat label="PRS" value={String(report.prs)} accent={report.prs > 0} />
          </div>
        </div>
        {locked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="bg-grit-card border p-4 max-w-[260px] text-center">
              <Lock size={16} className="text-accent-red mx-auto mb-2" />
              <p className="label-cap text-[10px] mb-1">WEEKLY REPORT CARD</p>
              <p className="text-xs text-grit-dim mb-3">
                Your week graded A–F, with deltas vs the week before.
              </p>
              <button onClick={() => openPaywall("report")} className="btn-grit px-4 py-2 text-xs">
                UNLOCK WITH PRO
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ReportStat({
  label,
  value,
  delta,
  deltaFmt,
  accent,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaFmt?: (d: number) => string;
  accent?: boolean;
}) {
  return (
    <div className="border border-grit rounded-xl px-2 py-2 text-center">
      <p className="label-cap text-[8px] text-grit-dim">{label}</p>
      <p
        className="display text-lg font-extrabold leading-tight"
        style={{ color: accent ? "#e63222" : "#f5f5f0" }}
      >
        {value}
      </p>
      {delta != null && delta !== 0 && (
        <p
          className="label-cap text-[8px] flex items-center justify-center gap-0.5"
          style={{ color: delta > 0 ? "#22c55e" : "#e63222" }}
        >
          {delta > 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
          {deltaFmt ? deltaFmt(delta) : Math.abs(delta)}
        </p>
      )}
    </div>
  );
}
