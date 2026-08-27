import { mirrorPath } from "./mirror-path";

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
/**
 * One shape per muscle belly, drawn to sit inside the silhouette.
 *
 * Every left-side shape is written by hand and its partner derived with
 * `mirrorPath`, so a bicep can never end up a different shape from its twin.
 * Coordinates are tuned against the silhouette below: the torso spans x 65-135
 * at the waist, the arms x 38-69 and 131-162, and each leg x 73-99 and 101-127.
 * A shape outside those renders on top of empty space.
 */
const L = {
  trapFront: "M97 46 q-13 6 -21 24 q-2 6 3 8 q6 2 10 -4 q4 -12 11 -20 z",
  frontDelt: "M78 82 q-15 5 -20 21 q-3 11 -1 19 q10 3 16 -7 q4 -16 7 -29 z",
  sideDelt: "M60 94 q-9 9 -10 25 q-1 10 3 14 q7 -2 8 -13 q1 -15 1 -24 z",
  rearDelt: "M78 84 q-15 5 -20 21 q-3 11 -1 19 q10 3 16 -7 q4 -15 7 -29 z",
  pec: "M98 76 q-16 1 -24 9 q-8 10 -7 23 q1 10 8 13 q12 3 23 -3 z",
  bicep: "M60 108 q-11 5 -13 19 q-2 16 2 27 q7 3 10 -7 q3 -19 3 -37 z",
  tricep: "M61 106 q-12 6 -14 21 q-3 17 1 28 q8 3 11 -8 q3 -20 4 -39 z",
  forearm: "M55 162 q-9 5 -11 18 l-2 25 q-1 8 4 8 q6 1 8 -8 l4 -41 z",
  oblique: "M87 124 q-9 3 -10 13 l-1 24 q0 8 6 8 q5 0 5 -9 z",
  lat: "M82 100 q-11 6 -13 21 l-1 22 q0 12 7 19 l11 12 q5 -3 3 -11 l-3 -40 q-2 -15 -6 -23 z",
  erector: "M97 138 q-6 20 -6 38 q0 8 6 8 v-46 z",
  glute: "M98 186 q-14 0 -20 8 q-6 8 -5 20 q1 12 10 15 q10 2 15 -7 z",
  quadOuter: "M78 208 q-5 21 -4 45 l2 28 q1 9 6 9 q4 0 4 -11 l1 -69 q-4 -4 -9 -2 z",
  quadInner: "M91 210 q3 22 2 45 l-1 25 q-1 8 -5 8 q-4 0 -4 -10 l0 -66 q3 -4 8 -2 z",
  hamOuter: "M78 236 q-4 21 -3 43 l1 18 q1 9 6 9 q5 0 5 -11 l1 -57 q-5 -4 -10 -2 z",
  hamInner: "M91 238 q3 20 2 41 l-1 17 q-1 8 -5 8 q-4 0 -4 -10 l0 -54 z",
  calfFront: "M81 300 q-3 18 -1 34 q1 10 5 10 q4 0 4 -11 l0 -33 z",
  calfOuter: "M80 300 q-4 17 -2 31 q1 10 5 10 q3 0 3 -11 l1 -30 z",
  calfInner: "M92 304 q3 15 2 27 q-1 10 -4 10 q-3 0 -3 -10 l0 -27 z",
} as const;

/** A muscle drawn on both sides of the body. */
const pair = (d: string) => [d, mirrorPath(d)];

