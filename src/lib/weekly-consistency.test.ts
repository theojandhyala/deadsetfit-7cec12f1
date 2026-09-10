import { describe, expect, it } from "vitest";
import { calendarDaysUntil, weeklyConsistency, weeklyPlanDays } from "./weekly-consistency";
import type { AppState, Program, Schedule } from "./types";

function run(start: string, weeks: number) {
  const first = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, i) =>
    new Date(first + i * 7 * 86_400_000).toISOString().slice(0, 10),
  );
}

describe("weeklyConsistency", () => {
  it("welcomes a new athlete without inventing history", () => {
    const value = weeklyConsistency([], "2026-09-10");
    expect(value).toMatchObject({
      current: 0,
      best: 0,
      done: 0,
      nextMilestone: 2,
      achievedMilestones: [],
    });
    expect(value.weeks).toHaveLength(8);
    expect(value.weeks[7]).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
      dates: [],
      current: true,
    });
  });
  it("deduplicates and ignores future/invalid dates without modifying history", () => {
    const dates = [
      "2026-09-08",
      "2026-09-08",
      "2026-09-07",
      "2026-09-11",
      "2026-02-30",
      "bad",
      "2026-9-9",
      "2026-09-09T10:00:00Z",
    ];
    const copy = [...dates];
    expect(weeklyConsistency(dates, "2026-09-10")).toMatchObject({ done: 2, current: 1, best: 1 });
    expect(dates).toEqual(copy);
  });
  it("counts weeks, not consecutive days, so rest days are fine", () => {
    expect(
      weeklyConsistency(["2026-08-18", "2026-08-27", "2026-09-05", "2026-09-08"], "2026-09-10"),
    ).toMatchObject({
      current: 4,
      best: 4,
      done: 1,
      nextMilestone: 8,
      milestoneRemaining: 4,
      achievedMilestones: [2, 4],
    });
  });
  it.each(["2026-09-07", "2026-09-10", "2026-09-13"])(
    "leaves the current week open on %s",
    (today) => {
      expect(weeklyConsistency(run("2026-08-17", 3), today)).toMatchObject({
        current: 3,
        best: 3,
        done: 0,
      });
    },
  );
  it("breaks the run only after a fully empty week", () => {
    expect(weeklyConsistency(run("2026-08-17", 3), "2026-09-14")).toMatchObject({
      current: 0,
      best: 3,
      achievedMilestones: [2],
    });
  });
  it("starts a new run after a gap and retains the old best/badges", () => {
    expect(weeklyConsistency([...run("2026-07-06", 4), "2026-09-09"], "2026-09-10")).toMatchObject({
      current: 1,
      best: 4,
      achievedMilestones: [2, 4],
    });
  });
  it("handles Sunday/Monday across the new year", () => {
    expect(
      weeklyConsistency(["2025-12-28", "2026-01-04", "2026-01-05"], "2026-01-05"),
    ).toMatchObject({ current: 3, done: 1 });
  });
  it("uses the injected date, not the system clock", () => {
    expect(weeklyConsistency(["2020-03-23", "2020-03-30"], "2020-03-30")).toMatchObject({
      current: 2,
      done: 1,
    });
  });
  it.each([
    ["2024-02-29", "2024-03-04"],
    ["2026-03-23", "2026-03-30"],
    ["2026-10-19", "2026-10-26"],
  ])("handles leap days and DST: %s to %s", (start, end) => {
    expect(weeklyConsistency([start, end], end).current).toBe(2);
  });
  it("keeps milestones meaningful after a full year", () => {
    const dates = run("2025-01-06", 53);
    expect(weeklyConsistency(dates, dates[52])).toMatchObject({
      current: 53,
      best: 53,
      nextMilestone: 104,
      milestoneRemaining: 51,
    });
  });
  it("sorts displayed dates regardless of input order", () => {
    expect(
      weeklyConsistency(["2026-09-10", "2026-09-07", "2026-09-09"], "2026-09-10").weeks[7].dates,
    ).toEqual(["2026-09-07", "2026-09-09", "2026-09-10"]);
  });
  it("rejects an invalid as-of date", () => {
    expect(() => weeklyConsistency([], "2026-02-30")).toThrow(RangeError);
  });
});

describe("weeklyPlanDays", () => {
  const schedule = { MON: { exerciseIds: ["squat"] }, FRI: { exerciseIds: ["press"] } } as Schedule;
  const state = { programs: [], activeProgramId: null } as Pick<
    AppState,
    "programs" | "activeProgramId"
  >;
  it("uses scheduled exercises, not a stale profile target", () => {
    expect(weeklyPlanDays(state, schedule)).toEqual(["MON", "FRI"]);
  });
  it("prefers the active programme", () => {
    const program = { id: "active", days: { WED: { items: [{ id: "squat" }] } } } as Program;
    expect(weeklyPlanDays({ programs: [program], activeProgramId: "active" }, schedule)).toEqual([
      "WED",
    ]);
  });
  it("respects an intentionally empty programme", () => {
    const program = { id: "active", days: {} } as Program;
    expect(weeklyPlanDays({ programs: [program], activeProgramId: "active" }, schedule)).toEqual(
      [],
    );
  });
  it("handles deleted programmes and missing schedules", () => {
    expect(weeklyPlanDays({ ...state, activeProgramId: "missing" }, schedule)).toEqual([
      "MON",
      "FRI",
    ]);
    expect(weeklyPlanDays(state, null)).toEqual([]);
  });
});

describe("calendarDaysUntil", () => {
  it("uses dates across DST without adding an extra day", () => {
    expect(calendarDaysUntil("2026-03-28", "2026-03-30")).toBe(2);
    expect(calendarDaysUntil("2026-10-24", "2026-10-26")).toBe(2);
    expect(calendarDaysUntil("2026-09-10", "2026-09-10")).toBe(0);
    expect(calendarDaysUntil("2026-09-10", "2026-09-09")).toBe(-1);
    expect(calendarDaysUntil("2026-09-10", "2026-02-30")).toBeNull();
  });
});
