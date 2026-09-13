import { describe, expect, it } from "vitest";

import {
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

  it("walks one decision at a time, and asks the same walk whichever mode is chosen", () => {
    const expected: OnboardingActiveStep[] = [
      "welcome",
      "name",
      "goal",
      "why",
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
      "sleep",
      "weakness",
      "mode",
      "analyzing",
      "schedule",
      "notifications",
      "username",
      "blueprint",
    ];
    expect(onboardingOrder("GENERATE")).toEqual(expected);
    expect(onboardingOrder("BUILD")).toEqual(expected);
    expect(onboardingOrder(null)).toEqual(expected);
  });

  it("asks the athlete's name before any screen that would address them by it", () => {
    const order = onboardingOrder();
    expect(order.indexOf("name")).toBeLessThan(order.indexOf("goal"));
    expect(order.indexOf("name")).toBeLessThan(order.indexOf("mode"));
  });

  it("only asks how to build the week once every answer that shapes it is in", () => {
    // "Generate it for me or let me build it" is a real decision. Asked first it
    // is a guess; asked here the athlete has already seen their own data.
    const order = onboardingOrder();
    for (const shaping of ["goal", "days", "equipment", "focus", "session"] as const) {
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
    for (const step of onboardingOrder()) {
      expect(ONBOARDING_CHAPTERS).toContain(onboardingStageLabel(step));
      expect(onboardingChapterIndex(step)).toBeGreaterThanOrEqual(0);
    }
  });

  it("never moves a walker backwards through the chapter rail", () => {
    // The rail is the only progress cue on screens that fill the viewport, so a
    // chapter that regresses reads as lost work.
    const indexes = onboardingOrder().map(onboardingChapterIndex);
    for (let i = 1; i < indexes.length; i += 1) {
      expect(indexes[i]).toBeGreaterThanOrEqual(indexes[i - 1]);
    }
  });

  it("labels the ends of the walk", () => {
    expect(onboardingStageLabel("welcome")).toBe("START");
    expect(onboardingStageLabel("units")).toBe("BODY");
    expect(onboardingStageLabel("blueprint")).toBe("READY");
  });
});

describe("onboardingProgress", () => {
  it("opens empty and finishes full", () => {
    expect(onboardingProgress("welcome")).toBe(0);
    expect(onboardingProgress("blueprint")).toBe(100);
  });

  it("rises monotonically across the walk", () => {
    const values = onboardingOrder().map(onboardingProgress);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
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
      "schedule",
      "notifications",
      "username",
      "blueprint",
    ] as const) {
      expect(onboardingAutoAdvances(step)).toBe(false);
    }
  });

  it("only claims steps that are actually in the walk", () => {
    const order = onboardingOrder();
    for (const step of order) {
      if (onboardingAutoAdvances(step)) expect(order).toContain(step);
    }
  });
});
