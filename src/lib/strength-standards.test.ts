import { describe, expect, it } from "vitest";

import { strengthStandard } from "./strength-standards";

describe("strengthStandard", () => {
  it("keeps an unspecified reference ungraded instead of silently using male standards", () => {
    expect(strengthStandard(100, 80, "bench-press", "OTHER")).toBeNull();
    expect(strengthStandard(100, 80, "bench-press", null)).toBeNull();
    expect(strengthStandard(100, 80, "bench-press", undefined)).toBeNull();
  });

  it("still grades an explicitly chosen reference", () => {
    expect(strengthStandard(100, 80, "bench-press", "MALE")?.tier).toBe("INTERMEDIATE");
    expect(strengthStandard(100, 80, "bench-press", "FEMALE")?.tier).toBe("ELITE");
  });
});
