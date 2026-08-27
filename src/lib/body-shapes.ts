/**
 * The DEADSET body: a stylised front-and-back silhouette with one shape per
 * muscle region.
 *
 * Lives in lib rather than beside a component because two very different
 * screens draw it — the per-exercise diagram, which highlights what a movement
 * works, and the strength map, which colours every region by its grade. Two
 * copies of this anatomy would drift, and the same muscle would end up a
 * different shape depending on where you looked at it.
 *
 * Coordinates target a 200x420 viewBox per side. Not anatomically perfect —
 * tuned to read fast at thumbnail size on a phone.
 */
export const MUSCLE_SHAPES: Record<string, { f?: string[]; b?: string[] }> = {
  chest: { f: ["M70 110 q30 -20 60 0 l-5 35 q-25 12 -50 0 z"] },
  "upper-chest": { f: ["M72 100 q28 -16 56 0 l-3 14 q-25 -10 -50 0 z"] },
  "front-delts": {
    f: [
      "M55 100 q10 -18 22 -6 l-4 24 q-10 6 -18 -2z",
      "M145 100 q-10 -18 -22 -6 l4 24 q10 6 18 -2z",
    ],
  },
  "side-delts": {
    f: ["M48 100 q-6 14 0 28 q8 -2 12 -12 z", "M152 100 q6 14 0 28 q-8 -2 -12 -12 z"],
  },
  "rear-delts": {
    b: ["M48 100 q-6 14 0 28 q8 -2 12 -12 z", "M152 100 q6 14 0 28 q-8 -2 -12 -12 z"],
  },
  shoulders: {
    f: [
      "M55 100 q10 -18 22 -6 l-4 24 q-10 6 -18 -2z",
      "M145 100 q-10 -18 -22 -6 l4 24 q10 6 18 -2z",
    ],
    b: [
      "M55 100 q10 -18 22 -6 l-4 24 q-10 6 -18 -2z",
      "M145 100 q-10 -18 -22 -6 l4 24 q10 6 18 -2z",
    ],
  },
  biceps: { f: ["M44 130 q-8 25 0 50 q12 -4 14 -22 z", "M156 130 q8 25 0 50 q-12 -4 -14 -22 z"] },
  triceps: { b: ["M44 130 q-8 25 0 50 q12 -4 14 -22 z", "M156 130 q8 25 0 50 q-12 -4 -14 -22 z"] },
  forearms: {
    f: ["M40 185 q-4 25 4 50 q10 -2 12 -20 z", "M160 185 q4 25 -4 50 q-10 -2 -12 -20 z"],
    b: ["M40 185 q-4 25 4 50 q10 -2 12 -20 z", "M160 185 q4 25 -4 50 q-10 -2 -12 -20 z"],
  },
  brachialis: { f: ["M50 150 q-4 20 4 30 q8 -2 8 -16 z", "M150 150 q4 20 -4 30 q-8 -2 -8 -16 z"] },
  core: { f: ["M82 150 h36 v55 h-36 z"] },
  obliques: { f: ["M70 150 l8 0 v50 l-10 -6 z", "M130 150 l-8 0 v50 l10 -6 z"] },
  "hip-flexors": { f: ["M82 200 h36 v18 h-36 z"] },
  lats: { b: ["M62 120 q-8 30 -2 60 l22 -4 v-58 z", "M138 120 q8 30 2 60 l-22 -4 v-58 z"] },
  back: { b: ["M70 110 h60 v80 h-60 z"] },
  "mid-back": { b: ["M75 130 h50 v40 h-50 z"] },
  "upper-back": { b: ["M72 105 h56 v30 h-56 z"] },
  traps: { b: ["M85 80 q15 -16 30 0 l-5 30 h-20 z"] },
  "rotator-cuff": {
    b: ["M58 110 q12 -6 18 4 l-4 14 q-10 2 -14 -4 z", "M142 110 q-12 -6 -18 4 l4 14 q10 2 14 -4 z"],
  },
  glutes: { b: ["M75 210 q25 -6 50 0 l-4 40 q-22 8 -42 0 z"] },
  hamstrings: { b: ["M75 260 q12 -2 22 0 v70 l-18 -4 z", "M125 260 q-12 -2 -22 0 v70 l18 -4 z"] },
  quads: { f: ["M75 220 q12 -4 22 0 v80 l-18 -6 z", "M125 220 q-12 -4 -22 0 v80 l18 -6 z"] },
  calves: {
    f: ["M82 320 q8 -2 14 0 v50 l-12 -4 z", "M118 320 q-8 -2 -14 0 v50 l12 -4 z"],
    b: ["M82 320 q8 -2 14 0 v50 l-12 -4 z", "M118 320 q-8 -2 -14 0 v50 l12 -4 z"],
  },
};

/**
 * The outline every muscle shape sits inside.
 *
 * Built as separate subpaths — head, torso, an arm each side, a leg each side —
 * rather than one continuous outline, because the muscle shapes were drawn
 * against specific coordinates and the body has to actually reach them: delts
 * at x 48-77, biceps at x 44-58, forearms from x 40, calves down to y 370. A
 * single-stroke silhouette that misses those leaves coloured shapes floating
 * beside the body, or legs tapering to a point beneath the calves.
 *
 * Filled with a single `fill()`, so overlapping subpaths union cleanly.
 */
export function bodySilhouette(): string {
  // Sits low enough to meet the neck: a head drawn clear of the torso reads
  // as a floating circle, which is exactly how it looked before.
  const head = "M100 26 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0 z";
  const torso =
    "M88 40 h24 v22 l20 7 q15 7 17 24 l6 44 q2 12 -6 14 q-8 2 -10 -10 l-4 -20 v56 q0 13 -6 18 h-58 q-6 -5 -6 -18 v-56 l-4 20 q-2 12 -10 10 q-8 -2 -6 -14 l6 -44 q2 -17 17 -24 l20 -7 z";
  const leftArm =
    "M64 90 q-14 6 -17 25 l-9 96 q-3 24 1 44 q3 7 9 6 q6 -1 7 -9 l4 -42 l10 -86 q2 -18 -5 -34 z";
  const rightArm =
    "M136 90 q14 6 17 25 l9 96 q3 24 -1 44 q-3 7 -9 6 q-6 -1 -7 -9 l-4 -42 l-10 -86 q-2 -18 5 -34 z";
  const leftLeg =
    "M76 198 q12 -5 22 0 l1 70 q0 40 -3 76 q-1 20 -3 30 q-1 7 -8 7 q-7 0 -8 -7 q-3 -30 -4 -70 q-1 -62 3 -106 z";
  const rightLeg =
    "M124 198 q-12 -5 -22 0 l-1 70 q0 40 3 76 q1 20 3 30 q1 7 8 7 q7 0 8 -7 q3 -30 4 -70 q1 -62 -3 -106 z";
  return [head, torso, leftArm, rightArm, leftLeg, rightLeg].join(" ");
}

export const BODY_CONTENT = { x: 36, y: 6, width: 128, height: 378 } as const;
