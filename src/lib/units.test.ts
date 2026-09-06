import { describe, expect, it } from "vitest";

import {
  defaultBarKg,
  formatVolume,
  formatWeight,
  increment,
  plateLoad,
  plateSizes,
  snapToLoadable,
  toDisplay,
  toKg,
  trimNumber,
  unitOf,
} from "./units";

describe("unitOf", () => {
  it("defaults to kilograms for anyone who never chose", () => {
    expect(unitOf(null)).toBe("kg");
    expect(unitOf({})).toBe("kg");
    expect(unitOf({ units: "kg" })).toBe("kg");
  });

  it("honours a pound preference", () => {
    expect(unitOf({ units: "lb" })).toBe("lb");
  });
});

describe("conversion", () => {
  it("round-trips a weight without drifting", () => {
    for (const kg of [20, 60, 62.5, 100, 142.5]) {
      expect(toKg(toDisplay(kg, "lb"), "lb")).toBeCloseTo(kg, 0);
      expect(toKg(toDisplay(kg, "kg"), "kg")).toBeCloseTo(kg, 1);
    }
  });

  it("uses the real conversion factor, not an approximation", () => {
    // 100 kg is 220.46 lb. A lazy 2.2 would show 220 and be a pound out.
    expect(toDisplay(100, "lb")).toBe(220);
    expect(toKg(225, "lb")).toBeCloseTo(102.06, 1);
  });

  it("shows whole pounds — nobody loads a tenth of a pound", () => {
    expect(Number.isInteger(toDisplay(83.7, "lb"))).toBe(true);
  });

  it("never returns NaN for rubbish input", () => {
    expect(toDisplay(Number.NaN, "kg")).toBe(0);
    expect(toKg(Number.NaN, "lb")).toBe(0);
  });
});

describe("formatting", () => {
  it("drops a trailing zero decimal", () => {
    expect(trimNumber(60)).toBe("60");
    expect(trimNumber(62.5)).toBe("62.5");
  });

  it("labels the unit the athlete chose", () => {
    expect(formatWeight(60, "kg")).toBe("60 kg");
    expect(formatWeight(60, "lb")).toBe("132 lb");
  });

  it("groups big volumes so they stay readable", () => {
    expect(formatVolume(12_400, "kg")).toBe("12,400 kg");
    expect(formatVolume(12_400, "lb")).toContain(",");
  });
});

describe("loadable weights", () => {
  it("steps by a pair of the smallest plates in each system", () => {
    expect(increment("kg")).toBe(2.5);
    expect(increment("lb")).toBe(5);
  });

  it("snaps to something a pound gym can actually load", () => {
    // 63 kg is 138.9 lb, which snaps to 140 lb.
    expect(toDisplay(snapToLoadable(63, "lb"), "lb")).toBe(140);
  });

  it("snaps to a kilo gym's plates", () => {
    expect(snapToLoadable(61, "kg")).toBeCloseTo(60, 1);
    expect(snapToLoadable(64, "kg")).toBeCloseTo(65, 1);
  });

  it("offers the plates each system actually stocks", () => {
    expect(plateSizes("kg")).toContain(20);
    expect(plateSizes("lb")).toContain(45);
    expect(plateSizes("lb")).not.toContain(20);
  });

  it("knows a pound gym's bar is 45 lb, not 20 kg", () => {
    expect(defaultBarKg("kg")).toBe(20);
    expect(toDisplay(defaultBarKg("lb"), "lb")).toBe(45);
  });
});

describe("plateLoad", () => {
  it("loads a kilo bar", () => {
    const load = plateLoad(100, 20, "kg");
    expect(load).toMatchObject({ perSide: [25, 15], remainder: 0, bar: 20 });
  });

  it("loads a pound bar in whole pound plates", () => {
    // 225 lb on a 45 lb bar is the classic two-plates-a-side.
    const load = plateLoad(toKg(225, "lb"), toKg(45, "lb"), "lb");
    expect(load?.bar).toBe(45);
    expect(load?.perSide).toEqual([45, 45]);
    expect(load?.remainder).toBeCloseTo(0, 1);
  });

  it("never produces a plate size that exists in no gym", () => {
    // The bug this guards: converting a kg breakdown to pounds afterwards
    // yields things like 20.4 lb, which nobody can load.
    const load = plateLoad(toKg(185, "lb"), toKg(45, "lb"), "lb");
    for (const plate of load!.perSide) expect(plateSizes("lb")).toContain(plate);
  });

  it("reports what cannot be loaded rather than lying", () => {
    const load = plateLoad(101, 20, "kg");
    expect(load!.remainder).toBeGreaterThan(0);
  });

  it("returns nothing when the target is under the bar", () => {
    expect(plateLoad(15, 20, "kg")).toBeNull();
    expect(plateLoad(20, 0, "kg")).toBeNull();
  });

  it("handles a bar-only set", () => {
    expect(plateLoad(20, 20, "kg")).toMatchObject({ perSide: [], remainder: 0 });
  });
});
