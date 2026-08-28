import { describe, expect, it } from "vitest";
import { buildWorkoutHistory } from "./workout-history";

describe("buildWorkoutHistory", () => {
  it("groups real completed history into newest-first calendar years", () => {
    const years = buildWorkoutHistory(
      [
        { date: "2025-12-31", totalVolume: 1000, endedAt: "x" },
        { date: "2026-01-02", totalVolume: 2000, endedAt: "x" },
      ],
      ["2024-06-01"],
      "2026-08-27",
    );
    expect(years.map((year) => year.year)).toEqual([2026, 2025, 2024]);
    expect(years.map((year) => year.workoutCount)).toEqual([1, 1, 1]);
  });

  it("ignores unfinished sessions and never renders future days", () => {
    const [year] = buildWorkoutHistory(
      [{ date: "2026-08-28", totalVolume: 9000 }],
      ["2026-08-27"],
      "2026-08-27",
    );
    const cells = year.columns.flat().filter(Boolean);
    expect(cells.at(-1)?.date).toBe("2026-08-27");
    expect(year.workoutCount).toBe(1);
  });
});
