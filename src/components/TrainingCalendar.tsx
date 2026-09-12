import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { defaultSchedule, isoDay } from "@/lib/calc";
import {
  calendarDate,
  calendarHistory,
  calendarRange,
  CALENDAR_DAYS,
  daysBetween,
  monthCells,
  movePeriod,
  plannedWorkout,
  weekday,
  type CalendarScale,
} from "@/lib/training-calendar";
import type { AppState, DayKey, Schedule } from "@/lib/types";

const COLOURS = [
  "rgba(255,255,255,.055)",
  "rgba(230,50,34,.38)",
  "rgba(230,50,34,.58)",
  "rgba(230,50,34,.8)",
  "#e63222",
];
const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(calendarDate(date)!);
const SCALES: CalendarScale[] = ["week", "month", "year", "all"];
const LABELS = { week: "Week", month: "Month", year: "Year", all: "All time" };

export function TrainingCalendar({
  state,
  schedule: suppliedSchedule,
  onEditDay,
}: {
  state: AppState;
  schedule?: Schedule | null;
  onEditDay?: (day: DayKey) => void;
}) {
  const today = isoDay();
  const [scale, setScale] = useState<CalendarScale>("month");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(today);
  const history = useMemo(
    () => calendarHistory(state.sessions, state.completedDates, today),
    [state.sessions, state.completedDates, today],
  );
  const schedule = useMemo(() => {
    if (suppliedSchedule !== undefined) return suppliedSchedule;
    const program = state.programs?.find((p) => p.id === state.activeProgramId);
    if (program)
      return Object.fromEntries(
        CALENDAR_DAYS.map((day) => [
          day,
          {
            label: program.days[day]?.label ?? "REST",
            exerciseIds: program.days[day]?.items.map((i) => i.id) ?? [],
          },
        ]),
      ) as Schedule;
    return state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
  }, [suppliedSchedule, state.programs, state.activeProgramId, state.schedule, state.profile]);
  const range = calendarRange(anchor, scale === "all" ? "year" : scale);
  const visible = Array.from(history.values()).filter(
    (d) => scale === "all" || (d.date >= range.start && d.date <= range.end),
  );
  const volume = visible.reduce((sum, day) => sum + day.volume, 0);
  const unit = state.units === "lb" ? "lb" : "kg";
  const volumeText = (value: number) =>
    Math.round(value * (unit === "lb" ? 2.2046226218 : 1)).toLocaleString("en-GB");
  const years = Array.from(
    new Set([today.slice(0, 4), ...Array.from(history.keys(), (d) => d.slice(0, 4))]),
  )
    .sort()
    .reverse();
  const title =
    scale === "all"
      ? "Your training history"
      : scale === "year"
        ? anchor.slice(0, 4)
        : scale === "month"
          ? formatDate(anchor, { month: "long", year: "numeric" })
          : `${formatDate(range.start, { day: "numeric", month: "short" })} – ${formatDate(range.end, { day: "numeric", month: "short", year: "numeric" })}`;
  const changeScale = (next: CalendarScale) => {
    setScale(next);
    setSelected(null);
  };
  const navigate = (direction: number) => {
    if (scale !== "all") setAnchor(movePeriod(anchor, scale, direction));
    setSelected(null);
  };
  const dayStyle = (date: string) => ({
    background: COLOURS[history.get(date)?.level ?? 0],
    border: `1px ${plannedWorkout(date, today, schedule) && !history.has(date) ? "dashed #e63222" : "solid transparent"}`,
  });
  const status = (date: string) =>
    history.has(date)
      ? "Completed"
      : plannedWorkout(date, today, schedule)
        ? "Planned"
        : date > today
          ? "Rest / unplanned"
          : "No logged workout";
  const selectedHistory = selected ? history.get(selected) : null;
  const selectedPlan = selected ? plannedWorkout(selected, today, schedule) : null;

  function dateButton(date: string, week = false) {
    return (
      <button
        key={date}
        type="button"
        onClick={() => setSelected(date)}
        aria-pressed={selected === date}
        aria-current={date === today ? "date" : undefined}
        aria-label={`${formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}: ${status(date)}`}
        className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${selected === date ? "ring-2 ring-white" : date === today ? "ring-1 ring-white/60" : ""}`}
        style={dayStyle(date)}
      >
        {week && (
          <span className="mb-1 text-[9px] font-medium text-white/70">
            {weekday(date).slice(0, 1)}
          </span>
        )}
        <span>{Number(date.slice(-2))}</span>
        {history.has(date) && (
          <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-white" />
        )}
      </button>
    );
  }

  return (
    <section
      aria-label="Training calendar"
      className="min-w-0 rounded-2xl border border-grit bg-grit-card p-4 text-grit"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="label-cap text-[10px] text-accent-red">The work adds up</p>
          <h2 className="display text-2xl font-extrabold uppercase">Training calendar</h2>
        </div>
        <button
          type="button"
          className="min-h-11 px-2 text-xs font-bold text-accent-red"
          onClick={() => {
            setAnchor(today);
            setSelected(today);
            if (scale === "all") setScale("month");
          }}
        >
          Today
        </button>
      </div>
      <div
        role="group"
        aria-label="Calendar scale"
        className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-black/30 p-1"
      >
        {SCALES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scale === s}
            onClick={() => changeScale(s)}
            className={`min-h-11 rounded-lg px-1 text-xs font-bold ${scale === s ? "bg-accent-red text-white" : "text-grit-dim"}`}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>
      <div className="mb-4 flex min-h-11 items-center justify-between gap-1">
        {scale !== "all" && (
          <button
            type="button"
            aria-label={`Previous ${scale}`}
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <h3 aria-live="polite" className="min-w-0 flex-1 text-center text-sm font-bold">
          {title}
        </h3>
        {scale !== "all" && (
          <button
            type="button"
            aria-label={`Next ${scale}`}
            onClick={() => navigate(1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/20 p-3">
          <b className="display text-2xl">{visible.length}</b>
          <p className="text-[10px] text-grit-dim">Training days</p>
        </div>
        <div className="rounded-xl bg-black/20 p-3">
          <b className="display text-2xl">{volumeText(volume)}</b>
          <p className="text-[10px] text-grit-dim">Volume · {unit}</p>
        </div>
      </div>
      {scale === "week" && (
        <div className="grid grid-cols-7 gap-1">
          {daysBetween(range.start, range.end).map((d) => dateButton(d, true))}
        </div>
      )}
      {scale === "month" && (
        <>
          <div className="mb-2 grid grid-cols-7 text-center text-[10px] text-grit-dim">
            {CALENDAR_DAYS.map((d) => (
              <span key={d}>{d.slice(0, 1)}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells(anchor).map((d, i) => (d ? dateButton(d) : <span key={`empty-${i}`} />))}
          </div>
        </>
      )}
      {scale === "year" && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from(
            { length: 12 },
            (_, i) => `${anchor.slice(0, 4)}-${String(i + 1).padStart(2, "0")}-01`,
          ).map((month) => (
            <button
              key={month}
              type="button"
              aria-label={`Open ${formatDate(month, { month: "long", year: "numeric" })}`}
              onClick={() => {
                setAnchor(month);
                setScale("month");
                setSelected(null);
              }}
              className="min-w-0 rounded-lg bg-black/20 p-2 text-left"
            >
              <span className="mb-2 block text-[10px] font-bold">
                {formatDate(month, { month: "short" })}
              </span>
              <span aria-hidden="true" className="grid grid-cols-7 gap-px">
                {monthCells(month).map((d, i) => (
                  <span
                    key={i}
                    className="aspect-square rounded-[1px]"
                    style={d ? dayStyle(d) : undefined}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
      {scale === "all" && (
        <div className="space-y-4">
          {years.map((year) => {
            const start = `${year}-01-01`,
              end = `${year}-12-31`;
            const cells: Array<string | null> = [
              ...Array.from({ length: (calendarDate(start)!.getUTCDay() + 6) % 7 }, () => null),
              ...daysBetween(start, end),
            ];
            return (
              <button
                key={year}
                type="button"
                aria-label={`Open ${year} training history`}
                onClick={() => {
                  setAnchor(start);
                  setScale("year");
                  setSelected(null);
                }}
                className="block w-full min-w-0 rounded-xl bg-black/20 p-3 text-left"
              >
                <span className="mb-2 flex items-center justify-between">
                  <b className="display text-xl">{year}</b>
                  <span className="text-[10px] text-grit-dim">
                    {Array.from(history.keys()).filter((d) => d.startsWith(year)).length} training
                    days
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="grid gap-px"
                  style={{
                    gridTemplateRows: "repeat(7, minmax(0, 1fr))",
                    gridAutoFlow: "column",
                    gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)}, minmax(0, 1fr))`,
                  }}
                >
                  {cells.map((d, i) => (
                    <span
                      key={i}
                      className="aspect-square rounded-[1px]"
                      style={{
                        background: d ? COLOURS[history.get(d)?.level ?? 0] : "transparent",
                      }}
                    />
                  ))}
                </span>
                <span className="mt-2 flex justify-between text-[8px] text-grit-dim">
                  <span>Jan</span>
                  <span>Apr</span>
                  <span>Jul</span>
                  <span>Oct</span>
                  <span>Dec</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] text-grit-dim">
        <span>■ Completed</span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2.5 w-2.5 rounded-sm border border-dashed border-accent-red" />
          Planned
        </span>
        <span className="inline-flex items-center gap-1">
          Volume{" "}
          {COLOURS.slice(1).map((c) => (
            <i key={c} className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
          ))}
        </span>
      </div>
      {scale !== "all" && (
        <p className="mt-2 text-[10px] leading-relaxed text-grit-dim">
          Planned days repeat your current weekly plan. Past days show completed records only.
        </p>
      )}
      {visible.length === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-grit-dim">
          No completed workouts in this view yet. Finish a session to add it to your history.
        </p>
      )}
      {selected && scale !== "year" && scale !== "all" && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3" aria-live="polite">
          <p className="text-sm font-bold">
            {formatDate(selected, { weekday: "long", day: "numeric", month: "short" })}
          </p>
          <p className="mt-1 text-xs text-accent-red">{status(selected)}</p>
          {selectedHistory ? (
            <>
              <p className="mt-2 text-xs text-grit-dim">
                {selectedHistory.sessions.length
                  ? `${selectedHistory.sessions.length} logged session${selectedHistory.sessions.length === 1 ? "" : "s"} · ${volumeText(selectedHistory.volume)} ${unit}`
                  : "Marked complete. No session details recorded."}
              </p>
              {selectedHistory.sessions.map((s) => (
                <p key={s.id} className="mt-2 break-words text-sm">
                  {s.label || "Workout"}
                </p>
              ))}
            </>
          ) : selectedPlan ? (
            <p className="mt-2 break-words text-sm">
              {selectedPlan.label} · {selectedPlan.exerciseIds.length} exercises
            </p>
          ) : (
            <p className="mt-2 text-xs text-grit-dim">
              {selected < today
                ? "No completed workout recorded for this day."
                : "Rest day or no workout planned."}
            </p>
          )}
          {onEditDay && selected >= today && (
            <button
              type="button"
              className="mt-2 min-h-11 text-xs font-bold text-accent-red"
              onClick={() => onEditDay(weekday(selected))}
            >
              Edit {formatDate(selected, { weekday: "long" })}’s weekly plan →
            </button>
          )}
        </div>
      )}
    </section>
  );
}
