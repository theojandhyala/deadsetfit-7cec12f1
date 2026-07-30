import { describe, expect, it } from "vitest";
import type { Schedule } from "./types";
import { buildWorkoutReminderDrafts } from "./device-reminders";

const schedule: Schedule = {
  SUN: { label: "REST", exerciseIds: [] },
  MON: { label: "PUSH", exerciseIds: ["bench-press", "ohp"] },
  TUE: { label: "REST", exerciseIds: [] },
  WED: { label: "PULL", exerciseIds: ["pull-ups"] },
  THU: { label: "REST", exerciseIds: [] },
  FRI: { label: "LEGS", exerciseIds: ["squat", "rdl", "lunges"] },
  SAT: { label: "REST", exerciseIds: [] },
};

describe("workout reminder scheduling", () => {
  it("only schedules future training days", () => {
    const now = new Date(2026, 6, 27, 10, 0, 0);
    const drafts = buildWorkoutReminderDrafts(schedule, 18, 30, now);

    expect(drafts).toHaveLength(12);
    expect(drafts[0].title).toContain("PUSH");
    expect(drafts[0].schedule?.at).toEqual(new Date(2026, 6, 27, 18, 30, 0));
    expect(drafts.every((draft) => draft.body.includes("ready"))).toBe(true);
  });

  it("skips today's reminder when its chosen time has passed", () => {
    const now = new Date(2026, 6, 27, 20, 0, 0);
    const drafts = buildWorkoutReminderDrafts(schedule, 18, 0, now);

    expect(drafts[0].title).toContain("PULL");
    expect(drafts[0].schedule?.at).toEqual(new Date(2026, 6, 29, 18, 0, 0));
  });

  it("returns no reminders without a schedule", () => {
    expect(buildWorkoutReminderDrafts(null)).toEqual([]);
  });
});
