import { describe, it, expect } from "vitest";

import { staleData } from "./data-freshness";

const TODAY = "2026-07-31";

describe("staleData", () => {
  it("never nudges about streams never used", () => {
    expect(staleData([], [], [], TODAY)).toHaveLength(0);
  });

  it("stays quiet while everything is fresh", () => {
    const out = staleData(
      [{ date: "2026-07-28", weight: 80 }],
      [{ date: "2026-07-20", chest: 100, waist: 80, arms: 38, legs: 60 }],
      [{ date: "2026-07-15", photoDataUrl: "x" }],
      TODAY,
    );
    expect(out).toHaveLength(0);
  });

  it("flags an overdue weigh-in with the day count", () => {
    const out = staleData([{ date: "2026-07-10", weight: 80 }], [], [], TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "WEIGHT", daysSince: 21 });
    expect(out[0].message).toContain("21 days");
  });

  it("caps at two nudges, most-overdue first", () => {
    const out = staleData(
      [{ date: "2026-07-01", weight: 80 }], // 30 days → 3× its 10-day limit
      [{ date: "2026-06-01", chest: 100, waist: 80, arms: 38, legs: 60 }], // 60 days → ~1.7×
      [{ date: "2026-05-01", photoDataUrl: "x" }], // 91 days → ~3× of 30
      TODAY,
    );
    expect(out).toHaveLength(2);
    expect(out.map((n) => n.kind)).toEqual(["PHOTO", "WEIGHT"]);
  });
});
