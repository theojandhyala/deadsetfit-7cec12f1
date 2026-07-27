import { describe, expect, it } from "vitest";

import { getRank, getRankLadder, pointsToNextRank, pointsToNextTier, rankProgress } from "./rank";

describe("rank ladder", () => {
  it("maps every score to a valid rank without boundary gaps", () => {
    for (let score = -10; score <= 1_010; score += 1) {
      const rank = getRank(score);
      expect(rank.minPoints).toBeLessThanOrEqual(Math.max(0, Math.min(1_000, score)));
      expect(rank.maxPoints).toBeGreaterThanOrEqual(Math.max(0, Math.min(1_000, score)));
      expect(rankProgress(score)).toBeGreaterThanOrEqual(0);
      expect(rankProgress(score)).toBeLessThanOrEqual(1);
    }
  });

  it("reports division and tier progress at key boundaries", () => {
    expect(getRank(0).label).toBe("IRON III");
    expect(getRank(60).label).toBe("BRONZE III");
    expect(getRank(120).label).toBe("SILVER III");
    expect(getRank(990).label).toBe("DEADSET");
    expect(pointsToNextRank(0)).toBe(20);
    expect(pointsToNextTier(119)).toBe(1);
    expect(pointsToNextRank(1_000)).toBe(0);
  });

  it("returns a unique ladder ordered from highest to lowest", () => {
    const ladder = getRankLadder();
    expect(ladder).toHaveLength(34);
    expect(ladder.map((rank) => rank.label)).toContain("MASTER II");
    expect(ladder.map((rank) => rank.label)).toContain("LEGEND I");
    expect(new Set(ladder.map((rank) => rank.label)).size).toBe(ladder.length);
    expect(ladder.map((rank) => rank.minPoints)).toEqual(
      [...ladder.map((rank) => rank.minPoints)].sort((a, b) => b - a),
    );
  });

  it("advances through adjacent divisions without gaps", () => {
    expect(getRank(19).label).toBe("IRON III");
    expect(getRank(20).label).toBe("IRON II");
    expect(pointsToNextRank(19)).toBe(1);
  });
});