export const MUSCLE_SHAPES: Record<string, { f?: string[]; b?: string[] }> = {
  // --- shoulders -----------------------------------------------------------
  traps: {
    f: pair(L.trapFront),
    // The trapezius is the shape people recognise from behind: a kite from the
    // neck out to each shoulder and down between the blades.
    b: [
      "M100 52 q-11 3 -17 16 q-3 9 -2 16 l6 21 q6 6 13 6 q7 0 13 -6 l6 -21 q1 -7 -2 -16 q-6 -13 -17 -16 z",
    ],
  },
  "front-delts": { f: pair(L.frontDelt) },
  "side-delts": { f: pair(L.sideDelt), b: pair(L.sideDelt) },
  "rear-delts": { b: pair(L.rearDelt) },
  shoulders: { f: pair(L.frontDelt), b: pair(L.rearDelt) },
  "rotator-cuff": { b: pair("M78 96 q-9 4 -11 14 q-1 7 4 9 q7 1 10 -7 z") },

  // --- chest ---------------------------------------------------------------
  chest: { f: pair(L.pec) },
  "upper-chest": { f: pair("M98 74 q-15 1 -22 8 q-5 6 -4 12 q11 4 26 1 z") },

  // --- arms ----------------------------------------------------------------
  biceps: { f: pair(L.bicep) },
  brachialis: { f: pair("M60 142 q-9 4 -10 15 q-1 8 4 9 q6 0 8 -9 z") },
  triceps: { b: pair(L.tricep) },
  forearms: { f: pair(L.forearm), b: pair(L.forearm) },

  // --- torso ---------------------------------------------------------------
  // Eight bellies rather than one block: a segmented rectus abdominis is the
  // difference between a body map and a diagram of a fridge.
  core: {
    f: [0, 1, 2, 3].flatMap((row) => {
      const y = 122 + row * 13;
      const left = `M88 ${y} h10 q3 0 3 3 v6 q0 3 -3 3 h-10 q-3 0 -3 -3 v-6 q0 -3 3 -3 z`;
      return pair(left);
    }),
  },
  obliques: { f: pair(L.oblique) },
  "hip-flexors": { f: pair("M97 176 q-9 2 -11 10 q-1 6 4 7 h7 z") },
  lats: { b: pair(L.lat) },
  back: { b: pair(L.lat) },
  "mid-back": { b: pair("M97 126 q-11 3 -13 14 q-1 9 5 11 h8 z") },
  "upper-back": { b: pair("M97 100 q-13 4 -16 16 q-1 8 5 10 h11 z") },

  // --- legs ----------------------------------------------------------------
  glutes: { b: pair(L.glute) },
  quads: { f: [...pair(L.quadOuter), ...pair(L.quadInner)] },
  hamstrings: { b: [...pair(L.hamOuter), ...pair(L.hamInner)] },
  calves: {
    f: pair(L.calfFront),
    // Two heads from behind, which is how a calf actually reads.
    b: [...pair(L.calfOuter), ...pair(L.calfInner)],
  },
};

/**
 * The outline every muscle shape sits inside.
 *
 * A broad, muscular figure rather than a slim one — partly because that is the
 * brand, and partly because the muscle bellies simply do not fit on a narrow
 * body: a skinny silhouette leaves deltoids and quads hanging over the edge.
 *
 * Separate subpaths for head, torso, arms and legs, filled in one pass so they
 * union. A single continuous outline cannot reach every coordinate the muscles
 * are drawn against, which is exactly how the arms came to be missing.
 */
const HEAD = "M100 24 m-17 0 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 z";

const TORSO =
  "M92 40 h16 v16 q30 4 42 20 q7 9 8 24 q-2 28 -18 50 q-3 16 -4 30 l-1 28 h-70 l-1 -28 q-1 -14 -4 -30 q-16 -22 -18 -50 q1 -15 8 -24 q12 -16 42 -20 z";

const LEFT_ARM =
  "M56 80 q-13 7 -16 25 l-6 74 q-3 24 0 42 q3 8 10 7 q7 -1 8 -11 l3 -42 l10 -70 q3 -18 -6 -25 z";

const LEFT_LEG =
  "M72 200 q13 -5 26 0 l2 74 q0 42 -4 78 q-1 18 -4 25 q-2 8 -9 8 q-7 0 -9 -8 q-3 -28 -5 -72 q-2 -64 3 -105 z";

export function bodySilhouette(): string {
  return [HEAD, TORSO, LEFT_ARM, mirrorPath(LEFT_ARM), LEFT_LEG, mirrorPath(LEFT_LEG)].join(" ");
}

export const BODY_CONTENT = { x: 30, y: 6, width: 140, height: 384 } as const;
