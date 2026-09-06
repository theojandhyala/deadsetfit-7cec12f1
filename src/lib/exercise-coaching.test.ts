import { describe, it, expect } from "vitest";

import { COACHED_EXERCISE_IDS, coachingFor } from "./exercise-coaching";
import { EXERCISES } from "./exercises";

describe("coverage", () => {
  it("coaches every bundled exercise by name", () => {
    const missing = EXERCISES.filter((e) => !coachingFor(e.id, e.name)).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("has a bespoke entry for every bundled exercise, not just a pattern", () => {
    const bundled = new Set(EXERCISES.map((e) => e.id));
    const uncovered = [...bundled].filter((id) => !COACHED_EXERCISE_IDS.includes(id));
    expect(uncovered).toEqual([]);
  });

  it("gives every entry setup, execution, mistakes and breathing", () => {
    for (const id of COACHED_EXERCISE_IDS) {
      const c = coachingFor(id);
      expect(c, id).not.toBeNull();
      expect(c!.setup.length, id).toBeGreaterThan(0);
      expect(c!.execution.length, id).toBeGreaterThan(0);
      expect(c!.mistakes.length, id).toBeGreaterThan(0);
      expect(c!.breathing.length, id).toBeGreaterThan(0);
    }
  });

  it("states a fix for every mistake", () => {
    for (const id of COACHED_EXERCISE_IDS) {
      for (const m of coachingFor(id)!.mistakes) {
        expect(m.wrong.length, id).toBeGreaterThan(0);
        expect(m.fix.length, id).toBeGreaterThan(0);
      }
    }
  });
});

describe("pattern fallback", () => {
  it("covers a library exercise with no bespoke entry", () => {
    const c = coachingFor("preacher-curl-machine", "Preacher Curl Machine");
    expect(c?.setup.join(" ")).toContain("Elbows");
  });

  it("matches on the name when the id is opaque", () => {
    expect(coachingFor("a1b2c3", "Hack Squat")).not.toBeNull();
    expect(coachingFor("a1b2c3", "Seated Cable Row")).not.toBeNull();
  });

  it("stays silent rather than inventing advice for something unrecognised", () => {
    expect(coachingFor("zzz", "Sauna")).toBeNull();
  });
});
