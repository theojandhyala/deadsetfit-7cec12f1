import { describe, expect, it } from "vitest";
import { effectiveRestSeconds } from "./workout-flow";

describe("auto-rest preference", () => {
  it("honours global off even with an exercise override", () => {
    expect(effectiveRestSeconds(0, 90)).toBe(0);
  });
  it("honours an individual exercise with no rest", () => {
    expect(effectiveRestSeconds(90, 0)).toBe(0);
  });
  it("uses the override or falls back to the global interval", () => {
    expect(effectiveRestSeconds(90, 120)).toBe(120);
    expect(effectiveRestSeconds(90)).toBe(90);
  });
  it("rejects invalid and negative intervals", () => {
    expect(effectiveRestSeconds(NaN)).toBe(0);
    expect(effectiveRestSeconds(90, Infinity)).toBe(0);
    expect(effectiveRestSeconds(90, -2)).toBe(0);
  });
});
