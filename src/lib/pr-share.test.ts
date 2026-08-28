import { describe, it, expect } from "vitest";

import { fmtLoad, prHeadline } from "./pr-share";

describe("fmtLoad", () => {
  it("keeps whole numbers clean", () => {
    expect(fmtLoad(100)).toBe("100");
  });

  it("keeps half-plate increments", () => {
    expect(fmtLoad(102.5)).toBe("102.5");
  });

  it("rounds noise to one decimal", () => {
    expect(fmtLoad(102.44999)).toBe("102.4");
  });
});

describe("prHeadline — loaded lifts", () => {
  const base = { exercise: "Bench Press", weight: 100, reps: 5 };

  it("leads with the load and keeps reps as context", () => {
    const h = prHeadline({ ...base, previousBest: 90 }, "kg");
    expect(h.value).toBe("100");
    expect(h.unit).toBe("KG");
    expect(h.repLine).toBe("× 5 REPS");
    expect(h.delta).toBe("+10KG ON MY BEST");
    expect(h.caption).toBe("100kg × 5 on Bench Press — new PR");
  });

  it("shows no delta on a first-ever record", () => {
    expect(prHeadline(base, "kg").delta).toBeNull();
  });

  it("shows no delta when the previous best was zero", () => {
    expect(prHeadline({ ...base, previousBest: 0 }, "kg").delta).toBeNull();
  });

  it("never brags a non-positive delta", () => {
    expect(prHeadline({ ...base, previousBest: 100 }, "kg").delta).toBeNull();
    expect(prHeadline({ ...base, previousBest: 110 }, "kg").delta).toBeNull();
  });

  it("formats half-plate jumps", () => {
    const h = prHeadline({ ...base, weight: 102.5, previousBest: 100 }, "kg");
    expect(h.value).toBe("102.5");
    expect(h.delta).toBe("+2.5KG ON MY BEST");
  });

  it("singularises a one-rep max", () => {
    expect(prHeadline({ ...base, reps: 1 }, "kg").repLine).toBe("× 1 REP");
  });

  it("drops the rep clause when a stored record has no reps", () => {
    const h = prHeadline({ exercise: "Squat", weight: 140, reps: 0 }, "kg");
    expect(h.value).toBe("140");
    expect(h.unit).toBe("KG");
    expect(h.repLine).toBeNull();
    expect(h.caption).toBe("140kg on Squat — new PR");
  });
});

describe("prHeadline — bodyweight lifts", () => {
  const base = { exercise: "Pull Ups", weight: 0, reps: 12, bodyweight: true };

  it("makes the rep count the record", () => {
    const h = prHeadline({ ...base, previousBest: 10 }, "kg");
    expect(h.value).toBe("12");
    expect(h.unit).toBe("REPS");
    expect(h.delta).toBe("+2 REPS ON MY BEST");
    expect(h.caption).toBe("12 reps on Pull Ups — new PR");
  });

  it("drops the rep line, since the reps are already the headline", () => {
    expect(prHeadline(base, "kg").repLine).toBeNull();
  });

  it("singularises a single rep", () => {
    expect(prHeadline({ ...base, reps: 1 }, "kg").unit).toBe("REP");
  });

  it("treats a zero-weight set as bodyweight even without the flag", () => {
    const h = prHeadline({ exercise: "Dips", weight: 0, reps: 8 }, "kg");
    expect(h.unit).toBe("REPS");
    expect(h.value).toBe("8");
  });
});
