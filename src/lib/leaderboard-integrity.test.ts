import { describe, expect, it } from "vitest";
import { assessLeaderboardStats, rankable } from "./leaderboard-integrity";

const honest = {
  topPRs: [
    { id: "squat", value: 180, unit: "kg" },
    { id: "bench", value: 120, unit: "kg" },
    { id: "deadlift", value: 220, unit: "kg" },
  ],
  streak: 12,
  weightKg: 85,
};

describe("assessLeaderboardStats", () => {
  it("accepts a real lifter and marks them verified", () => {
    const verdict = assessLeaderboardStats({
      grit: 320,
      stats: honest,
      previousGrit: 300,
      previousStats: honest,
    });

    expect(verdict.verified).toBe(true);
    expect(verdict.flags).toEqual([]);
    expect(verdict.grit).toBe(320);
    expect(rankable(verdict.stats)).toBe(true);
  });

  it("refuses to rank a typed-in 500 kg squat", () => {
    const verdict = assessLeaderboardStats({
      grit: 999,
      stats: { ...honest, topPRs: [{ id: "squat", value: 600 }] },
      previousGrit: 100,
      previousStats: honest,
    });

    expect(verdict.flags).toContain("pr_above_human_ceiling");
    expect(verdict.verified).toBe(false);
    expect(rankable(verdict.stats)).toBe(false);
  });

  it("keeps the previous grit rather than the inflated one", () => {
    const verdict = assessLeaderboardStats({
      grit: 999,
      stats: { ...honest, topPRs: [{ id: "bench", value: 400 }] },
      previousGrit: 210,
      previousStats: honest,
    });

    expect(verdict.grit).toBe(210);
  });

  it("flags a lift that is impossible for the lifter's bodyweight", () => {
    // 300 kg bench at 60 kg is 5× bodyweight — under the absolute ceiling, so
    // only the multiple check catches it.
    const verdict = assessLeaderboardStats({
      grit: 200,
      stats: { topPRs: [{ id: "bench", value: 300 }], weightKg: 60 },
      previousGrit: 190,
    });

    expect(verdict.flags).toContain("pr_implausible_bodyweight_multiple");
  });

  it("does not punish a light lifter who is genuinely strong", () => {
    // 150 kg deadlift at 55 kg — under 3× bodyweight, entirely real.
    const verdict = assessLeaderboardStats({
      grit: 150,
      stats: { topPRs: [{ id: "deadlift", value: 150 }], weightKg: 55 },
      previousGrit: 140,
    });

    expect(verdict.verified).toBe(true);
  });

  it("flags a PR that doubles in a single sync", () => {
    const verdict = assessLeaderboardStats({
      grit: 300,
      stats: { ...honest, topPRs: [{ id: "squat", value: 360 }] },
      previousGrit: 290,
      previousStats: honest,
    });

    expect(verdict.flags).toContain("pr_jumped_too_fast");
  });

  it("allows an ordinary session-to-session PR increase", () => {
    const verdict = assessLeaderboardStats({
      grit: 305,
      stats: { ...honest, topPRs: [{ id: "squat", value: 185 }] },
      previousGrit: 300,
      previousStats: honest,
    });

    expect(verdict.verified).toBe(true);
  });

  it("accepts a first-ever PR, which has no history to outpace", () => {
    const verdict = assessLeaderboardStats({
      grit: 40,
      stats: { topPRs: [{ id: "squat", value: 140 }], weightKg: 80 },
      previousGrit: 0,
      previousStats: { topPRs: [] },
    });

    expect(verdict.verified).toBe(true);
  });

  it("flags grit that leaps beyond what a session can earn", () => {
    const verdict = assessLeaderboardStats({
      grit: 900,
      stats: honest,
      previousGrit: 100,
      previousStats: honest,
    });

    expect(verdict.flags).toContain("grit_jumped_too_fast");
    expect(verdict.grit).toBe(100);
  });

  it("flags a streak longer than the days actually logged", () => {
    const verdict = assessLeaderboardStats({
      grit: 100,
      stats: { ...honest, streak: 400 },
      previousGrit: 95,
      previousStats: honest,
      completedDates: ["2026-07-01", "2026-07-02"],
    });

    expect(verdict.flags).toContain("streak_exceeds_history");
  });

  it("resolves lift ids like squat_1rm and benchTop", () => {
    const verdict = assessLeaderboardStats({
      grit: 100,
      stats: {
        topPRs: [
          { id: "squat_1rm", value: 600 },
          { id: "benchTop", value: 400 },
        ],
      },
      previousGrit: 90,
    });

    expect(verdict.flags).toContain("pr_above_human_ceiling");
  });

  it("ignores zero and non-numeric PRs instead of flagging them", () => {
    const verdict = assessLeaderboardStats({
      grit: 100,
      stats: { topPRs: [{ id: "squat", value: 0 }, { id: "bench" }], weightKg: 80 },
      previousGrit: 95,
    });

    expect(verdict.verified).toBe(true);
  });

  it("reports each distinct problem once", () => {
    const verdict = assessLeaderboardStats({
      grit: 100,
      stats: {
        topPRs: [
          { id: "squat", value: 600 },
          { id: "deadlift", value: 900 },
        ],
      },
      previousGrit: 95,
    });

    expect(verdict.flags).toEqual(["pr_above_human_ceiling"]);
  });
});

