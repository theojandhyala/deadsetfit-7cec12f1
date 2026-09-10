import { expect, it } from "vitest";
import { habitProgress } from "./habit-progress";

it.each([
  [90, 100, 90, false],
  [80, 100, 80, false],
  [99.99, 100, 99, false],
  [100, 100, 100, true],
  [120, 100, 100, true],
  [-1, 100, 0, false],
  [NaN, 100, 0, false],
  [Infinity, 100, 0, false],
  [10, 0, 0, false],
  [10, NaN, 0, false],
])("reports honest progress for %s of %s", (current, target, percent, complete) => {
  expect(habitProgress(current as number, target as number)).toMatchObject({ percent, complete });
});
