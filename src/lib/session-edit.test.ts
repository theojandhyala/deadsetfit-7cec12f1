import { describe, expect, it } from "vitest";

import { indexAfterMove, indexAfterRemoval, moveItem } from "./session-edit";

describe("moveItem", () => {
  it("moves an item later and earlier", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("refuses to move past either end", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("leaves the original array alone", () => {
    const items = ["a", "b"];
    moveItem(items, 0, 1);
    expect(items).toEqual(["a", "b"]);
  });
});

describe("indexAfterMove", () => {
  it("follows the movement you moved", () => {
    expect(indexAfterMove(1, 1, 1)).toBe(2);
    expect(indexAfterMove(2, 2, -1)).toBe(1);
  });

  it("follows the movement that got displaced", () => {
    expect(indexAfterMove(2, 1, 1)).toBe(1);
  });

  it("leaves an unaffected cursor alone", () => {
    expect(indexAfterMove(0, 2, 1)).toBe(0);
    expect(indexAfterMove(4, 1, 1)).toBe(4);
  });
});

describe("indexAfterRemoval", () => {
  it("shifts back when something earlier was removed", () => {
    expect(indexAfterRemoval(3, 1, 5)).toBe(2);
  });

  it("stays put when something later was removed", () => {
    expect(indexAfterRemoval(1, 3, 5)).toBe(1);
  });

  it("holds position when the current movement is removed", () => {
    // Looking at index 2 of 5; removing it slides the next one into place.
    expect(indexAfterRemoval(2, 2, 5)).toBe(2);
  });

  it("steps back when the last movement is removed while active", () => {
    expect(indexAfterRemoval(3, 3, 4)).toBe(2);
  });

  it("never goes negative on a two-item session", () => {
    expect(indexAfterRemoval(0, 0, 2)).toBe(0);
    expect(indexAfterRemoval(1, 1, 2)).toBe(0);
  });
});
