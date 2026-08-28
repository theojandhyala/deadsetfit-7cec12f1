import { describe, expect, it } from "vitest";

import { onboardingOrder, onboardingStageLabel } from "./onboarding-flow";

describe("onboardingOrder", () => {
  it("keeps generated setup concise while requiring real body data and a week review", () => {
    expect(onboardingOrder("GENERATE")).toEqual([
      "mode",
      "goal",
      "about",
      "days",
      "equipment",
      "preferences",
      "schedule",
      "username",
      "blueprint",
    ]);
  });

  it("requires custom setup to review an editable, usable week", () => {
    expect(onboardingOrder("BUILD")).toEqual([
      "mode",
      "goal",
      "about",
      "days",
      "equipment",
      "preferences",
      "schedule",
      "username",
      "blueprint",
    ]);
    expect(onboardingStageLabel("blueprint")).toBe("READY");
  });
});
