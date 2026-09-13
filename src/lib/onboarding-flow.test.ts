import { describe, expect, it } from "vitest";

import {
  DEEPER_QUESTION_COUNT,
  isDeeperStep,
  ONBOARDING_CHAPTERS,
  onboardingAutoAdvances,
  onboardingChapterIndex,
  onboardingOrder,
  onboardingProgress,
  onboardingStageLabel,
  type OnboardingActiveStep,
} from "./onboarding-flow";

describe("onboardingOrder", () => {
  it("asks for units before it asks for a bodyweight", () => {
    // Not cosmetic ordering. Bodyweight is the denominator of every strength
    // grade, so a pound athlete typing 180 into a field that stores kilograms
    // makes every muscle they own look twice as strong as it is — and nothing
    // downstream can detect it later.
    const order = onboardingOrder();
    expect(order.indexOf("units")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("units")).toBeLessThan(order.indexOf("weight"));
  });

  it("walks the express setup one decision at a time", () => {
    const expected: OnboardingActiveStep[] = [
      "welcome",
      "name",
      "goal",
      "gender",
      "age",
      "units",
      "weight",
      "height",
      "experience",
      "days",
      "equipment",
      "focus",
      "session",
      "depth",
      "mode",
      "analyzing",
      "schedule",
      "notifications",
      "username",
      "blueprint",
    ];
    expect(onboardingOrder("EXPRESS")).toEqual(expected);
    // No answer yet is the express walk, so the header never promises more
    // screens than the athlete has agreed to.
    expect(onboardingOrder(null)).toEqual(expected);
    expect(onboardingOrder()).toEqual(expected);
  });

  it("inserts the deeper questions between the fork and the week, and only then", () => {
    const express = onboardingOrder("EXPRESS");
    const full = onboardingOrder("FULL");
    const extra = full.filter((step) => !express.includes(step));

    expect(extra).toEqual(["why", "sleep", "weakness", "injuries", "lifts"]);
    expect(extra).toHaveLength(DEEPER_QUESTION_COUNT);
    // Express is a strict subset: choosing speed must never skip an answer the
    // first week actually needs.
    expect(full.filter((step) => express.includes(step))).toEqual(express);
    for (const step of extra) {
      expect(full.indexOf(step)).toBeGreaterThan(full.indexOf("depth"));
      expect(full.indexOf(step)).toBeLessThan(full.indexOf("mode"));
      expect(isDeeperStep(step)).toBe(true);
    }
  });

  it("keeps every plan-shaping answer out of the optional block", () => {
    // Anything the split, the loads or the grades are built from has to be in
    // the essentials, or an express setup silently produces a worse week.
    for (const essential of [
      "goal",
      "gender",
      "age",
      "units",
      "weight",
      "height",
      "experience",
      "days",
      "equipment",
      "focus",
      "session",
    ] as const) {
      expect(isDeeperStep(essential)).toBe(false);
      expect(onboardingOrder("EXPRESS")).toContain(essential);
    }
  });

  it("asks the athlete's name before any screen that would address them by it", () => {
    const order = onboardingOrder();
    expect(order.indexOf("name")).toBeLessThan(order.indexOf("goal"));
    expect(order.indexOf("name")).toBeLessThan(order.indexOf("mode"));
    expect(order.indexOf("name")).toBeLessThan(order.indexOf("depth"));
  });

  it("only asks how to build the week once every answer that shapes it is in", () => {
    // "Generate it for me or let me build it" is a real decision. Asked first it
    // is a guess; asked here the athlete has already seen their own data.
    const order = onboardingOrder();
    for (const shaping of ["goal", "days", "equipment", "focus", "session", "depth"] as const) {
      expect(order.indexOf(shaping)).toBeLessThan(order.indexOf("mode"));
    }
    expect(order.indexOf("mode")).toBeLessThan(order.indexOf("schedule"));
  });

  it("reviews the built week before it asks anyone to commit to a trial", () => {
    const order = onboardingOrder();
    expect(order.indexOf("schedule")).toBeLessThan(order.indexOf("blueprint"));
    expect(order.at(-1)).toBe("blueprint");
  });

  it("opens on a screen that asks for nothing", () => {
    expect(onboardingOrder()[0]).toBe("welcome");
  });
});

describe("chapters", () => {
  it("gives every step a chapter", () => {
    for (const step of onboardingOrder("FULL")) {
      expect(ONBOARDING_CHAPTERS).toContain(onboardingStageLabel(step));
      expect(onboardingChapterIndex(step)).toBeGreaterThanOrEqual(0);
    }
  });

  it("never moves a walker backwards through the chapter rail", () => {
    // The rail is the only progress cue on screens that fill the viewport, so a
    // chapter that regresses reads as lost work.
    const indexes = onboardingOrder("FULL").map(onboardingChapterIndex);
    for (let i = 1; i < indexes.length; i += 1) {
      expect(indexes[i]).toBeGreaterThanOrEqual(indexes[i - 1]);
    }
  });

  it("labels the ends of the walk", () => {
    expect(onboardingStageLabel("welcome")).toBe("START");
    expect(onboardingStageLabel("units")).toBe("BODY");
    expect(onboardingStageLabel("lifts")).toBe("DEEPER");
    expect(onboardingStageLabel("blueprint")).toBe("READY");
  });
});

describe("onboardingProgress", () => {
  it("opens empty and finishes full, on either walk", () => {
    expect(onboardingProgress("welcome")).toBe(0);
    expect(onboardingProgress("blueprint")).toBe(100);
    expect(onboardingProgress("welcome", "FULL")).toBe(0);
    expect(onboardingProgress("blueprint", "FULL")).toBe(100);
  });

  it("rises monotonically across both walks", () => {
    for (const depth of ["EXPRESS", "FULL"] as const) {
      const values = onboardingOrder(depth).map((step) => onboardingProgress(step, depth));
      for (let i = 1; i < values.length; i += 1) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    }
  });

  it("reads a deeper step against the walk that actually contains it", () => {
    // Asked about a step only the full walk has, it must not measure against
    // an express order that never contains it and report 0%.
    expect(onboardingProgress("lifts")).toBeGreaterThan(0);
    expect(onboardingProgress("lifts")).toBeLessThan(100);
  });
});

describe("onboardingAutoAdvances", () => {
  it("advances single-tap questions on their own", () => {
    expect(onboardingAutoAdvances("goal")).toBe(true);
    expect(onboardingAutoAdvances("gender")).toBe(true);
  });

  it("never auto-advances a screen that needs a typed value, a review or a permission", () => {
    // Advancing off these would either discard what the athlete was entering or
    // answer a system prompt on their behalf.
    for (const step of [
      "name",
      "age",
      "weight",
      "height",
      "days",
      "focus",
      "injuries",
      "lifts",
      "schedule",
      "notifications",
      "username",
      "blueprint",
    ] as const) {
      expect(onboardingAutoAdvances(step)).toBe(false);
    }
  });

  it("only claims steps that are actually in the walk", () => {
    const order = onboardingOrder("FULL");
    for (const step of order) {
      if (onboardingAutoAdvances(step)) expect(order).toContain(step);
    }
  });
});
