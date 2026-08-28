import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MuscleDiagram } from "./MuscleDiagram";

const LIVE_EXERCISE_MUSCLES = [
  "adductors",
  "back",
  "biceps",
  "brachialis",
  "calves",
  "chest",
  "core",
  "forearms",
  "front-delts",
  "glutes",
  "hamstrings",
  "hip-flexors",
  "lats",
  "lower-back",
  "mid-back",
  "obliques",
  "quads",
  "rear-delts",
  "rotator-cuff",
  "shoulders",
  "side-delts",
  "traps",
  "triceps",
  "upper-back",
  "upper-chest",
] as const;

function musclePaths(markup: string, group: string) {
  return (markup.match(/<path\b[^>]*>/g) ?? []).filter((path) =>
    path.includes(`data-muscle-group="${group}"`),
  );
}

function expectGroupFill(markup: string, group: string, color: string) {
  const paths = musclePaths(markup, group);
  expect(paths.length).toBeGreaterThan(0);
  expect(paths.every((path) => path.includes(`fill="${color}"`))).toBe(true);
}

describe("MuscleDiagram", () => {
  it("colours every anatomical region represented by a broad strength grade", () => {
    const markup = renderToStaticMarkup(
      <MuscleDiagram
        view="both"
        gradeColors={{
          CHEST: "#f97316",
          BACK: "#22c55e",
          LEGS: "#a855f7",
          SHOULDERS: "#3b82f6",
          ARMS: "#ec4899",
          CORE: "#eab308",
        }}
      />,
    );

    expectGroupFill(markup, "CHEST", "#f97316");
    expectGroupFill(markup, "LATS", "#22c55e");
    expectGroupFill(markup, "BACK_LOWER", "#22c55e");
    expectGroupFill(markup, "QUADS", "#a855f7");
    expectGroupFill(markup, "HAMSTRINGS", "#a855f7");
    expectGroupFill(markup, "HIP_FLEXORS", "#a855f7");
    expectGroupFill(markup, "SHOULDERS_FRONT", "#3b82f6");
    expectGroupFill(markup, "SHOULDERS_REAR", "#3b82f6");
    expectGroupFill(markup, "BICEPS", "#ec4899");
    expectGroupFill(markup, "TRICEPS", "#ec4899");
    expectGroupFill(markup, "CORE", "#eab308");
    expectGroupFill(markup, "OBLIQUES", "#eab308");
  });

  it("maps exercise labels to independently colourable primary and secondary muscles", () => {
    const markup = renderToStaticMarkup(
      <MuscleDiagram
        view="both"
        primary={["Rear delts", "Quadriceps", "Hip flexors"]}
        secondary={["Triceps", "Calves"]}
      />,
    );

    expectGroupFill(markup, "SHOULDERS_REAR", "#f04432");
    expectGroupFill(markup, "QUADS", "#f04432");
    expectGroupFill(markup, "HIP_FLEXORS", "#f04432");
    expectGroupFill(markup, "TRICEPS", "#6b211b");
    expectGroupFill(markup, "CALVES", "#6b211b");
    expectGroupFill(markup, "CHEST", "#292b30");
  });

  it("renders a highlighted surface for every muscle label used by the live exercise library", () => {
    const missing = LIVE_EXERCISE_MUSCLES.filter((label) => {
      const markup = renderToStaticMarkup(<MuscleDiagram primary={[label]} view="both" />);
      return !(markup.match(/<path\b[^>]*>/g) ?? []).some(
        (path) => path.includes("data-muscle-group=") && path.includes('fill="#f04432"'),
      );
    });

    expect(missing).toEqual([]);
  });

  it("renders labelled front and back image views without duplicating an individual view", () => {
    const front = renderToStaticMarkup(<MuscleDiagram view="front" />);
    const back = renderToStaticMarkup(<MuscleDiagram view="back" />);
    const both = renderToStaticMarkup(<MuscleDiagram view="both" />);

    expect(front).toContain('aria-label="Front muscle anatomy"');
    expect(front).not.toContain('aria-label="Back muscle anatomy"');
    expect(back).toContain('aria-label="Back muscle anatomy"');
    expect(back).not.toContain('aria-label="Front muscle anatomy"');
    expect((both.match(/role="img"/g) ?? []).length).toBe(2);
  });

  it("ignores an unexpected persisted grade key instead of crashing the report", () => {
    expect(() =>
      renderToStaticMarkup(
        <MuscleDiagram gradeColors={{ UNKNOWN: "#ffffff" } as never} view="front" />,
      ),
    ).not.toThrow();
  });
});
