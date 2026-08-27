import { describe, expect, it } from "vitest";

import { mirrorPath } from "./mirror-path";

describe("mirrorPath", () => {
  it("reflects the absolute start about the axis", () => {
    expect(mirrorPath("M60 90 z")).toBe("M 140 90 z");
  });

  it("negates horizontal deltas and leaves vertical ones alone", () => {
    expect(mirrorPath("M60 90 l10 20 z")).toBe("M 140 90 l -10 20 z");
    expect(mirrorPath("M60 90 h12 z")).toBe("M 140 90 h -12 z");
    expect(mirrorPath("M60 90 v12 z")).toBe("M 140 90 v 12 z");
  });

  it("reflects both control point and endpoint of a quadratic", () => {
    expect(mirrorPath("M60 90 q-14 6 -17 25 z")).toBe("M 140 90 q 14 6 17 25 z");
  });

  it("round-trips back to the original geometry", () => {
    // Compare the numbers, not the spacing — the output is re-serialised.
    const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const original = "M64 90 q-14 6 -17 25 l-9 96 q-3 24 1 44 h4 v10 z";
    expect(numbers(mirrorPath(mirrorPath(original)))).toEqual(numbers(original));
  });

  it("keeps the same number of coordinates", () => {
    const count = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).length;
    const original = "M60 90 l20 10 l-5 20 z";
    expect(count(mirrorPath(original))).toBe(count(original));
  });

  it("refuses a command it cannot reflect rather than mangling it", () => {
    // An arc's flags and radii do not reflect by negation; silently passing it
    // through would produce a plausible-looking wrong shape.
    expect(() => mirrorPath("M60 90 a19 19 0 1 0 38 0 z")).toThrow(/unsupported/);
  });
});
