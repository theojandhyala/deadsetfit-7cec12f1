import { describe, expect, it } from "vitest";

import { BAR_TYPES, barLabel, barTypeForKg, usesBarbell } from "./bars";
import { plateBreakdown } from "./calc";

describe("bar types", () => {
  it("resolves a weight back to its bar", () => {
    expect(barTypeForKg(15)?.id).toBe("womens");
    expect(barTypeForKg(10)?.id).toBe("ez");
    expect(barTypeForKg(undefined)).toBeUndefined();
  });

  it("labels an unambiguous bar by name", () => {
    expect(barLabel(10)).toBe("EZ curl bar");
    expect(barLabel(0)).toBe("No bar");
  });

  it("falls back to the weight when two bars share it", () => {
    // Trap and safety squat are both 25 kg — claiming either would be a guess.
    expect(BAR_TYPES.filter((bar) => bar.kg === 25)).toHaveLength(2);
    expect(barLabel(25)).toBe("25 kg bar");
  });

  it("defaults to the Olympic bar when nothing is set", () => {
    expect(barLabel(undefined)).toBe("Olympic bar");
  });
});

describe("usesBarbell", () => {
  it("recognises barbell movements", () => {
    expect(usesBarbell("Bench Press")).toBe(true);
    expect(usesBarbell("Barbell Row")).toBe(true);
    expect(usesBarbell("Romanian Deadlift")).toBe(true);
  });

  it("rejects movements with no bar to load", () => {
    expect(usesBarbell("Cable Fly")).toBe(false);
    expect(usesBarbell("Dumbbell Press")).toBe(false);
    expect(usesBarbell("Lateral Raise")).toBe(false);
    expect(usesBarbell("Leg Press")).toBe(false);
    expect(usesBarbell("Pull Ups")).toBe(false);
  });

  it("does not treat a dumbbell press as a barbell movement", () => {
    // "press" matches the barbell list, so the exclusion has to win.
    expect(usesBarbell("Incline Dumbbell Press")).toBe(false);
  });
});

describe("plate maths against a real bar", () => {
  it("loads a trap bar from its own weight, not the Olympic default", () => {
    const olympic = plateBreakdown(100, 20);
    const trap = plateBreakdown(100, 25);
    expect(olympic?.perSide).toEqual([25, 15]);
    expect(trap?.perSide).toEqual([25, 10, 2.5]);
  });

  it("reports nothing when the target is under the bar itself", () => {
    expect(plateBreakdown(20, 25)).toBeNull();
  });

  it("handles a bar-only set", () => {
    expect(plateBreakdown(25, 25)).toMatchObject({ perSide: [], remainderKg: 0, barKg: 25 });
  });
});
