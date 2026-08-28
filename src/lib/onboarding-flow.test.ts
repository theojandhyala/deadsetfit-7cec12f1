import { describe, expect, it } from "vitest";

import { onboardingOrder, onboardingStageLabel } from "./onboarding-flow";

describe("onboardingOrder", () => {
  it("asks for units before it asks for a bodyweight", () => {
    // Not cosmetic ordering. Bodyweight is the denominator of every strength
    // grade, so a pound athlete typing 180 into a field that stores kilograms
    // makes every muscle they own look twice as strong as it is — and nothing
    // downstream can detect it later.
    const order = onboardingOrder("GENERATE");
    expect(order.indexOf("units")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("units")).toBeLessThan(order.indexOf("about"));
  });

  it("keeps generated setup concise while requiring real body data and a week review", () => {
    expect(onboardingOrder("GENERATE")).toEqual([
      "mode",
      "goal",
      "units",
      "about",
      "days",
      "equipment",
      "preferences",
      "schedule",
      "notifications",
      "username",
      "blueprint",
    ]);
  });

  it("requires custom setup to review an editable, usable week", () => {
    expect(onboardingOrder("BUILD")).toEqual([
      "mode",
      "goal",
      "units",
      "about",
      "days",
      "equipment",
      "preferences",
      "schedule",
      "notifications",
      "username",
      "blueprint",
    ]);
    expect(onboardingStageLabel("blueprint")).toBe("READY");
    expect(onboardingStageLabel("units")).toBe("YOU");
    expect(onboardingStageLabel("notifications")).toBe("STAY ON TRACK");
  });
});
