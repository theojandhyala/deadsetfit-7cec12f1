import type { DayKey } from "@/lib/types";
import { WEEK } from "@/lib/calc";
import { DAY_FULL, DAY_LETTER, MAX_TRAINING_DAYS } from "@/lib/training-days";
import { hapticSelection } from "@/lib/haptics";

/**
 * A row of seven day toggles. Used both in onboarding and in the Train tab so a
 * lifter changes their week the same way in either place.
 */
export function WeekdayPicker({
  value,
  onChange,
  disabled,
}: {
  value: DayKey[];
  onChange: (days: DayKey[]) => void;
  disabled?: boolean;
}) {
  function toggle(day: DayKey) {
    hapticSelection();
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
    // Keep the list in week order so callers never have to sort it themselves.
    onChange(WEEK.filter((d) => next.includes(d)));
  }

  return (
    <div className="flex gap-1.5" role="group" aria-label="Training days">
      {WEEK.map((day) => {
        const active = value.includes(day);
        const atMax = !active && value.length >= MAX_TRAINING_DAYS;
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            disabled={disabled || atMax}
            aria-pressed={active}
            aria-label={DAY_FULL[day]}
            className="flex-1 rounded-2xl border py-3 press disabled:opacity-30 transition-colors"
            style={{
              borderColor: active ? "#e63222" : "#262626",
              background: active ? "rgba(230,50,34,0.16)" : "#141414",
            }}
          >
            <span
              className="display text-lg font-extrabold"
              style={{ color: active ? "#f5f5f0" : "#8a8a8a" }}
            >
              {DAY_LETTER[day]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
