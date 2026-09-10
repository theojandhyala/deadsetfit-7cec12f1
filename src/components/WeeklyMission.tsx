import { useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, Check, ChevronDown, Flame, Target, Trophy } from "lucide-react";
import { useToday } from "@/hooks/useToday";
import { defaultSchedule } from "@/lib/calc";
import { hapticSelection } from "@/lib/haptics";
import {
  calendarDaysUntil,
  weeklyConsistency,
  weeklyPlanDays,
  WEEK_MILESTONES,
} from "@/lib/weekly-consistency";
import type { AppState } from "@/lib/types";

function dateLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** A compact home summary; history and milestones are revealed on demand. */
export function WeeklyMission({ state }: { state: AppState }) {
  const today = useToday();
  const detailsId = useId();
  const weekId = useId();
  const [expanded, setExpanded] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const progress = useMemo(
    () => weeklyConsistency(state.completedDates, today),
    [state.completedDates, today],
  );
  const schedule = useMemo(
    () => state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null),
    [state.schedule, state.profile],
  );
  const target = weeklyPlanDays(state, schedule).length;
  const hit = target > 0 && progress.done >= target;
  const remaining = Math.max(0, target - progress.done);
  const selected = progress.weeks.find((week) => week.start === selectedStart) ?? progress.weeks[7];
  const goalDays = state.profile?.commitmentDate
    ? calendarDaysUntil(today, state.profile.commitmentDate)
    : null;
  const subtitle = hit
    ? "Weekly target reached. Keep recovery in your plan."
    : !target
      ? "Give your week a shape. Choose the days that work for you."
      : progress.done > 0
        ? `${remaining} more training ${remaining === 1 ? "day" : "days"} towards your current plan. No need to cram them in.`
        : progress.current > 0
          ? "Your run is still open this week. Return on your next planned day."
          : "A fresh week, a fresh start. Your next session starts the run.";

  return (
    <section
      className="weekly-momentum min-w-0 rounded-2xl border border-grit p-4"
      aria-label="Weekly momentum"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-cap text-[10px] flex items-center gap-1.5">
          <Flame size={14} className="text-accent-red" /> YOUR MOMENTUM
        </p>
        <span className="text-[11px] text-grit-dim">
          Best: {progress.best} {progress.best === 1 ? "week" : "weeks"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="display text-3xl font-extrabold leading-none text-grit">
            {progress.current}{" "}
            <span className="text-lg">{progress.current === 1 ? "WEEK" : "WEEKS"}</span>
          </p>
          <p className="mt-1 text-xs text-grit-dim">Active-week streak</p>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs ${hit ? "border-green-500/30 text-green-400" : "border-grit text-grit"}`}
        >
          {hit ? <Check size={13} /> : <CalendarCheck size={13} />}
          {target ? `${progress.done}/${target} days this week` : `${progress.done} days this week`}
        </div>
      </div>
      {target > 0 && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="This week's training-day target"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(target, progress.done)}
          aria-valuetext={`${progress.done} training days completed; current plan has ${target}`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${hit ? "bg-green-400" : "bg-accent-red"}`}
            style={{ width: `${Math.min(100, (progress.done / target) * 100)}%` }}
          />
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-grit-dim">{subtitle}</p>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => {
          hapticSelection();
          setExpanded((value) => !value);
        }}
        className="mt-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left text-xs font-bold text-grit focus-visible:outline-2 focus-visible:outline-accent-red"
      >
        <span>
          {expanded
            ? "Close streak details"
            : `${progress.milestoneRemaining} ${progress.milestoneRemaining === 1 ? "week" : "weeks"} to your ${progress.nextMilestone}-week milestone`}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div id={detailsId} className="weekly-momentum-details border-t border-grit pt-3">
          <p className="text-xs leading-relaxed text-grit-dim">
            One completed training day keeps a week active. Weeks run Monday–Sunday; the current
            week stays open. Rest days do not break this streak. Your plan target is separate from
            your streak.
          </p>
          <p className="label-cap mt-4 mb-2 text-[10px] text-grit-dim">EXPLORE YOUR LAST 8 WEEKS</p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Training week history">
            {progress.weeks.map((week) => (
              <button
                key={week.start}
                type="button"
                aria-pressed={week.start === selected.start}
                aria-controls={weekId}
                aria-label={`Week of ${dateLabel(week.start)}: ${week.dates.length} training days${week.current ? ", current week" : ""}`}
                onClick={() => {
                  hapticSelection();
                  setSelectedStart(week.start);
                }}
                className={`min-h-[64px] min-w-0 rounded-xl border px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-accent-red ${week.start === selected.start ? "border-accent-red bg-accent-red/10" : "border-grit bg-black/20"}`}
              >
                <span className="block text-[10px] text-grit-dim">
                  {week.current ? "This week" : dateLabel(week.start)}
                </span>
                <span
                  className={`mt-1 block text-lg font-bold ${week.dates.length ? "text-accent-red" : "text-grit-dim"}`}
                >
                  {week.dates.length}
                </span>
              </button>
            ))}
          </div>
          <div
            id={weekId}
            role="status"
            className="mt-3 rounded-xl border border-grit bg-black/20 p-3"
          >
            <p className="text-xs font-bold text-grit">
              {dateLabel(selected.start)} – {dateLabel(selected.end)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-grit-dim">
              {selected.dates.length
                ? `Trained on ${selected.dates.map(dateLabel).join(", ")}.`
                : selected.current
                  ? "No training days logged yet. This week is still open."
                  : "No training days logged this week."}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <Trophy size={13} className="text-accent-red" />
            <p className="label-cap text-[10px]">YOUR MILESTONES</p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {WEEK_MILESTONES.map((weeks) => {
              const earned = progress.achievedMilestones.includes(weeks);
              return (
                <div
                  key={weeks}
                  className={`rounded-xl border p-2 text-center ${earned ? "border-accent-red/40 bg-accent-red/10 text-grit" : "border-grit text-grit-dim"}`}
                >
                  <span className="block text-sm font-bold">{weeks} weeks</span>
                  <span className="text-[10px]">{earned ? "Earned ✓" : "To unlock"}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-grit-dim">
            Earned badges use your longest run. They stay earned when you take a break.
          </p>
          <Link
            to="/plan"
            onClick={() => hapticSelection()}
            className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-grit bg-white/5 px-3 text-sm font-bold text-grit"
          >
            {target ? "Review my training week" : "Build my training week"}
          </Link>
          <Link
            to="/progress"
            onClick={() => hapticSelection()}
            className="mt-1 flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-bold text-grit-dim"
          >
            See my workout history
          </Link>
        </div>
      )}
      {goalDays !== null && goalDays >= 0 && (
        <div className="mt-3 flex items-start gap-2 border-t border-grit pt-3">
          <Target size={14} className="mt-0.5 shrink-0 text-accent-red" />
          <div className="min-w-0">
            <p className="break-words text-xs text-grit">
              {state.profile?.dreamOutcome || "Your locked-in goal"}
            </p>
            <p className="mt-1 text-[11px] text-grit-dim">
              {goalDays === 0
                ? "Your goal date is today"
                : `${goalDays} ${goalDays === 1 ? "day" : "days"} to your goal date`}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
