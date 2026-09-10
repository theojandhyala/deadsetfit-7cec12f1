import { expect, it } from "vitest";
import { strengthGoalInput } from "./strength-goal-input";

it("keeps kilogram input unchanged and accepts decimal commas", () => {
  expect(strengthGoalInput("102,5", "kg", 100)).toBe(102.5);
});
it("converts pound input before comparing or persisting", () => {
  expect(strengthGoalInput("225", "lb", 100)).toBe(102.06);
  expect(strengthGoalInput("200", "lb", 100)).toBeNull();
});
it.each(["0", "-1", "100", "50", "100kg", "1e3", ""])(
  "rejects invalid or already reached target %s",
  (raw) => {
    expect(strengthGoalInput(raw, "kg", 100)).toBeNull();
  },
);
