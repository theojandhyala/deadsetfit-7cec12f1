import { describe, it, expect } from "vitest";

import { buildHeatmap } from "./training-heatmap";

const TODAY = "2026-07-31"; // a Friday

describe("buildHeatmap", () => {
  it("spans exactly N weeks ending today, Monday-first", () => {
    const { columns } = buildHeatmap([], [], TODAY, 12);
    expect(columns).toHaveLength(12);
    const last = columns[columns.length - 1];
    expect(last[last.length - 1].date).toBe(TODAY);
    // Friday column: Mon..Fri = 5 cells.
    expect(last).toHaveLength(5);
    // Full columns start on a Monday.
    expect(new Date(`${columns[0][0].date}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it("levels trained days by volume quartile", () => {
    const sessions = [
      { date: "2026-07-28", totalVolume: 1000, endedAt: "x" },
      { date: "2026-07-29", totalVolume: 5000, endedAt: "x" },
      { date: "2026-07-30", totalVolume: 10000, endedAt: "x" },
    ];
    const { columns, maxVolume } = buildHeatmap(sessions, [], TODAY, 2);
    const byDate = Object.fromEntries(columns.flat().map((c) => [c.date, c]));
    expect(maxVolume).toBe(10000);
    expect(byDate["2026-07-28"].level).toBe(1);
    expect(byDate["2026-07-29"].level).toBe(2);
    expect(byDate["2026-07-30"].level).toBe(4);
    expect(byDate["2026-07-31"].level).toBe(0);
  });

  it("marks completed days with no logged volume at level 1", () => {
    const { columns } = buildHeatmap([], ["2026-07-30"], TODAY, 2);
    const cell = columns.flat().find((c) => c.date === "2026-07-30")!;
    expect(cell.trained).toBe(true);
    expect(cell.level).toBe(1);
  });

  it("ignores unfinished sessions", () => {
    const { maxVolume } = buildHeatmap([{ date: "2026-07-30", totalVolume: 9000 }], [], TODAY, 2);
    expect(maxVolume).toBe(0);
  });
});
