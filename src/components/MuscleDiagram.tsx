/**
 * Stylised front+back body silhouette that highlights primary (red) and
 * secondary (dim red) muscles. Not anatomically perfect — designed to read
 * fast on a mobile card.
 */
type Muscle = string;

interface Props {
  primary?: Muscle[];
  secondary?: Muscle[];
  /** Optional broad-muscle colour map used by the strength report. */
  gradeColors?: Partial<Record<"CHEST" | "BACK" | "LEGS" | "SHOULDERS" | "ARMS" | "CORE", string>>;
  size?: number;
}

const ACCENT = "#e63222";
const DIM = "#5a1a14";
const BASE = "#1a1a1a";
const STROKE = "#2a2a2a";

// Each muscle key maps to one or more SVG path "d" attributes split across
// front (F) and back (B) bodies. Coordinates target a 200x420 viewBox per side.
const SHAPES: Record<string, { f?: string[]; b?: string[] }> = {
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

function bodyPath() {
  // generic silhouette
  return "M100 30 q24 0 24 26 q0 22 -16 30 q22 6 28 28 l8 50 q-2 22 -18 34 l-10 18 v60 q8 30 -2 60 q-8 30 -8 60 v50 q4 22 -4 30 h-24 q-8 -8 -4 -30 v-50 q0 -30 -8 -60 q-10 -30 -2 -60 v-60 l-10 -18 q-16 -12 -18 -34 l8 -50 q6 -22 28 -28 q-16 -8 -16 -30 q0 -26 24 -26 z";
}

const GRADE_SHAPES: Record<string, string[]> = {
  CHEST: ["chest", "upper-chest"],
  BACK: ["back", "lats", "mid-back", "upper-back", "traps"],
  LEGS: ["quads", "hamstrings", "glutes", "calves", "hip-flexors"],
  SHOULDERS: ["shoulders", "front-delts", "side-delts", "rear-delts", "rotator-cuff"],
  ARMS: ["biceps", "triceps", "forearms", "brachialis"],
  CORE: ["core", "obliques"],
};

export function MuscleDiagram({ primary = [], secondary = [], gradeColors, size = 220 }: Props) {
  const prim = new Set(primary.map((m) => m.toLowerCase()));
  const sec = new Set(secondary.map((m) => m.toLowerCase()));
  const graded = new Map<string, string>();
  for (const [group, color] of Object.entries(gradeColors ?? {})) {
    if (!color) continue;
    for (const shape of GRADE_SHAPES[group] ?? []) graded.set(shape, color);
  }

  const fill = (key: string) =>
    graded.get(key) ?? (prim.has(key) ? ACCENT : sec.has(key) ? DIM : BASE);

  const render = (side: "f" | "b") =>
    Object.entries(SHAPES).flatMap(([key, def]) =>
      (def[side] ?? []).map((d, i) => (
        <path
          key={`${side}-${key}-${i}`}
          d={d}
          fill={fill(key)}
          stroke={STROKE}
          strokeWidth={0.5}
        />
      )),
    );

  return (
    <div className="flex justify-center gap-4" style={{ width: "100%" }}>
      {(["f", "b"] as const).map((side) => (
        <svg key={side} viewBox="0 0 200 420" width={size / 2.2} height={size} aria-hidden>
          <path d={bodyPath()} fill={BASE} stroke={STROKE} strokeWidth={1.2} />
          {render(side)}
        </svg>
      ))}
    </div>
  );
}
