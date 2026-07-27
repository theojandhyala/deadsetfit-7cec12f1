import { describe, expect, it } from "vitest";
import { isPersonalRecord } from "./workout-pr";

describe("isPersonalRecord", () => {
  it("rejects zero-load records for weighted exercises", () => {
    expect(
      isPersonalRecord({
        weight: 0,
        reps: 12,
        bestWeight: 0,
        bestBodyweightReps: 0,
        supportsBodyweight: false,
      }),
    ).toBe(false);
  });

  it("accepts rep records for bodyweight exercises", () => {
    expect(
      isPersonalRecord({
        weight: 0,
        reps: 12,
        bestWeight: 0,
        bestBodyweightReps: 10,
        supportsBodyweight: true,
      }),
    ).toBe(true);
  });

  it("accepts heavier weighted sets", () => {
    expect(
      isPersonalRecord({
        weight: 82.5,
        reps: 6,
        bestWeight: 80,
        bestBodyweightReps: 0,
        supportsBodyweight: false,
      }),
    ).toBe(true);
  });

  it("rejects warm-up and drop-set records", () => {
    expect(
      isPersonalRecord({
        weight: 100,
        reps: 8,
        bestWeight: 80,
        bestBodyweightReps: 0,
        supportsBodyweight: false,
        specialSet: true,
      }),
    ).toBe(false);
  });
});
