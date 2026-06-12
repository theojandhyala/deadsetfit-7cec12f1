import { Link } from "@tanstack/react-router";
import { useAppState } from "@/lib/storage";
import { calculateStreak } from "@/lib/calc";
import { TrendingUp, TrendingDown, Minus, Zap, ChevronRight } from "lucide-react";

function getWeekBounds(offsetWeeks = 0) {
  const now = new Date();
  const dow = now.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now);
  mon.setDate(now.getDate() + toMon + offsetWeeks * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

export function InsightsWidget() {
  const [state] = useAppState();
  const p = state.profile;
  if (!p) return null;

  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(-1);

  const thisWeekDone = (state.completedDates ?? []).filter(d => {
    const dt = new Date(d);
    return dt >= thisWeek.start && dt <= thisWeek.end;
  }).length;

  const thisVol = (state.sessions ?? [])
    .filter(s => { const dt = new Date(s.date); return dt >= thisWeek.start && dt <= thisWeek.end; })
    .reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);

  const lastVol = (state.sessions ?? [])
    .filter(s => { const dt = new Date(s.date); return dt >= lastWeek.start && dt <= lastWeek.end; })
    .reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);

  const volTrend = lastVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : null;
  const target = p.daysPerWeek;
  const streak = calculateStreak(state.completedDates);
  const totalSessions = (state.sessions ?? []).length;
  const prCount = Object.keys(state.manualPRs ?? {}).length;

  const msg =
    thisWeekDone === 0 ? "Fresh week. Let's get after it." :
    thisWeekDone >= target ? "Full week smashed. Legendary. 🔥" :
    thisWeekDone === target - 1 ? "One session away. Finish strong." :
    streak >= 14 ? `${streak}-day streak — you're unstoppable.` :
    streak >= 7 ? `${streak} days straight. Don't stop now.` :
    `${target - thisWeekDone} sessions left to hit your weekly goal.`;

  const size = 56;
  const sw = 4.5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, thisWeekDone / Math.max(1, target));

  return (
    <div
      className="mx-4 mb-4 rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(252,76,2,0.1) 0%, #1C1D21 100%)", border: "1.5px solid rgba(252,76,2,0.3)" }}
    >
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90 absolute inset-0">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2C2D33" strokeWidth={sw} />
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FC4C02" strokeWidth={sw}
                strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 700ms ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="display font-extrabold text-white" style={{ fontSize: 17, lineHeight: 1 }}>{thisWeekDone}</span>
              <span style={{ fontSize: 9, color: "#9EA3AE", fontWeight: 700 }}>/{target}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-snug">{msg}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {volTrend !== null && (
                <span className="flex items-center gap-1 text-[10px] font-bold"
                  style={{ color: volTrend > 0 ? "#4CAF50" : volTrend < 0 ? "#FF5252" : "#9EA3AE" }}>
                  {volTrend > 0 ? <TrendingUp size={10} /> : volTrend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                  {volTrend > 0 ? "+" : ""}{volTrend}% vol vs last week
                </span>
              )}
              {streak > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "#FC4C02" }}>
                  <Zap size={10} /> {streak}d streak
                </span>
              )}
            </div>
          </div>

          <Link to="/progress" className="flex-shrink-0 press" aria-label="See progress">
            <ChevronRight size={18} style={{ color: "#6B7280" }} />
          </Link>
        </div>

        <div className="flex mt-3 gap-2">
          {[
            { label: "Sessions", value: totalSessions },
            { label: "This Week", value: thisWeekDone },
            { label: "PRs Set", value: prCount },
          ].map((s, i) => (
            <div key={i} className="flex-1 text-center py-2 rounded-xl" style={{ background: "#25262B" }}>
              <p className="display font-extrabold text-white" style={{ fontSize: 16 }}>{s.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "#9EA3AE" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
