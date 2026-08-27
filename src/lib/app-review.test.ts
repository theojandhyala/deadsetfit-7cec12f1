import { describe, expect, it } from "vitest";

import { REVIEW_COOLDOWN_MS, reviewMilestoneFor, shouldRequestAppReview } from "./app-review";

describe("reviewMilestoneFor", () => {
  it("uses meaningful workout milestones", () => {
    expect(reviewMilestoneFor(2, [])).toBeNull();
    expect(reviewMilestoneFor(3, [])).toBe(3);
    expect(reviewMilestoneFor(12, [3])).toBe(10);
    expect(reviewMilestoneFor(30, [3, 10])).toBe(25);
  });

  it("does not catch up through several old prompts", () => {
    expect(reviewMilestoneFor(30, [])).toBe(25);
    expect(reviewMilestoneFor(30, [25])).toBeNull();
  });
});

describe("shouldRequestAppReview", () => {
  const now = new Date("2026-08-20T12:05:00.000Z").getTime();

  it("requests after a fresh successful workout", () => {
    expect(
      shouldRequestAppReview({
        finished: 3,
        latestEndedAt: "2026-08-20T12:04:00.000Z",
        attemptedMilestones: [],
        now,
      }),
    ).toBe(3);
  });

  it("does not request while hydrating old workout history", () => {
    expect(
      shouldRequestAppReview({
        finished: 12,
        latestEndedAt: "2026-08-19T12:04:00.000Z",
        attemptedMilestones: [3],
        now,
      }),
    ).toBeNull();
  });

  it("does not repeat an attempted milestone", () => {
    expect(
      shouldRequestAppReview({
        finished: 6,
        latestEndedAt: "2026-08-20T12:04:00.000Z",
        attemptedMilestones: [3],
        now,
      }),
    ).toBeNull();
  });

  it("spaces system requests so users are not pestered", () => {
    expect(
      shouldRequestAppReview({
        finished: 10,
        latestEndedAt: "2026-08-20T12:04:00.000Z",
        attemptedMilestones: [3],
        lastAttemptAt: new Date(now - REVIEW_COOLDOWN_MS + 1).toISOString(),
        now,
      }),
    ).toBeNull();
  });

  it("allows the next milestone after the cooldown", () => {
    expect(
      shouldRequestAppReview({
        finished: 10,
        latestEndedAt: "2026-08-20T12:04:00.000Z",
        attemptedMilestones: [3],
        lastAttemptAt: new Date(now - REVIEW_COOLDOWN_MS).toISOString(),
        now,
      }),
    ).toBe(10);
  });
});
