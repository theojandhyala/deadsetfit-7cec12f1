import { describe, it, expect } from "vitest";

import { feelTrend } from "./session-feel";
import type { SessionFeel, WorkoutSession } from "./types";

function s(day: number, feel?: SessionFeel): WorkoutSession {
  const date = `2026-07-${String(day).padStart(2, "0")}`;
  return {
    id: `s${day}`,
    date,
    dayKey: "MON",
    label: "Push",
    programId: null,
    startedAt: `${date}T10:00:00`,
    endedAt: `${date}T11:00:00`,
    exercises: [],
    totalVolume: 0,
    prCount: 0,
    ...(feel ? { feel } : {}),
  } as WorkoutSession;
}

describe("feelTrend", () => {
  it("is unknown with no ratings", () => {
    const t = feelTrend([s(1), s(2)]);
    expect(t.recent).toBeNull();
    expect(t.direction).toBe("unknown");
  });

  it("averages the recent window", () => {
    const t = feelTrend([s(1, 4), s(2, 2)], 5);
    expect(t.recent).toBe(3);
    expect(t.rated).toBe(2);
  });

  it("reports an improving trend", () => {
    const older = [s(1, 2), s(2, 2)];
    const newer = [s(3, 5), s(4, 5)];
    expect(feelTrend([...older, ...newer], 2).direction).toBe("up");
  });

  it("reports a declining trend", () => {
    const older = [s(1, 5), s(2, 5)];
    const newer = [s(3, 2), s(4, 2)];
    expect(feelTrend([...older, ...newer], 2).direction).toBe("down");
  });

  it("calls a quarter-point swing flat rather than a trend", () => {
    const older = [s(1, 3), s(2, 3)];
    const newer = [s(3, 3), s(4, 3)];
    expect(feelTrend([...older, ...newer], 2).direction).toBe("flat");
  });

  it("stays unknown until both windows have two ratings", () => {
    expect(feelTrend([s(1, 2), s(2, 5)], 1).direction).toBe("unknown");
  });

  it("ignores unfinished sessions", () => {
    const open = { ...s(9, 5), endedAt: undefined } as WorkoutSession;
    expect(feelTrend([s(1, 3), open]).rated).toBe(1);
  });
});
