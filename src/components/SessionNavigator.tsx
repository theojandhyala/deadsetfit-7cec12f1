import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Clock3, Link2, ListPlus, Search, X } from "lucide-react";
import type { WorkoutSessionExercise } from "@/lib/types";
import { hapticSelection } from "@/lib/haptics";
import {
  formatSessionClock,
  nextUnfinishedExercise,
  sessionElapsedSeconds,
  sessionNavigator,
} from "@/lib/session-navigator";

/** Only this small leaf renders on the clock; the logger and history do not. */
export function SessionClock({ startedAt }: { startedAt: string }) {
  const [seconds, setSeconds] = useState(() => sessionElapsedSeconds(startedAt));
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setSeconds(sessionElapsedSeconds(startedAt));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [startedAt]);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold tabular-nums text-grit-dim"
      aria-label={`Session elapsed ${formatSessionClock(seconds)}`}
    >
      <Clock3 size={12} aria-hidden="true" />
      {formatSessionClock(seconds)}
    </span>
  );
}

export function SessionNavigator({
  exercises,
  activeIndex,
  startedAt,
  onSelect,
  onManage,
}: {
  exercises: WorkoutSessionExercise[];
  activeIndex: number;
  startedAt: string;
  onSelect: (index: number) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [unfinished, setUnfinished] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const summary = useMemo(() => sessionNavigator(exercises), [exercises]);
  const next = useMemo(
    () => nextUnfinishedExercise(exercises, activeIndex),
    [exercises, activeIndex],
  );
  const visible = summary.rows.filter(
    (row) =>
      (!unfinished || row.remaining > 0) &&
      row.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function select(index: number) {
    hapticSelection();
    onSelect(index);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }
  return (
    <section
      className="border-b border-grit bg-[linear-gradient(145deg,#1b1111,#0e0e10)] px-4 py-3"
      aria-label="Session navigator"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="label-cap text-[9px] text-grit-dim">
          {summary.remaining
            ? `${summary.remaining} working sets left`
            : summary.planned
              ? "Planned work complete"
              : "Your session"}
        </span>
        <SessionClock startedAt={startedAt} />
      </div>
      <div className="flex min-w-0 gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            hapticSelection();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-controls={panelId}
          className="press flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[.025] px-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-black uppercase tracking-wider text-accent-red">
              Session overview · {summary.finishedExercises}/{exercises.length} done
            </span>
            <span className="block truncate text-xs font-bold text-grit">
              {exercises[activeIndex]?.name ?? "Choose a movement"}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            hapticSelection();
            onManage();
          }}
          className="press grid min-h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 text-grit-dim"
          aria-label="Edit session exercises"
        >
          <ListPlus size={19} />
        </button>
      </div>
      {next !== null && next !== activeIndex && (
        <button
          type="button"
          onClick={() => select(next)}
          className="press mt-1 flex min-h-11 w-full items-center justify-between gap-2 text-left text-[11px] font-bold text-grit-dim"
        >
          <span className="min-w-0 truncate">Next unfinished · {exercises[next].name}</span>
          <ChevronRight size={15} className="shrink-0 text-accent-red" />
        </button>
      )}
      <div
        id={panelId}
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
          }
        }}
      >
        {open && (
          <div className="deadset-view-switch mt-3">
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3">
              <Search size={14} className="shrink-0 text-grit-dim" />
              <input
                ref={searchRef}
                type="search"
                defaultValue={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Find a movement"
                aria-label="Find a session movement"
                className="min-w-0 flex-1 bg-transparent py-2 text-base text-grit outline-none"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear movement search"
                  className="grid min-h-11 min-w-11 place-items-center text-grit-dim"
                  onClick={() => {
                    hapticSelection();
                    setQuery("");
                    if (searchRef.current) {
                      searchRef.current.value = "";
                      searchRef.current.focus();
                    }
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <button
              type="button"
              aria-pressed={unfinished}
              onClick={() => {
                hapticSelection();
                setUnfinished((v) => !v);
              }}
              className={`press my-2 min-h-11 rounded-lg border px-3 text-[10px] font-bold ${unfinished ? "border-accent-red text-accent-red" : "border-white/10 text-grit-dim"}`}
            >
              Unfinished only
            </button>
            <ol
              className="no-scrollbar max-h-64 space-y-1 overflow-y-auto overscroll-contain"
              aria-label="Session movements"
            >
              {visible.map((row) => (
                <li key={row.index}>
                  <button
                    type="button"
                    onClick={() => select(row.index)}
                    aria-current={row.index === activeIndex ? "step" : undefined}
                    className={`press flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left ${row.index === activeIndex ? "border-accent-red/50 bg-accent-red/8" : "border-transparent bg-white/[.025]"}`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${row.done ? "bg-green-500/15 text-green-400" : "bg-white/5 text-grit-dim"}`}
                    >
                      {row.done ? <Check size={15} /> : row.index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-xs font-bold text-grit">
                        {row.name}
                      </span>
                      <span className="mt-1 block text-[10px] text-grit-dim">
                        {row.done ? "Complete" : row.started ? "In progress" : "Not started"}
                        {row.superset && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Link2 size={10} />
                            Superset
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-grit-dim">
                      {row.completed}/{row.planned}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {visible.length === 0 && (
              <p role="status" className="py-4 text-center text-xs text-grit-dim">
                {query.trim()
                  ? "No matching movements. Try another name."
                  : "No unfinished planned sets."}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
