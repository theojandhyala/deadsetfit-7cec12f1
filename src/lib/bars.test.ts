import { describe, expect, it } from "vitest";

import { BAR_TYPES, barLabel, barTypeForKg, barTypes, usesBarbell } from "./bars";
import { toKg } from "./units";
import { plateBreakdown } from "./calc";

describe("bar types", () => {
  it("resolves a weight back to its bar", () => {
    expect(barTypeForKg(15)?.id).toBe("womens");
    expect(barTypeForKg(10)?.id).toBe("ez");
    expect(barTypeForKg(undefined)).toBeUndefined();
  });

  it("labels an unambiguous bar by name", () => {
    expect(barLabel(10, "kg")).toBe("EZ curl bar");
    expect(barLabel(0, "kg")).toBe("No bar");
  });

  it("falls back to the weight when two bars share it", () => {
    // Trap and safety squat are both 25 kg — claiming either would be a guess.
    expect(BAR_TYPES.filter((bar) => bar.kg === 25)).toHaveLength(2);
    expect(barLabel(25, "kg")).toBe("25 kg bar");
    expect(barLabel(25, "lb")).toBe("55 lb bar");
  });

  it("defaults to the Olympic bar when nothing is set", () => {
    expect(barLabel(undefined, "kg")).toBe("Olympic bar");
  });

  it("gives a pound gym the bar it actually has", () => {
    // 45 lb is 20.41 kg, not 20. Converting the metric bar instead would be
    // wrong by a pound on every set logged against it, which is why
    // `defaultBarKg` already treats them as different bars.
    const olympic = barTypes("lb").find((bar) => bar.id === "olympic")!;
    expect(olympic.kg).toBeCloseTo(toKg(45, "lb"), 5);
    expect(olympic.note).toBe("Standard 7ft, 45 lb");
    expect(barTypes("kg").find((bar) => bar.id === "olympic")!.kg).toBe(20);
  });

  it("writes every note in the athlete's own unit", () => {
    // The whole set used to be phrased in kilograms, so a pound gym was told
    // its bench bar weighs "20 kg".
    for (const bar of barTypes("lb")) {
      expect(bar.note).not.toMatch(/\bkg\b/);
    }
  });

  it("keeps specialty bars at their real mass rather than inventing one", () => {
    // A guessed trap-bar weight makes every set logged on it wrong.
    expect(barTypes("lb").find((bar) => bar.id === "trap")!.kg).toBe(25);
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
