import { describe, it, expect } from "vitest";

import { calculateGritScore, type GritScoreBreakdown } from "./calc";
import { GRIT_POINTS, gritNextStep, gritSources, nextGritTier } from "./grit-explainer";
import { DEFAULT_STATE } from "./default-state";
import type { AppState, Profile } from "./types";

function b(over: Partial<GritScoreBreakdown> = {}): GritScoreBreakdown {
  return {
    streak: 0,
    prs: 0,
    caloriesHit: 0,
    proteinHit: 0,
    checkIns: 0,
    measurements: 0,
    decay: 0,
    total: 0,
    ...over,
  };
}

describe("gritSources", () => {
  it("shows nothing for an athlete who has not earned any", () => {
    expect(gritSources(b())).toEqual([]);
  });

  it("orders contributions biggest first", () => {
    const rows = gritSources(b({ streak: 2, checkIns: 1 }));
    expect(rows.map((r) => r.key)).toEqual(["checkIns", "streak"]);
    expect(rows[0].points).toBe(50);
    expect(rows[1].points).toBe(30);
  });

  it("states the athlete's own arithmetic", () => {
    expect(gritSources(b({ streak: 3 }))[0].detail).toBe("3 days × 15");
    expect(gritSources(b({ streak: 1 }))[0].detail).toBe("1 day × 15");
  });

  it("surfaces the idle penalty last, as a negative", () => {
    const rows = gritSources(b({ streak: 1, decay: 100 }));
    expect(rows[rows.length - 1].key).toBe("idle");
    expect(rows[rows.length - 1].points).toBe(-100);
  });
});

describe("point values match the real scorer", () => {
  // Guards against the explainer drifting from calculateGritScore and telling
  // athletes a number that is no longer true.
  function scoreWith(over: Partial<AppState>): number {
    const profile: Profile = {
      goal: "BULK",
      experience: "INTERMEDIATE",
      age: 20,
      weightKg: 80,
      heightCm: 180,
      gender: "MALE",
      daysPerWeek: 5,
      equipment: "FULL_GYM",
    };
    return calculateGritScore({ ...DEFAULT_STATE, profile, ...over } as AppState).total;
  }

  it("prices a check-in exactly as advertised", () => {
    const today = new Date().toISOString().slice(0, 10);
    const score = scoreWith({ checkIns: [{ date: today, photoDataUrl: "x" }] });
    expect(score).toBe(GRIT_POINTS.checkIn);
  });

  it("prices a measurement exactly as advertised", () => {
    const today = new Date().toISOString().slice(0, 10);
    const score = scoreWith({
      measurements: [{ date: today, chest: 100, waist: 80, arms: 38, legs: 60 }],
    });
    expect(score).toBe(GRIT_POINTS.measurement);
  });
});

describe("nextGritTier", () => {
  it("points a new athlete at ROOKIE", () => {
    expect(nextGritTier(0)).toEqual({ badge: "ROOKIE", at: 100, remaining: 100 });
  });

  it("counts down to the next rank", () => {
    expect(nextGritTier(240)?.badge).toBe("GRINDER");
    expect(nextGritTier(240)?.remaining).toBe(10);
  });

  it("returns null at the ceiling", () => {
    expect(nextGritTier(1000)).toBeNull();
  });
});

describe("gritNextStep", () => {
  it("clears the penalty before anything else", () => {
    expect(gritNextStep(b({ streak: 5, decay: 100 }))).toMatch(/48-hour/);
  });

  it("sends a new athlete to train first", () => {
    expect(gritNextStep(b())).toMatch(/streak/i);
  });

  it("recommends the highest-value action once training has started", () => {
    expect(gritNextStep(b({ streak: 3 }))).toMatch(/check-in/i);
  });

  it("falls through to keeping the streak when the basics are covered", () => {
    const step = gritNextStep(b({ streak: 3, checkIns: 1, prs: 1, proteinHit: 1 }));
    expect(step).toMatch(/streak alive/i);
  });
});

describe("a brand-new account", () => {
  it("is not penalised for being idle before it has logged anything", () => {
    const profile: Profile = {
      goal: "BULK",
      experience: "BEGINNER",
      age: 18,
      weightKg: 72,
      heightCm: 178,
      gender: "MALE",
      daysPerWeek: 5,
      equipment: "FULL_GYM",
    };
    const fresh = calculateGritScore({ ...DEFAULT_STATE, profile } as AppState);
    expect(fresh.decay).toBe(0);
    expect(gritSources(fresh)).toEqual([]);
    expect(gritNextStep(fresh)).toMatch(/streak/i);
  });

  it("still penalises an account that logged something and then went quiet", () => {
    const profile: Profile = {
      goal: "BULK",
      experience: "BEGINNER",
      age: 18,
      weightKg: 72,
      heightCm: 178,
      gender: "MALE",
      daysPerWeek: 5,
      equipment: "FULL_GYM",
    };
    const lapsed = calculateGritScore({
      ...DEFAULT_STATE,
      profile,
      completedDates: ["2026-01-05"],
    } as AppState);
    expect(lapsed.decay).toBe(100);
  });
});
