import { describe, it, expect } from "vitest";

import { headlineUnlock, newlyUnlocked } from "./achievement-unlocks";

describe("newlyUnlocked", () => {
  it("returns only ids that were not already seen", () => {
    expect(newlyUnlocked(["a", "first-rep", "pr-1"], ["a"])).toEqual(["first-rep", "pr-1"]);
  });

  it("returns nothing when everything is already seen", () => {
    expect(newlyUnlocked(["first-rep"], ["first-rep"])).toEqual([]);
  });

  it("treats an empty seen set as everything being new", () => {
    expect(newlyUnlocked(["first-rep"], [])).toEqual(["first-rep"]);
  });

  it("never invents ids that are not currently unlocked", () => {
    expect(newlyUnlocked([], ["first-rep"])).toEqual([]);
  });
});

describe("headlineUnlock", () => {
  it("picks the rarest badge when several land together", () => {
    // first-rep is COMMON, streak-100 is LEGENDARY.
    expect(headlineUnlock(["first-rep", "streak-100"], "kg")?.id).toBe("streak-100");
  });

  it("keeps the only badge when there is one", () => {
    expect(headlineUnlock(["first-rep"], "kg")?.id).toBe("first-rep");
  });

  it("returns null for an empty list", () => {
    expect(headlineUnlock([], "kg")).toBeNull();
  });

  it("ignores ids that are not in the catalog", () => {
    expect(headlineUnlock(["not-a-badge"], "kg")).toBeNull();
    expect(headlineUnlock(["not-a-badge", "first-rep"], "kg")?.id).toBe("first-rep");
  });
});
