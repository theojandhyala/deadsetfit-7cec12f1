import { describe, it, expect } from "vitest";

import { supersetPairs } from "./superset-suggest";

describe("supersetPairs", () => {
  it("pairs a push with a pull from the day's plan", () => {
    const pairs = supersetPairs([
      { name: "Bench Press", muscle: "CHEST" },
      { name: "Barbell Row", muscle: "BACK" },
      { name: "Plank", muscle: "CORE" },
    ]);
    expect(pairs).toEqual([{ push: "Bench Press", pull: "Barbell Row" }]);
  });

  it("caps at two pairs", () => {
    const pairs = supersetPairs([
      { name: "Overhead Press" },
      { name: "Lat Pulldown" },
      { name: "Tricep Pushdown" },
      { name: "Hammer Curl" },
      { name: "Cable Fly" },
      { name: "Seated Row" },
    ]);
    expect(pairs).toHaveLength(2);
  });

  it("never supersets heavy hinge/squat compounds", () => {
    // "Leg Press" contains "press" but is excluded; deadlift never pairs.
    const pairs = supersetPairs([
      { name: "Leg Press", muscle: "LEGS" },
      { name: "Romanian Deadlift", muscle: "LEGS" },
      { name: "Back Squat", muscle: "LEGS" },
    ]);
    expect(pairs).toHaveLength(0);
  });

  it("never drafts lower-body or core work into an upper pair", () => {
    // "Calf Raise" contains "raise" (a push word) — the exclusion must win,
    // by name and by muscle group alike.
    expect(
      supersetPairs([
        { name: "Calf Raise", muscle: "LEGS" },
        { name: "Barbell Row", muscle: "BACK" },
      ]),
    ).toHaveLength(0);
    expect(
      supersetPairs([
        { name: "Standing Raise", muscle: "calves" },
        { name: "Cable Crunch", muscle: "CORE" },
        { name: "Barbell Row", muscle: "BACK" },
      ]),
    ).toHaveLength(0);
  });

  it("falls back to muscle group when the name says nothing", () => {
    const pairs = supersetPairs([
      { name: "Pec Deck", muscle: "CHEST" },
      { name: "Reverse Pec Deck", muscle: "BACK" },
    ]);
    expect(pairs).toHaveLength(1);
  });

  it("returns nothing on same-direction days", () => {
    expect(
      supersetPairs([{ name: "Bench Press" }, { name: "Incline Press" }, { name: "Cable Fly" }]),
    ).toHaveLength(0);
  });
});
