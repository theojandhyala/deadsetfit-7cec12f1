import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * No screen may hardcode a unit.
 *
 * Weight is stored in kilograms and shown in whatever the athlete chose. A
 * literal "kg" in the UI is therefore a bug by construction: it will be wrong
 * for every pound user, and — worse — it will disagree with the screens that
 * do convert, so the same lift reads as two different numbers depending on
 * where you look. That is exactly the state this app was in before.
 *
 * Deliberately narrow: it looks for unit literals in rendered strings, not for
 * the word "kg" in identifiers like `weightKg` (which is correct — that IS
 * kilograms) or in comments.
 */
const roots = ["src/routes", "src/components"];

/** `>kg<`, `"... kg"`, `{x}kg`, `KG</span>` — a unit shown to a person. */
const RENDERED_UNIT = /(?:>|\}|\s|")(kg|KG|lb|LB)(?:<|\s*<|"|\/)/;

/** Files that legitimately name a unit: the units UI, and canvas share cards. */
const ALLOWED = new Set([
  // The settings toggle whose whole job is choosing between them.
  "settings.tsx",
]);

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const root of roots) {
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".tsx") && !ALLOWED.has(entry.name)) out.push(path);
      }
    };
    walk(join(process.cwd(), root));
  }
  return out;
}

/**
 * Only lines that put a unit in front of a person.
 *
 * A unit appearing as data is fine and often correct: `unit: "kg"` marks a
 * PR as a load, `=== "kg"` branches on that marker, `useState("kg")` is a
 * default, and the picker itself must name both. What must never appear is a
 * unit rendered as text, because that is the one a pound user sees and the one
 * that will disagree with the screens that convert.
 */
const DATA_NOT_DISPLAY = [
  /\bunit:\s*"/, // a marker on a record
  /===\s*"(kg|lb)"/, // branching on that marker
  /useState<WeightUnit>/, // a default
  /\["kg",\s*"lb"\]/, // the picker offering both
  /\?\s*"Kilograms"/, // the picker's own labels
];

function renderedText(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .filter((line) => !line.includes("aria-label"))
    .filter((line) => !DATA_NOT_DISPLAY.some((pattern) => pattern.test(line)));
}

describe("weight units", () => {
  const files = sourceFiles();

  it("finds the screens to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [f.split("/src/")[1]!, f]))(
    "%s renders no hardcoded unit",
    (_name, path) => {
      const offenders = renderedText(readFileSync(path, "utf8"))
        .map((line, index) => ({ line: line.trim(), index }))
        .filter(({ line }) => RENDERED_UNIT.test(line));
      expect(offenders).toEqual([]);
    },
  );
});

/**
 * No function may default its unit.
 *
 * The literal check above cannot see this class of bug: `formatSet(set, true)`
 * contains no "kg" for it to find, yet it rendered kilograms to a pound
 * athlete on the most-used screen in the app, directly beside completed sets
 * showing pounds. Two live call sites had quietly taken the default.
 *
 * A unit is never a sensible default. Requiring the argument turns a silent
 * wrong answer into a compile error, and this test keeps it that way.
 */
describe("weight units are never defaulted", () => {
  const DEFAULTED_UNIT = /\b(?:unit|weightUnit)\s*(?::\s*WeightUnit)?\s*=\s*["'](?:kg|lb)["']/;

  function libFiles(): string[] {
    const dir = join(process.cwd(), "src/lib");
    return (
      readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
        .filter((entry) => !entry.name.endsWith(".test.ts"))
        // units.ts owns the concept and may name a fallback in one place: the
        // athlete's stored preference, when they have not chosen yet.
        .filter((entry) => entry.name !== "units.ts")
        .map((entry) => join(dir, entry.name))
    );
  }

  it("no library function takes a unit with a default value", () => {
    const offenders: { file: string; line: string }[] = [];
    for (const file of libFiles()) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (DEFAULTED_UNIT.test(line)) offenders.push({ file, line: line.trim() });
      }
    }
    expect(offenders).toEqual([]);
  });
});
