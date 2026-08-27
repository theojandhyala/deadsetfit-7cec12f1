import { describe, expect, it } from "vitest";

import { BODY_CONTENT, MUSCLE_SHAPES, bodySilhouette } from "./body-shapes";

/** The x each subpath starts at — its absolute `M`. */
function subpathOrigins(d: string): number[] {
  return [...d.matchAll(/M\s*(-?\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
}

/** Leftmost x any muscle shape starts at, and the rightmost. */
function muscleXExtremes(): [number, number] {
  const xs: number[] = [];
  for (const shape of Object.values(MUSCLE_SHAPES)) {
    for (const d of [...(shape.f ?? []), ...(shape.b ?? [])]) xs.push(...subpathOrigins(d));
  }
  return [Math.min(...xs), Math.max(...xs)];
}

describe("the body silhouette", () => {
  const silhouette = bodySilhouette();

  it("is made of several subpaths, not one outline", () => {
    // Head, torso, two arms, two legs — a single stroke cannot reach all of
    // the coordinates the muscle shapes were drawn against.
    expect(silhouette.match(/M/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("has a limb wherever the arm muscles are drawn", () => {
    // Forearms start at x=40 and biceps at x=44; a torso-only silhouette
    // leaves those rendering as slivers floating beside the body, which is
    // exactly what shipped before. The arm subpaths are what fixed it.
    const origins = subpathOrigins(silhouette);
    expect(Math.min(...origins), "no left-side limb").toBeLessThanOrEqual(76);
    expect(Math.max(...origins), "no right-side limb").toBeGreaterThanOrEqual(124);
  });

  it("declares bounds wide enough for every muscle it must contain", () => {
    // This is the number everything scales by, so it is the one that decides
    // whether a shape lands on the body or beside it.
    const [leftmost, rightmost] = muscleXExtremes();
    expect(BODY_CONTENT.x).toBeLessThanOrEqual(leftmost);
    expect(BODY_CONTENT.x + BODY_CONTENT.width).toBeGreaterThanOrEqual(rightmost);
  });

  it("declares content bounds that contain the muscle shapes", () => {
    const right = BODY_CONTENT.x + BODY_CONTENT.width;
    const bottom = BODY_CONTENT.y + BODY_CONTENT.height;
    for (const [region, shape] of Object.entries(MUSCLE_SHAPES)) {
      for (const d of [...(shape.f ?? []), ...(shape.b ?? [])]) {
        const startX = Number(/M\s*(-?\d+(?:\.\d+)?)/.exec(d)?.[1] ?? 0);
        const startY = Number(/M\s*-?\d+(?:\.\d+)?\s+(-?\d+(?:\.\d+)?)/.exec(d)?.[1] ?? 0);
        expect(startX, `${region} starts left of the body`).toBeGreaterThanOrEqual(BODY_CONTENT.x);
        expect(startX, `${region} starts right of the body`).toBeLessThanOrEqual(right);
        expect(startY, `${region} starts above the body`).toBeGreaterThanOrEqual(BODY_CONTENT.y);
        expect(startY, `${region} starts below the body`).toBeLessThanOrEqual(bottom);
      }
    }
  });

  it("has content bounds narrower and shorter than the raw viewBox", () => {
    // The whole point: scaling by 200x420 draws a body smaller than the space
    // it was given, ringed by padding.
    expect(BODY_CONTENT.width).toBeLessThan(200);
    expect(BODY_CONTENT.height).toBeLessThan(420);
  });

  it("draws every muscle region on at least one side", () => {
    for (const [region, shape] of Object.entries(MUSCLE_SHAPES)) {
      expect((shape.f?.length ?? 0) + (shape.b?.length ?? 0), region).toBeGreaterThan(0);
    }
  });

  it("covers every graded muscle group's regions", () => {
    // The strength map colours by group; a region named there but missing here
    // silently colours nothing.
    const required = [
      "chest",
      "lats",
      "traps",
      "quads",
      "hamstrings",
      "glutes",
      "calves",
      "biceps",
      "triceps",
      "forearms",
      "core",
      "obliques",
      "shoulders",
    ];
    for (const region of required) expect(Object.keys(MUSCLE_SHAPES)).toContain(region);
  });
});
