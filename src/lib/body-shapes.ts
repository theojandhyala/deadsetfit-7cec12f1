import { mirrorPath } from "./mirror-path";

/**
 * The DEADSET body: a stylised front-and-back figure with one shape per muscle
 * region.
 *
 * Lives in lib rather than beside a component because three very different
 * surfaces draw it — the per-exercise diagram, the strength map, and the
 * shareable strength card. Three copies of this anatomy would drift, and the
 * same muscle would end up a different shape depending on where you looked.
 *
 * Coordinates target a 200x430 viewBox. Centre line is x=100, so every
 * left-side shape is written once and its partner derived with `mirrorPath`
 * — a bicep can never end up a different shape from its twin.
 *
 * The governing rule is coverage. An earlier version drew correct little
 * bellies floating in a roomy outline, and the result looked like a clip-art
 * mannequin with stickers on it: what you noticed was the grey gaps, not the
 * muscle. Every shape here is sized to meet its neighbours, so a fully graded
 * figure reads as a body made of muscle with thin dark separations, the way an
 * anatomy chart does.
 */

/* -------------------------------------------------------------------------
 * Left-side muscle bellies. x < 100 throughout; the right side is mirrored.
 *
 * Landmarks these are tuned against, from the silhouette at the bottom of this
 * file: neck 48-62, deltoid cap 66-112, armpit y=116, waist narrowest x=75 at
 * y=170, hip x=71 at y=205, crotch y=219, knee y=310, ankle y=400.
 * ---------------------------------------------------------------------- */
const L = {
  // --- neck and shoulders --------------------------------------------------
  trapFront: "M99 50 C90 52 80 57 72 65 C68 70 70 75 76 75 C84 69 92 65 99 63 Z",
  trapBack:
    "M99 49 C87 53 75 59 67 68 C63 74 66 81 73 83 C81 88 88 97 92 109 C95 117 99 119 99 113 Z",
  frontDelt: "M72 69 C61 73 53 82 51 94 C50 103 53 110 59 112 C65 107 69 96 72 85 Z",
  sideDelt: "M50 95 C46 103 45 114 46 125 C51 128 57 123 58 115 C58 107 56 100 55 93 Z",
  rearDelt: "M73 70 C62 74 54 83 52 95 C51 104 54 111 60 113 C66 108 70 97 73 86 Z",

  // --- chest ---------------------------------------------------------------
  pecUpper: "M98 65 C88 66 79 70 73 77 C71 82 73 87 78 89 L98 87 Z",
  pecLower: "M98 91 C88 91 80 93 75 97 C72 105 74 115 80 121 C87 125 94 123 98 119 Z",
  serratus: "M75 105 C70 109 68 117 69 126 C72 129 76 126 77 120 L78 107 Z",

  // --- arms ----------------------------------------------------------------
  bicep:
    "M67 116 C58 120 50 133 49 148 C48 161 53 170 60 171 C67 169 70 156 70 143 C70 130 70 119 67 116 Z",
  brachialis: "M51 139 C45 146 41 158 42 170 C48 174 55 170 56 160 C57 151 54 143 51 139 Z",
  tricepLong:
    "M68 114 C61 119 57 133 57 149 C57 162 61 171 67 171 C71 168 73 155 73 141 C73 128 71 118 68 114 Z",
  tricepLateral: "M56 120 C48 128 43 143 44 159 C48 166 56 163 57 152 C58 138 59 126 56 120 Z",
  forearm:
    "M63 172 C56 180 51 195 49 212 C47 225 47 238 53 242 C60 242 63 231 65 218 C67 200 67 181 63 172 Z",
  forearmOuter:
    "M47 176 C41 186 38 201 37 216 C36 228 38 238 44 239 C49 237 50 226 51 212 C52 195 51 183 47 176 Z",

  // --- torso ---------------------------------------------------------------
  oblique: "M81 121 C76 128 74 140 74 154 C74 169 76 181 80 189 C85 189 87 183 86 172 L85 125 Z",
  hipFlexor: "M84 188 C79 193 77 202 80 210 C87 216 95 214 98 207 L98 189 Z",

  // --- back ----------------------------------------------------------------
  rhomboid: "M98 77 C90 79 82 85 78 93 C77 100 80 105 86 105 L98 105 Z",
  thoracic: "M98 108 C89 110 82 115 79 123 C79 131 83 135 89 135 L98 135 Z",
  teres: "M75 93 C70 97 67 105 69 112 C74 117 81 115 83 108 C83 101 80 95 75 93 Z",
  lat: "M70 99 C63 109 60 126 61 143 C62 158 68 168 76 174 C85 176 89 169 88 158 C86 142 83 123 79 107 Z",
  erector: "M92 109 C88 130 87 154 88 176 C89 187 93 191 98 189 L98 109 Z",
  lumbar: "M80 169 C76 176 74 186 76 195 C82 199 92 199 98 195 L98 171 Z",

  // --- hips and legs -------------------------------------------------------
  gluteMax: "M79 193 C71 199 67 212 68 225 C70 237 78 244 88 241 C95 237 98 227 98 215 L98 195 Z",
  gluteMed: "M74 189 C68 193 65 202 68 210 C72 215 79 213 81 205 C82 198 79 191 74 189 Z",
  quadOuter:
    "M75 213 C68 227 66 250 67 272 C68 290 71 302 77 306 C82 304 84 292 83 276 C82 252 80 228 78 213 Z",
  quadMid:
    "M83 217 C80 237 79 261 80 285 C81 299 84 307 89 308 C93 305 93 293 92 277 C91 253 90 233 89 217 Z",
  quadInner: "M89 266 C84 274 82 288 84 298 C89 305 97 303 98 294 C99 280 95 270 89 266 Z",
  adductor: "M93 216 C89 231 88 248 89 264 C91 272 97 272 99 266 L99 216 Z",
  hamOuter:
    "M73 243 C68 260 67 280 68 296 C70 308 74 314 79 314 C83 310 84 295 83 279 C82 261 78 248 76 243 Z",
  hamInner:
    "M86 243 C83 261 82 281 83 298 C85 308 89 312 94 310 C97 304 97 290 96 274 C95 258 92 248 90 243 Z",
  tibialis:
    "M85 316 C81 330 79 350 80 369 C81 384 84 393 89 393 C94 391 96 378 95 362 C93 344 90 328 88 316 Z",
  shinOuter:
    "M73 318 C69 333 67 351 68 366 C69 380 74 387 78 383 C80 373 80 357 79 342 C78 331 76 322 73 318 Z",
  gastrocOuter:
    "M73 316 C68 330 67 348 69 363 C71 375 77 378 80 372 C82 360 81 343 79 329 C78 321 76 316 73 316 Z",
  gastrocInner: "M89 314 C86 329 84 348 86 362 C88 373 95 373 97 364 C98 346 96 328 92 316 Z",
  soleus: "M76 362 C72 374 71 387 74 396 C80 401 90 401 94 396 C96 384 95 371 91 362 Z",
} as const;

