import { describe, expect, it } from "vitest";

import { GROWTH_GOAL_OPTIONS, GROWTH_TARGET_OPTIONS } from "./muscle-growth-recommendations";
import { buildMusclePlaybook } from "./muscle-playbook";

describe("buildMusclePlaybook", () => {
  it("covers every selectable muscle target and goal with complete deterministic guidance", () => {
    for (const target of GROWTH_TARGET_OPTIONS) {
      for (const goal of GROWTH_GOAL_OPTIONS) {
        const playbook = buildMusclePlaybook({
          target: target.id,
          goal: goal.id,
          experience: "INTERMEDIATE",
          currentWeeklySets: 10,
          recoveryPct: 80,
        });
        expect(playbook.target).toBe(target.id);
        expect(playbook.priorities.length).toBeGreaterThanOrEqual(3);
        expect(playbook.movementRoles.length).toBeGreaterThanOrEqual(3);
        expect(playbook.techniqueCues.length).toBeGreaterThanOrEqual(4);
        expect(playbook.commonMistakes.length).toBeGreaterThanOrEqual(3);
        expect(playbook.recoveryChecks.length).toBeGreaterThanOrEqual(3);
        expect(playbook.weeklySets.max).toBeGreaterThan(playbook.weeklySets.min);
        expect(playbook.progressionRule.length).toBeGreaterThan(50);
      }
    }
  });

  it("scales the starting set range by training experience", () => {
    const input = { target: "CHEST" as const, goal: "SIZE" as const, currentWeeklySets: 0, recoveryPct: 100 };
    const beginner = buildMusclePlaybook({ ...input, experience: "BEGINNER" });
    const advanced = buildMusclePlaybook({ ...input, experience: "ADVANCED" });
    expect(advanced.weeklySets.min).toBeGreaterThan(beginner.weeklySets.min);
    expect(advanced.weeklySets.max).toBeGreaterThan(beginner.weeklySets.max);
  });

  it("puts recovery ahead of blindly adding volume", () => {
    const playbook = buildMusclePlaybook({
      target: "BACK_WIDTH",
      goal: "SIZE",
      experience: "INTERMEDIATE",
      currentWeeklySets: 2,
      recoveryPct: 30,
    });
    expect(playbook.sessionCall).toMatch(/Recovery is low/i);
    expect(playbook.sessionCall).not.toMatch(/add work/i);
  });

  it("does not claim the set range is a medical prescription", () => {
    const playbook = buildMusclePlaybook({
      target: "CORE",
      goal: "BALANCE",
      experience: null,
      currentWeeklySets: Number.NaN,
      recoveryPct: 999,
    });
    expect(playbook.evidenceNote).toMatch(/not a medical prescription/i);
    expect(playbook.sessionCall).toMatch(/below the starting range/i);
  });
});