describe("rankable", () => {
  it("trusts rows written before this check existed", () => {
    // Introducing integrity checking must not silently empty the leaderboard.
    expect(rankable({ topPRs: [{ id: "squat", value: 200 }] })).toBe(true);
    expect(rankable(null)).toBe(true);
    expect(rankable(undefined)).toBe(true);
  });

  it("excludes an entry explicitly marked unverified", () => {
    expect(rankable({ integrity: { verified: false, flags: ["pr_above_human_ceiling"] } })).toBe(
      false,
    );
  });
});

describe("a flagged sync holds standing", () => {
  it("keeps previously earned grit rather than lowering it", () => {
    // A false positive must not cost an honest lifter grit they already earned.
    const verdict = assessLeaderboardStats({
      grit: 5,
      stats: { topPRs: [{ id: "squat", value: 600 }], weightKg: 80 },
      previousGrit: 400,
    });

    expect(verdict.verified).toBe(false);
    expect(verdict.grit).toBe(400);
  });
});

describe("first sync and fresh-device restore", () => {
  const thirtySessions = {
    topPRs: [
      { id: "squat", value: 180 },
      { id: "bench-press", value: 120 },
    ],
    streak: 12,
    weightKg: 85,
  };

  it("accepts a whole honest history arriving in one request", () => {
    // The false positive this exists to prevent: 30 real sessions compute to ~450
    // grit, which the growth rule read as a spike and kept a real lifter off the
    // board. previousStats is undefined on a first sync — there is no baseline.
    const verdict = assessLeaderboardStats({
      grit: 450,
      stats: thirtySessions,
      previousGrit: 100,
      accountAgeDays: 40,
    });

    expect(verdict.verified).toBe(true);
    expect(verdict.grit).toBe(450);
  });

  it("still rate-limits growth once an account has a baseline", () => {
    const verdict = assessLeaderboardStats({
      grit: 450,
      stats: thirtySessions,
      previousGrit: 100,
      previousStats: thirtySessions,
      accountAgeDays: 40,
    });

    expect(verdict.flags).toContain("grit_jumped_too_fast");
  });

  it("refuses a day-old account claiming a year of training", () => {
    const verdict = assessLeaderboardStats({
      grit: 900,
      stats: thirtySessions,
      accountAgeDays: 1,
    });

    expect(verdict.flags).toContain("grit_exceeds_account_age");
    expect(verdict.verified).toBe(false);
  });

  it("stops constraining accounts old enough to have earned it", () => {
    const verdict = assessLeaderboardStats({
      grit: 1000,
      stats: thirtySessions,
      accountAgeDays: 200,
    });

    expect(verdict.verified).toBe(true);
  });

  it("skips the age rule when the account date is unknown", () => {
    const verdict = assessLeaderboardStats({ grit: 900, stats: thirtySessions });

    expect(verdict.verified).toBe(true);
  });
});

describe("an empty stats column is not a baseline", () => {
  it("treats the default {} public_stats as a first sync", () => {
    // profiles.public_stats defaults to {}, so a brand-new account arrives with an
    // object rather than undefined. Reading that as "established" flagged the
    // first honest sync of every new user — caught only by testing against the
    // live API, not by unit tests.
    const verdict = assessLeaderboardStats({
      grit: 450,
      stats: { topPRs: [{ id: "squat", value: 180 }], weightKg: 85 },
      previousGrit: 0,
      previousStats: {},
      accountAgeDays: 45,
    });

    expect(verdict.flags).not.toContain("grit_jumped_too_fast");
    expect(verdict.verified).toBe(true);
  });

  it("also treats topPRs full of zeroes as no baseline", () => {
    const verdict = assessLeaderboardStats({
      grit: 450,
      stats: { topPRs: [{ id: "squat", value: 180 }], weightKg: 85 },
      previousGrit: 0,
      previousStats: { topPRs: [{ id: "squat", value: 0 }] },
      accountAgeDays: 45,
    });

    expect(verdict.verified).toBe(true);
  });
});
