import { describe, expect, it } from "vitest";

import { profileFromAccount, profileQuestionsComplete } from "./account-restore";
import { buildPublicStats } from "./fifa-stats";
import { DEFAULT_STATE } from "./default-state";
import type { Profile } from "./types";

const BASE = {
  onboarded: true,
  goal: "BULK",
  experience: "INTERMEDIATE",
  gender: "MALE",
  age: 28,
  weight_kg: 84,
  height_cm: 181,
  days_per_week: 4,
  equipment: "FULL_GYM",
  username: "ironwolf",
  display_name: "Marcus Vale",
};

describe("profileFromAccount", () => {
  it("rebuilds the answers that have a column of their own", () => {
    const profile = profileFromAccount(BASE);
    expect(profile?.goal).toBe("BULK");
    expect(profile?.experience).toBe("INTERMEDIATE");
    expect(profile?.weightKg).toBe(84);
    expect(profile?.username).toBe("ironwolf");
  });

  it("never invents a starting bodyweight from the current one", () => {
    // It used to default startingWeightKg to the current weight, which told
    // every rebuilt device the athlete had not moved a gram since day one and
    // silently wiped the whole weight journey. Absent is correct — every reader
    // already falls back to the current weight for that case.
    const profile = profileFromAccount(BASE);
    expect(profile?.startingWeightKg).toBeUndefined();
  });

  it("restores the starting bodyweight that was really recorded", () => {
    const profile = profileFromAccount({
      ...BASE,
      public_stats: { prefs: { startingWeightKg: 78 } },
    });
    expect(profile?.startingWeightKg).toBe(78);
  });

  it("restores the exact training days, not just how many", () => {
    // Without this a Tue/Thu/Sat lifter is moved onto a Mon-first spread on
    // every fresh device and told that is their schedule.
    const profile = profileFromAccount({
      ...BASE,
      public_stats: { prefs: { trainingDays: ["TUE", "THU", "SAT"] } },
    });
    expect(profile?.trainingDays).toEqual(["TUE", "THU", "SAT"]);
  });

  it("restores the answers that shape coaching rather than the split", () => {
    const profile = profileFromAccount({
      ...BASE,
      public_stats: {
        prefs: {
          injuries: "Left shoulder clicks overhead",
          weakness: "CONSISTENCY",
          motivation: "COMPETE",
          sleepQuality: "LOW",
          dreamOutcome: "PLATES",
        },
      },
    });
    expect(profile?.injuries).toBe("Left shoulder clicks overhead");
    expect(profile?.weakness).toBe("CONSISTENCY");
    expect(profile?.motivation).toBe("COMPETE");
    expect(profile?.sleepQuality).toBe("LOW");
    expect(profile?.dreamOutcome).toBe("PLATES");
  });

  it("drops junk rather than trusting whatever is in the blob", () => {
    const profile = profileFromAccount({
      ...BASE,
      public_stats: {
        prefs: {
          trainingDays: ["MON", "FUNDAY"],
          weakness: "VIBES",
          sleepQuality: "PERFECT",
          startingWeightKg: -5,
          injuries: "   ",
        },
      },
    });
    expect(profile?.trainingDays).toEqual(["MON"]);
    expect(profile?.weakness).toBeUndefined();
    expect(profile?.sleepQuality).toBeUndefined();
    expect(profile?.startingWeightKg).toBeUndefined();
    expect(profile?.injuries).toBeUndefined();
  });

  it("refuses to rebuild an account that never finished setup", () => {
    expect(profileFromAccount({ ...BASE, onboarded: false })).toBeNull();
    expect(profileFromAccount(null)).toBeNull();
    expect(profileQuestionsComplete({ ...BASE, username: null })).toBe(false);
    expect(profileQuestionsComplete(BASE)).toBe(true);
  });
});

describe("round trip", () => {
  it("survives a save and a fresh-device rebuild without losing an answer", () => {
    // The real failure mode: setup asks for something, the profile row has no
    // column for it, and it is gone on the next device. Anything collected has
    // to make it into public_stats.prefs and back out again.
    const profile: Profile = {
      goal: "CUT",
      experience: "ADVANCED",
      age: 31,
      weightKg: 79,
      heightCm: 176,
      gender: "FEMALE",
      daysPerWeek: 5,
      trainingDays: ["MON", "TUE", "THU", "FRI", "SAT"],
      equipment: "HOME_GYM",
      injuries: "Right knee on deep squats",
      weakness: "RECOVERY",
      motivation: "CONFIDENCE",
      sleepQuality: "GOOD",
      dreamOutcome: "MIRROR",
      focusMuscles: ["BACK", "LEGS"],
      sessionMinutes: 60,
      exercisesPerSession: 5,
      targetWeightKg: 72,
      startingWeightKg: 85,
      username: "ironwolf",
      displayName: "Marcus Vale",
    };

    const publicStats = buildPublicStats({ ...DEFAULT_STATE, profile });
    const restored = profileFromAccount({
      ...BASE,
      goal: profile.goal,
      experience: profile.experience,
      gender: profile.gender,
      age: profile.age,
      weight_kg: profile.weightKg,
      height_cm: profile.heightCm,
      days_per_week: profile.daysPerWeek,
      equipment: profile.equipment,
      public_stats: publicStats,
    });

    for (const key of [
      "trainingDays",
      "injuries",
      "weakness",
      "motivation",
      "sleepQuality",
      "dreamOutcome",
      "focusMuscles",
      "sessionMinutes",
      "exercisesPerSession",
      "targetWeightKg",
      "startingWeightKg",
    ] as const) {
      expect(restored?.[key], `${key} was dropped on rebuild`).toEqual(profile[key]);
    }
  });
});
