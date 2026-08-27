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
 * A real muscle map, not a few blocks: the figure should read as covered in
 * muscle with thin gaps between bellies, the way an anatomy chart does. Large
 * bare regions are what made the earlier version look like a diagram of a
 * fridge rather than a body.
 *
 * Every left-side shape is written by hand and its partner derived with
 * `mirrorPath`, so a bicep can never end up a different shape from its twin.
 * Coordinates are tuned against the silhouette below: the torso spans roughly
 * x 60-140 at the waist, each arm x 34-65 and 135-166, each leg x 69-100 and
 * 100-131. A shape outside those renders over empty space.
 */
const L = {
  // --- neck and shoulders --------------------------------------------------
  trapFront: "M97 46 q-14 6 -22 26 q-2 7 4 9 q7 2 11 -5 q4 -14 11 -22 z",
  frontDelt: "M80 78 q-16 4 -23 20 q-4 11 -2 20 q10 4 17 -6 q5 -18 10 -32 z",
  sideDelt: "M60 88 q-11 8 -14 24 q-2 11 2 16 q8 -1 10 -13 q2 -16 4 -26 z",
  rearDelt: "M80 80 q-16 4 -22 20 q-4 11 -2 19 q10 4 16 -6 q5 -17 10 -31 z",

  // --- chest ---------------------------------------------------------------
  pecUpper: "M98 72 q-18 2 -27 10 q-5 6 -3 12 q14 5 30 2 z",
  pecLower: "M98 93 q-19 1 -27 8 q-6 8 -4 17 q2 9 10 11 q11 2 21 -4 z",
  serratus: "M75 114 q-7 3 -7 10 l1 13 q1 5 5 4 q4 -1 4 -8 l1 -18 z",

  // --- arms ----------------------------------------------------------------
  bicep: "M62 106 q-12 5 -14 20 q-2 17 2 28 q8 3 11 -7 q3 -20 3 -39 z",
  brachialis: "M60 142 q-8 4 -9 14 q-1 8 4 9 q6 0 7 -9 z",
  tricepLong: "M62 104 q-12 6 -14 21 q-3 17 1 28 q8 3 11 -8 q3 -20 4 -39 z",
  tricepLateral: "M53 114 q-7 6 -8 18 q-1 10 3 12 q5 -1 6 -10 z",
  forearm: "M57 160 q-9 5 -11 17 l-2 24 q-1 8 4 8 q6 1 8 -8 l4 -39 z",
  forearmOuter: "M48 170 q-5 6 -6 16 l-1 18 q0 7 4 7 q4 0 4 -8 l2 -31 z",

  // --- torso ---------------------------------------------------------------
  oblique: "M86 126 q-9 3 -11 14 l-1 26 q0 9 6 9 q6 0 6 -10 z",
  hipFlexor: "M97 180 q-10 2 -12 10 q-1 7 5 8 h7 z",

  // --- back ----------------------------------------------------------------
  rhomboid: "M97 96 q-13 4 -17 14 q-2 8 3 10 h14 z",
  teres: "M84 110 q-8 3 -10 10 q-1 6 4 7 q6 1 8 -6 z",
  lat: "M84 100 q-13 6 -16 22 l-2 24 q0 13 8 20 l12 13 q5 -3 3 -12 l-4 -44 q-2 -16 -6 -23 z",
  erector: "M97 130 q-8 20 -8 38 q0 9 8 10 v-48 z",
  lumbar: "M97 176 q-11 2 -13 11 q-1 9 6 11 h7 z",

  // --- hips and legs -------------------------------------------------------
  gluteMax: "M98 188 q-15 0 -21 9 q-6 9 -5 21 q1 12 11 15 q10 2 15 -7 z",
  gluteMed: "M79 186 q-9 3 -11 12 q-1 8 4 10 q7 1 9 -8 z",
  quadOuter: "M77 210 q-6 20 -5 43 l2 26 q1 9 6 9 q4 0 4 -11 l1 -65 q-4 -4 -8 -2 z",
  quadMid: "M89 212 q-4 18 -4 39 l1 26 q1 8 5 8 q4 0 4 -9 l0 -62 z",
  quadInner: "M96 262 q-8 4 -10 14 q-1 9 4 12 q6 2 9 -6 z",
  adductor: "M98 210 q-8 3 -10 13 l-2 32 q0 8 5 8 q5 0 6 -9 l2 -44 z",
  hamOuter: "M77 238 q-5 20 -4 41 l1 18 q1 9 6 9 q5 0 5 -11 l1 -55 q-5 -4 -9 -2 z",
  hamInner: "M90 240 q4 20 3 39 l-1 18 q-1 8 -5 8 q-4 0 -4 -10 l0 -53 z",
  tibialis: "M81 300 q-3 18 -1 33 q1 10 5 10 q4 0 4 -11 l0 -32 z",
  gastrocOuter: "M79 300 q-5 16 -3 29 q1 10 5 10 q4 0 4 -11 l1 -28 z",
  gastrocInner: "M92 302 q4 15 3 26 q-1 10 -5 10 q-3 0 -3 -10 l0 -26 z",
  soleus: "M80 336 q-3 14 -2 25 q1 8 4 8 q3 0 3 -9 l1 -24 z",
} as const;

