import { useEffect, useRef } from "react";
import { WEEK } from "@/lib/calc";
import { DAY_FULL } from "@/lib/training-days";
import { hapticSelection } from "@/lib/haptics";
import type { DayKey } from "@/lib/types";

/** Only the day rail scrolls sideways; the surrounding home screen stays fixed. */
export function TrainDayPicker({
  selectedDay,
  today,
  labels,
  onSelect,
}: {
  selectedDay: DayKey;
  today: DayKey;
  labels: Partial<Record<DayKey, string>>;
  onSelect: (day: DayKey) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);

  useEffect(() => {
    const container = rail.current;
    const selected = container?.querySelector<HTMLButtonElement>(`[data-day="${selectedDay}"]`);
    if (!container || !selected) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      left: selected.offsetLeft - (container.clientWidth - selected.offsetWidth) / 2,
      behavior: positioned.current && !reduceMotion ? "smooth" : "instant",
    });
    positioned.current = true;
  }, [selectedDay]);

  return (
    <div className="mt-4 min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-grit-dim">
        <span className="label-cap">Your week</span>
        <span>Swipe to see days ↔</span>
      </div>
      <div
        ref={rail}
        role="group"
        aria-label="Choose a training day"
        className="relative flex w-full min-w-0 max-w-full snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-2 pt-1"
      >
        {WEEK.map((day) => {
          const active = day === selectedDay;
          const isToday = day === today;
          const label = labels[day]?.split(" — ")[0] || "REST";
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              aria-pressed={active}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${DAY_FULL[day]}${isToday ? ", today" : ""}: ${label}`}
              onClick={() => {
                if (active) return;
                hapticSelection();
                onSelect(day);
              }}
              className={`deadset-day-chip w-[104px] min-w-[104px] shrink-0 snap-center rounded-2xl border px-3 py-3 text-center press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${active ? "deadset-day-chip-active" : ""}`}
              style={{
                borderColor: active ? "#e63222" : "rgba(255,255,255,.10)",
                background: active ? "rgba(230,50,34,.16)" : "rgba(0,0,0,.30)",
              }}
            >
              <span
                className="label-cap block text-[10px]"
                style={{ color: isToday ? "#e63222" : "#8a8a8a" }}
              >
                {DAY_FULL[day].slice(0, 3)}
              </span>
              <span className="mt-1 block break-words text-[11px] font-black uppercase text-grit">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
