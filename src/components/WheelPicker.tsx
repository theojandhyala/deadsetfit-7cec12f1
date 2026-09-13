import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { hapticSelection } from "@/lib/haptics";
import {
  snapToWheel,
  wheelIndexAtOffset,
  wheelIndexOf,
  wheelRowDepth,
  wheelValues,
  type WheelRange,
} from "@/lib/wheel-picker";

const ROW_HEIGHT = 46;
const VISIBLE_ROWS = 5;

interface WheelPickerProps extends WheelRange {
  value: number;
  onChange: (value: number) => void;
  suffix: string;
  /** Extra read-out under the number, e.g. the same height in feet and inches. */
  secondary?: (value: number) => string;
  label: string;
}

/**
 * A native-feeling vertical wheel.
 *
 * Built on scroll snapping rather than a drag handler so it inherits iOS
 * momentum, rubber-banding and VoiceOver scrolling for free. The selection is
 * read from the scroll offset; the arrow buttons exist so the control is still
 * operable from a keyboard and by anyone who cannot flick precisely.
 */
export function WheelPicker({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  secondary,
  label,
}: WheelPickerProps) {
  const range = useMemo(() => ({ min, max, step }), [min, max, step]);
  const values = useMemo(() => wheelValues(range), [range]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(() => wheelIndexOf(value, range));
  // Set by the scroll handler so the effect below does not fight the athlete's
  // finger by scrolling the list back to a value it just reported.
  const settlingRef = useRef(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list || settlingRef.current) return;
    const index = wheelIndexOf(value, range);
    setActive(index);
    list.scrollTo({ top: index * ROW_HEIGHT, behavior: "auto" });
  }, [value, range]);

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const index = wheelIndexAtOffset(list.scrollTop, ROW_HEIGHT, values.length);
    if (index === active) return;
    settlingRef.current = true;
    setActive(index);
    hapticSelection();
    onChange(values[index]);
    // Released on the next frame: long enough that the controlled `value`
    // round-trip lands first, short enough that an external reset still works.
    requestAnimationFrame(() => {
      settlingRef.current = false;
    });
  }, [active, onChange, values]);

  function nudge(delta: number) {
    const index = Math.min(values.length - 1, Math.max(0, active + delta));
    if (index === active) return;
    hapticSelection();
    onChange(values[index]);
  }

  const current = values[active] ?? snapToWheel(value, range);
  const pad = ((VISIBLE_ROWS - 1) / 2) * ROW_HEIGHT;

  return (
    <div className="deadset-wheel">
      <div className="deadset-wheel-readout" aria-hidden="true">
        <span className="deadset-wheel-readout-value">{current}</span>
        <span className="deadset-wheel-readout-suffix">{suffix}</span>
      </div>
      {secondary && (
        <p className="deadset-wheel-secondary" aria-hidden="true">
          {secondary(current)}
        </p>
      )}

      <div className="deadset-wheel-track">
        <div className="deadset-wheel-selection" aria-hidden="true" />
        <div
          ref={listRef}
          className="deadset-wheel-list no-scrollbar"
          onScroll={handleScroll}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-valuetext={`${current} ${suffix}`}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
              event.preventDefault();
              nudge(-1);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowRight") {
              event.preventDefault();
              nudge(1);
            }
          }}
          style={{ height: VISIBLE_ROWS * ROW_HEIGHT }}
        >
          <div style={{ height: pad }} aria-hidden="true" />
          {values.map((entry, index) => {
            const depth = wheelRowDepth(index, active);
            return (
              <div
                key={entry}
                className="deadset-wheel-row"
                style={{
                  height: ROW_HEIGHT,
                  opacity: depth === 0 ? 1 : Math.max(0.16, 0.62 - depth * 0.18),
                  transform: `scale(${depth === 0 ? 1 : Math.max(0.74, 1 - depth * 0.1)})`,
                  color: depth === 0 ? "#f5f5f0" : "#8a8a8a",
                }}
              >
                {entry}
              </div>
            );
          })}
          <div style={{ height: pad }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
