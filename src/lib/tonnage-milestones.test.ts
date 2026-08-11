import { describe, it, expect } from "vitest";

import { currentTonnageMilestone, nextTonnageMilestone } from "./tonnage-milestones";

describe("tonnage milestones", () => {
  it("has no milestone before 10 t and tracks the highest reached", () => {
    expect(currentTonnageMilestone(9_999)).toBeNull();
    expect(currentTonnageMilestone(10_000)!.kg).toBe(10_000);
    expect(currentTonnageMilestone(120_000)!.kg).toBe(100_000);
    expect(currentTonnageMilestone(2_000_000)!.kg).toBe(1_000_000);
  });

  it("reports the next milestone with progress", () => {
    const first = nextTonnageMilestone(5_000)!;
    expect(first.milestone.kg).toBe(10_000);
    expect(first.pct).toBe(50);
    const mid = nextTonnageMilestone(60_000)!;
    expect(mid.milestone.kg).toBe(100_000);
    expect(mid.pct).toBe(60);
    expect(nextTonnageMilestone(1_500_000)).toBeNull();
  });

  it("progress never reads 100 before the crossing", () => {
    expect(nextTonnageMilestone(9_999)!.pct).toBe(99);
  });
});
