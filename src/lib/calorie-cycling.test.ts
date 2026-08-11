import { describe, it, expect } from "vitest";

import { calorieCycle } from "./calorie-cycling";
import type { DayKey } from "./types";

const MWF: DayKey[] = ["MON", "WED", "FRI"];

describe("calorieCycle", () => {
  it("returns null without a target or a mixed week", () => {
    expect(calorieCycle(0, MWF, "2026-07-27")).toBeNull();
    expect(calorieCycle(2500, [], "2026-07-27")).toBeNull();
    expect(
      calorieCycle(2500, ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], "2026-07-27"),
    ).toBeNull();
  });

  it("gives training days more and rest days less", () => {
    const training = calorieCycle(2500, MWF, "2026-07-27")!; // a Monday
    const rest = calorieCycle(2500, MWF, "2026-07-28")!; // a Tuesday
    expect(training.kind).toBe("TRAINING");
    expect(rest.kind).toBe("REST");
    expect(training.todayTarget).toBeGreaterThan(2500);
    expect(rest.todayTarget).toBeLessThan(2500);
    expect(training.delta).toBeGreaterThan(0);
    expect(rest.delta).toBeLessThan(0);
  });

  it("preserves the weekly average (within rounding)", () => {
    const c = calorieCycle(2500, MWF, "2026-07-27")!;
    const weekly = 3 * c.trainingTarget + 4 * c.restTarget;
    expect(Math.abs(weekly - 7 * 2500)).toBeLessThanOrEqual(70); // 10 kcal rounding × 7
  });

  it("scales the split with the number of training days", () => {
    // 6 training days: small bump each, big rest-day cut.
    const six = calorieCycle(2500, ["MON", "TUE", "WED", "THU", "FRI", "SAT"], "2026-07-27")!;
    const three = calorieCycle(2500, MWF, "2026-07-27")!;
    expect(six.trainingTarget - 2500).toBeLessThan(three.trainingTarget - 2500);
    expect(2500 - six.restTarget).toBeGreaterThan(2500 - three.restTarget);
  });
});
