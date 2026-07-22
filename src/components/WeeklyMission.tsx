import { useMemo } from "react";
import { CalendarCheck, Target } from "lucide-react";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/** Monday-based ISO days of the current week. */
function thisWeekDays(): string[] {
  const now = new Date();
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return isoDay(d);
  });
}

/**
 * The week's mission: sessions done vs the athlete's own plan (daysPerWeek),
 * plus the countdown to their committed goal date from onboarding — data that
 * was captured but never surfaced anywhere.
 */
export function WeeklyMission({ state }: { state: AppState }) {
  const p = state.profile;
  const target = p?.daysPerWeek ?? 0;

  const done = useMemo(() => {
    const week = new Set(thisWeekDays());
    return state.completedDates.filter((d) => week.has(d)).length;
  }, [state.completedDates]);

  const goal = useMemo(() => {
    if (!p?.commitmentDate) return null;
    const end = new Date(p.commitmentDate + "T23:59:59");
    if (!Number.isFinite(end.getTime())) return null;
    const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
    return { days, outcome: p.dreamOutcome };
  }, [p?.commitmentDate, p?.dreamOutcome]);

  if (!target && !goal) return null;

  const hit = target > 0 && done >= target;

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4 mb-4">
      {target > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label-cap text-[10px] flex items-center gap-1.5">
              <CalendarCheck size={12} className="text-accent-red" /> This week's mission
            </p>
            <span
              className="label-cap text-[10px] font-bold"
              style={{ color: hit ? "#22c55e" : "#8a8a8a" }}
            >
              {done}/{target} sessions{hit ? " · done ✓" : ""}
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: target }, (_, i) => (
              <div
                key={i}
                className="h-2 flex-1 rounded-full"
                style={{ background: i < done ? (hit ? "#22c55e" : "#e63222") : "#1c1c1c" }}
              />
            ))}
          </div>
        </div>
      )}

      {goal && goal.days >= 0 && (
        <div className={target > 0 ? "mt-3 pt-3 border-t border-grit" : ""}>
          <div className="flex items-center gap-2.5">
            <Target size={14} className="text-accent-red shrink-0" />
            <p className="text-xs text-grit min-w-0 flex-1 truncate">
              {goal.outcome ? goal.outcome : "Your locked-in goal"}
            </p>
            <span className="display font-extrabold text-grit text-lg leading-none shrink-0">
              {goal.days}
              <span className="text-[10px] text-grit-dim ml-1">days left</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
