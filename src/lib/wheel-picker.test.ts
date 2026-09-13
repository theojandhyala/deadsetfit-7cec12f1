import { describe, expect, it } from "vitest";

import {
  snapToWheel,
  wheelIndexAtOffset,
  wheelIndexOf,
  wheelRowDepth,
  wheelValues,
} from "./wheel-picker";

describe("wheelValues", () => {
  it("covers the range inclusively", () => {
    expect(wheelValues({ min: 13, max: 16, step: 1 })).toEqual([13, 14, 15, 16]);
  });

  it("does not let half-step accumulation leak float noise into the labels", () => {
    // Repeated addition of 0.5 drifts; a lifter scrolling to 87.5 kg must not
    // be shown 87.50000000000006.
    const values = wheelValues({ min: 30, max: 250, step: 0.5 });
    expect(values).toContain(87.5);
    expect(values.every((value) => String(value).length <= 5)).toBe(true);
    expect(values.at(-1)).toBe(250);
  });
});

describe("snapToWheel", () => {
  const range = { min: 30, max: 250, step: 0.5 };

  it("clamps outside values onto the wheel", () => {
    expect(snapToWheel(-10, range)).toBe(30);
    expect(snapToWheel(9999, range)).toBe(250);
  });

  it("snaps to the nearest step", () => {
    expect(snapToWheel(80.3, range)).toBe(80.5);
    expect(snapToWheel(80.2, range)).toBe(80);
  });

  it("falls back to the low end rather than emitting NaN", () => {
    expect(snapToWheel(Number.NaN, range)).toBe(30);
  });
});

describe("wheel offsets", () => {
  it("maps a value to its row and back", () => {
    const range = { min: 120, max: 230, step: 1 };
    expect(wheelIndexOf(180, range)).toBe(60);
    expect(wheelIndexAtOffset(60 * 44, 44, 111)).toBe(60);
  });

  it("clamps an overscrolled offset to a real row", () => {
    expect(wheelIndexAtOffset(-40, 44, 10)).toBe(0);
    expect(wheelIndexAtOffset(99999, 44, 10)).toBe(9);
  });

  it("measures distance from the centred row", () => {
    expect(wheelRowDepth(58, 60)).toBe(2);
    expect(wheelRowDepth(60, 60)).toBe(0);
  });
});
