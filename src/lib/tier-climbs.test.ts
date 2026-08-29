import { describe, expect, it } from "vitest";

import type { MuscleGrade, StrengthTier } from "./strength-grades";
import type { MuscleGroup } from "./types";
import { detectTierClimbs, mergeSeen, snapshotTiers, tierRank } from "./tier-climbs";

const grade = (muscle: string, tier: StrengthTier): MuscleGrade =>
  ({ muscle: muscle as MuscleGroup, tier, score: 50, exercises: [], weakest: null }) as MuscleGrade;

describe("tierRank", () => {
  it("orders the ladder", () => {
    expect(tierRank("BEGINNER")).toBeLessThan(tierRank("INTERMEDIATE"));
    expect(tierRank("ELITE")).toBeLessThan(tierRank("WORLD_CLASS"));
  });

  it("returns -1 for anything off the ladder", () => {
    // A tier id can arrive from stored state written by an older build.
    expect(tierRank("LEGENDARY")).toBe(-1);
    expect(tierRank("")).toBe(-1);
  });
});

describe("detectTierClimbs", () => {
  it("reports a muscle moving up", () => {
    const climbs = detectTierClimbs([grade("CHEST", "INTERMEDIATE")], { CHEST: "NOVICE" });
    expect(climbs).toEqual([{ muscle: "CHEST", from: "NOVICE", to: "INTERMEDIATE", steps: 1 }]);
  });

  it("says nothing about a muscle that stayed put", () => {
    expect(detectTierClimbs([grade("CHEST", "NOVICE")], { CHEST: "NOVICE" })).toEqual([]);
  });

  it("never announces a drop", () => {
    // Every ratio grade is relative to bodyweight, so gaining mass alone moves
    // grades down. Telling somebody they got weaker for putting on size would
    // be both wrong and cruel.
    expect(detectTierClimbs([grade("CHEST", "NOVICE")], { CHEST: "ELITE" })).toEqual([]);
  });

  it("treats a first-ever grade as a starting point, not a climb", () => {
    // Otherwise every muscle fires at once the first time the screen opens.
    expect(detectTierClimbs([grade("CHEST", "ELITE")], {})).toEqual([]);
  });

  it("puts the biggest jump first", () => {
    const climbs = detectTierClimbs([grade("CHEST", "NOVICE"), grade("LEGS", "ADVANCED")], {
      CHEST: "BEGINNER",
      LEGS: "NOVICE",
    });
    expect(climbs[0]!.muscle).toBe("LEGS");
    expect(climbs[0]!.steps).toBe(2);
    expect(climbs[1]!.muscle).toBe("CHEST");
  });

  it("breaks a tie on the higher tier reached", () => {
    const climbs = detectTierClimbs([grade("ARMS", "NOVICE"), grade("BACK", "ELITE")], {
      ARMS: "BEGINNER",
      BACK: "ADVANCED",
    });
    expect(climbs[0]!.muscle).toBe("BACK");
  });

  it("ignores a tier id it does not recognise on either side", () => {
    expect(
      detectTierClimbs([grade("CHEST", "ELITE")], { CHEST: "MYTHIC" as StrengthTier }),
    ).toEqual([]);
    expect(
      detectTierClimbs([grade("CHEST", "MYTHIC" as StrengthTier)], { CHEST: "NOVICE" }),
    ).toEqual([]);
  });
});

describe("snapshotTiers and mergeSeen", () => {
  it("records the tier of every graded muscle", () => {
    expect(snapshotTiers([grade("CHEST", "ELITE"), grade("LEGS", "NOVICE")])).toEqual({
      CHEST: "ELITE",
      LEGS: "NOVICE",
    });
  });

  it("keeps muscles that were not graded this time", () => {
    // A week of push sessions does not mean the athlete's legs stopped
    // existing. Dropping them would make the next leg session read as a first
    // grade, which never celebrates.
    const merged = mergeSeen({ LEGS: "ADVANCED" }, [grade("CHEST", "ELITE")]);
    expect(merged).toEqual({ LEGS: "ADVANCED", CHEST: "ELITE" });
  });

  it("lets a fresh grade overwrite a stale one", () => {
    expect(mergeSeen({ CHEST: "NOVICE" }, [grade("CHEST", "ELITE")]).CHEST).toBe("ELITE");
  });
});