/** A muscle drawn on both sides of the body. */
const pair = (d: string) => [d, mirrorPath(d)];

/** The rectus abdominis, as the eight bellies it actually is. */
const abs = [0, 1, 2, 3].flatMap((row) => {
  const y = 124 + row * 13;
  return pair(`M88 ${y} h10 q3 0 3 3 v6 q0 3 -3 3 h-10 q-3 0 -3 -3 v-6 q0 -3 3 -3 z`);
});

export const MUSCLE_SHAPES: Record<string, { f?: string[]; b?: string[] }> = {
  // --- shoulders -----------------------------------------------------------
  traps: {
    f: pair(L.trapFront),
    // From behind the trapezius is the shape people recognise: a kite from the
    // neck out to each shoulder and down between the blades.
    b: [
      "M100 58 q-10 3 -15 13 q-3 8 -2 14 l6 20 q5 6 11 6 q6 0 11 -6 l6 -20 q1 -6 -2 -14 q-5 -10 -15 -13 z",
    ],
  },
  "front-delts": { f: pair(L.frontDelt) },
  "side-delts": { f: pair(L.sideDelt), b: pair(L.sideDelt) },
  "rear-delts": { b: pair(L.rearDelt) },
  shoulders: { f: pair(L.frontDelt), b: pair(L.rearDelt) },
  "rotator-cuff": { b: pair(L.teres) },

  // --- chest ---------------------------------------------------------------
  chest: { f: pair(L.pecLower) },
  "upper-chest": { f: pair(L.pecUpper) },

  // --- arms ----------------------------------------------------------------
  biceps: { f: pair(L.bicep) },
  brachialis: { f: pair(L.brachialis) },
  triceps: { b: [...pair(L.tricepLong), ...pair(L.tricepLateral)] },
  forearms: {
    f: [...pair(L.forearm), ...pair(L.forearmOuter)],
    b: [...pair(L.forearm), ...pair(L.forearmOuter)],
  },

  // --- torso ---------------------------------------------------------------
  core: { f: [...abs, ...pair(L.serratus)] },
  obliques: { f: pair(L.oblique) },
  "hip-flexors": { f: pair(L.hipFlexor) },
  lats: { b: pair(L.lat) },
  back: { b: [...pair(L.erector), ...pair(L.lumbar)] },
  "mid-back": { b: pair(L.rhomboid) },
  "upper-back": { b: pair(L.rhomboid) },

  // --- legs ----------------------------------------------------------------
  glutes: { b: [...pair(L.gluteMax), ...pair(L.gluteMed)] },
  quads: {
    f: [...pair(L.quadOuter), ...pair(L.quadMid), ...pair(L.quadInner), ...pair(L.adductor)],
  },
  hamstrings: { b: [...pair(L.hamOuter), ...pair(L.hamInner)] },
  calves: {
    f: pair(L.tibialis),
    // Two heads and the soleus beneath, which is how a calf actually reads.
    b: [...pair(L.gastrocOuter), ...pair(L.gastrocInner), ...pair(L.soleus)],
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