/** A muscle drawn on both sides of the body. */
const pair = (d: string) => [d, mirrorPath(d)];

/**
 * The rectus abdominis, as the eight bellies it actually is.
 *
 * Sized to meet the obliques on the outside and its twin at the centre line,
 * so the midsection fills rather than leaving a grey frame around a stack of
 * small blocks.
 */
const abs = [0, 1, 2, 3].flatMap((row) => {
  const y = 121 + row * 15;
  return pair(`M86 ${y} h11 q3 0 3 3 v7 q0 3 -3 3 h-11 q-3 0 -3 -3 v-7 q0 -3 3 -3 z`);
});

export const MUSCLE_SHAPES: Record<string, { f?: string[]; b?: string[] }> = {
  // --- shoulders -----------------------------------------------------------
  traps: { f: pair(L.trapFront), b: pair(L.trapBack) },
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
  "mid-back": { b: pair(L.thoracic) },
  "upper-back": { b: pair(L.rhomboid) },

  // --- legs ----------------------------------------------------------------
  glutes: { b: [...pair(L.gluteMax), ...pair(L.gluteMed)] },
  quads: {
    f: [...pair(L.quadOuter), ...pair(L.quadMid), ...pair(L.quadInner), ...pair(L.adductor)],
  },
  hamstrings: { b: [...pair(L.hamOuter), ...pair(L.hamInner)] },
  calves: {
    f: [...pair(L.tibialis), ...pair(L.shinOuter)],
    // Two heads and the soleus beneath, which is how a calf actually reads.
    b: [...pair(L.gastrocOuter), ...pair(L.gastrocInner), ...pair(L.soleus)],
  },
};

/**
 * The outline every muscle shape sits inside.
 *
 * Proportioned like a lifter rather than a mannequin: the deltoids are the
 * widest point, the torso tapers to a narrow waist, and the thighs are the
 * thickest part of the leg. That shape is doing real work — it is what makes
 * the figure read as a physique at thumbnail size, before a single muscle is
 * coloured in.
 *
 * Separate subpaths for head, torso, arms and legs, filled in one pass so they
 * union. A single continuous outline cannot reach every coordinate the muscles
 * are drawn against, which is exactly how the arms once came to be missing.
 */
export const HEAD = "M100 30 m-19 0 a19 24 0 1 0 38 0 a19 24 0 1 0 -38 0 z";

/** Neck, trapezius slope, deltoid cap, lat taper to the waist, then the hips. */
const TORSO =
  "M100 47 L92 48 L90 62 C79 65 68 70 60 79 C53 87 50 97 50 108 " +
  "C56 112 61 114 65 118 C69 132 72 150 75 170 C74 184 72 194 71 205 " +
  "C75 214 87 219 100 219 C113 219 125 214 129 205 C128 194 126 184 125 170 " +
  "C128 150 131 132 135 118 C139 114 144 112 150 108 C150 97 147 87 140 79 " +
  "C132 70 121 65 110 62 L108 48 Z";

/** Upper arm, forearm and a closed fist, hanging a little clear of the ribs. */
const LEFT_ARM =
  "M54 96 C48 104 45 118 44 134 C43 151 41 167 39 184 C37 198 36 211 36 223 " +
  "C36 235 38 244 42 251 C46 257 53 256 55 249 C57 241 58 231 59 220 " +
  "C61 205 63 190 66 173 C69 153 70 133 70 114 C66 103 60 96 54 96 Z";

/** Thigh, knee, calf, ankle and foot. */
const LEFT_LEG =
  "M73 208 C69 223 67 243 67 264 C67 285 69 300 71 312 C71 327 72 341 73 355 " +
  "C74 371 75 385 77 397 C78 408 80 416 85 418 C91 420 96 414 97 404 " +
  "C98 388 98 370 98 352 C98 328 99 300 99 274 C100 248 100 228 100 210 " +
  "C91 206 81 205 73 208 Z";

export function bodySilhouette(): string {
  return [HEAD, TORSO, LEFT_ARM, mirrorPath(LEFT_ARM), LEFT_LEG, mirrorPath(LEFT_LEG)].join(" ");
}

/**
 * The box the figure actually occupies inside the 200x430 grid.
 *
 * Anything drawing the body scales by this, not by the viewBox: the raw grid
 * carries a wide empty margin, and scaling by it once shrank the figure to a
 * third of the space it was given.
 */
export const BODY_CONTENT = { x: 34, y: 4, width: 132, height: 418 } as const;
