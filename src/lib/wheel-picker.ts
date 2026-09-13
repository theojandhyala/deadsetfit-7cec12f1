/** Pure geometry for the scroll-snap wheel picker, kept out of the component so it can be tested. */

export interface WheelRange {
  min: number;
  max: number;
  step: number;
}

/** Every selectable value on the wheel, low to high. */
export function wheelValues({ min, max, step }: WheelRange): number[] {
  if (step <= 0 || max < min) return [min];
  const out: number[] = [];
  // Built by index rather than by repeated addition: accumulating 0.5 two
  // hundred times drifts into 87.50000000000006 and the label renders that.
  const count = Math.floor((max - min) / step + 1e-9);
  for (let i = 0; i <= count; i += 1) out.push(round(min + i * step, step));
  return out;
}

/** Snap an arbitrary value onto the wheel, clamped to its ends. */
export function snapToWheel(value: number, range: WheelRange): number {
  const { min, max, step } = range;
  if (!Number.isFinite(value)) return min;
  if (value <= min) return min;
  if (value >= max) return round(min + Math.floor((max - min) / step + 1e-9) * step, step);
  return round(min + Math.round((value - min) / step) * step, step);
}

/** Index of a value on the wheel — the scroll offset is this times the row height. */
export function wheelIndexOf(value: number, range: WheelRange): number {
  const snapped = snapToWheel(value, range);
  return Math.round((snapped - range.min) / range.step);
}

/** Which row a scroll offset is currently centred on. */
export function wheelIndexAtOffset(scrollTop: number, rowHeight: number, count: number): number {
  if (rowHeight <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollTop / rowHeight)));
}

/** Distance from the centred row, used to fade and shrink the rows either side. */
export function wheelRowDepth(index: number, activeIndex: number): number {
  return Math.abs(index - activeIndex);
}

function round(value: number, step: number): number {
  // One decimal is enough for every wheel we ship (0.5 kg is the finest step).
  const decimals = step < 1 ? 1 : 0;
  return Number(value.toFixed(decimals));
}
