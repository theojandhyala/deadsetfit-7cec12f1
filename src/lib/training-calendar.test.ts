import { describe, expect, it } from "vitest";
import {
  calendarDate,
  calendarHistory,
  calendarRange,
  monthCells,
  moveDays,
  movePeriod,
  plannedWorkout,
  weekday,
} from "./training-calendar";
import type { Schedule, WorkoutSession } from "./types";
const session = (
  id: string,
  date: string,
  totalVolume = 1000,
  endedAt: string | undefined = date + "T18:00:00Z",
) => ({ id, date, totalVolume, endedAt, label: "Push" }) as WorkoutSession;

describe("training calendar dates", () => {
  it("aligns weeks to Monday across year boundaries and DST without timezone shifts", () => {
    expect(calendarRange("2026-01-01", "week")).toEqual({ start: "2025-12-29", end: "2026-01-04" });
    expect(moveDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(weekday("2026-03-29")).toBe("SUN");
    expect(movePeriod("2026-03-29", "week", 1)).toBe("2026-04-05");
  });
  it("preserves month navigation at the 31st and displays leap-day grids", () => {
    expect(movePeriod("2026-01-31", "month", 1)).toBe("2026-02-01");
    expect(movePeriod("2024-02-29", "year", 1)).toBe("2025-02-01");
    const cells = monthCells("2024-02-15");
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells.length % 7).toBe(0);
    expect(calendarDate("2026-02-30")).toBeNull();
    expect(calendarDate("invalid")).toBeNull();
  });
});
describe("truthful training history", () => {
  it("deduplicates records but retains multiple distinct sessions per day", () => {
    const a = session("a", "2026-09-10"),
      b = session("b", "2026-09-10", 2000);
    const history = calendarHistory(
      [a, a, b],
      ["2026-09-10", "2026-09-10", "2025-12-31"],
      "2026-09-12",
    );
    expect(history.size).toBe(2);
    expect(history.get(a.date)?.sessions).toHaveLength(2);
    expect(history.get(a.date)?.volume).toBe(3000);
    expect(history.get("2025-12-31")?.sessions).toHaveLength(0);
    expect(history.get("2025-12-31")?.level).toBe(1);
  });
  it("ignores unfinished, future and malformed records and sanitises volume", () => {
    const unfinished = { ...session("u", "2026-09-10"), endedAt: undefined };
    const history = calendarHistory(
      [
        unfinished,
        session("f", "2026-09-13"),
        session("bad", "2026-02-30"),
        session("n", "2026-09-11", -10),
        session("nan", "2026-09-12", NaN),
      ],
      ["invalid", "2026-09-13"],
      "2026-09-12",
    );
    expect([...history.keys()]).toEqual(["2026-09-11", "2026-09-12"]);
    expect([...history.values()].every((d) => d.volume === 0 && d.completed && d.level === 1)).toBe(
      true,
    );
  });
  it("never retroactively applies the current schedule to past days", () => {
    const schedule = {
      MON: { label: "Push", exerciseIds: ["press"] },
      TUE: { label: "Rest", exerciseIds: [] },
    } as unknown as Schedule;
    expect(plannedWorkout("2026-09-07", "2026-09-12", schedule)).toBeNull();
    expect(plannedWorkout("2026-09-14", "2026-09-12", schedule)?.label).toBe("Push");
    expect(plannedWorkout("2026-09-15", "2026-09-12", schedule)).toBeNull();
    expect(plannedWorkout("2026-09-14", "2026-09-12", null)).toBeNull();
  });
});
