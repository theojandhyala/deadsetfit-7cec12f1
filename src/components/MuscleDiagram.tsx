/**
 * The DEADSET figure: front and back, one shape per muscle.
 *
 * Two very different callers share it. The exercise library lights the muscles
 * a movement works; the strength map colours every region by its grade. Both
 * draw from `body-shapes.ts`, which is also what the shareable strength card
 * renders through Path2D — so the anatomy on a screenshot people post can
 * never disagree with the anatomy in the app.
 *
 * The paths are original DEADSET artwork. No third-party anatomical asset or
 * path data is embedded here.
 */
import { BODY_CONTENT, HEAD, MUSCLE_SHAPES, bodySilhouette } from "@/lib/body-shapes";

type Muscle = string;

interface Props {
  primary?: Muscle[];
  secondary?: Muscle[];
  /** Optional broad-muscle colour map used by the strength report. */
  gradeColors?: Partial<Record<"CHEST" | "BACK" | "LEGS" | "SHOULDERS" | "ARMS" | "CORE", string>>;
  size?: number;
  /** Render one side for comparison layouts, or both for exercise detail. */
  view?: "front" | "back" | "both";
}

type Side = "f" | "b";

const ACCENT = "#f04432";
const DIM = "#6b211b";
/** Ungraded muscle: visibly a muscle, visibly not scored. */
const BASE = "#292b2f";
const BODY_BASE = "#1d2024";
const HEAD_FILL = "#24272c";
const OUTLINE = "#85888f";
const SEPARATOR = "#0d0e10";

/**
 * A broad label such as "shoulders" needs to light every visible subdivision,
 * while a precise label such as "rear-delts" should only light that region.
 */
const BROAD_MUSCLE_SHAPES: Record<string, string[]> = {
  chest: ["chest", "upper-chest"],
  // "back" is the erectors and lumbar — a key in its own right, and the one
  // most easily left out, which renders a grey hole in the middle of a graded
  // back.
  back: ["lats", "mid-back", "upper-back", "traps", "rotator-cuff", "back"],
  legs: ["quads", "hamstrings", "glutes", "calves", "hip-flexors"],
  shoulders: ["front-delts", "side-delts", "rear-delts"],
  arms: ["biceps", "triceps", "forearms", "brachialis"],
  core: ["core", "obliques"],
};

const MUSCLE_ALIASES: Record<string, string> = {
  abs: "core",
  abdominals: "core",
  abdominal: "core",
  arm: "arms",
  delts: "shoulders",
  deltoids: "shoulders",
  glute: "glutes",
  leg: "legs",
  pecs: "chest",
  pectorals: "chest",
  quadriceps: "quads",
};

const normaliseMuscle = (muscle: string) => {
  const key = muscle
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return MUSCLE_ALIASES[key] ?? key;
};

const GRADE_SHAPES: Record<string, string[]> = {
  CHEST: BROAD_MUSCLE_SHAPES.chest,
  BACK: BROAD_MUSCLE_SHAPES.back,
  LEGS: BROAD_MUSCLE_SHAPES.legs,
  SHOULDERS: BROAD_MUSCLE_SHAPES.shoulders,
  ARMS: BROAD_MUSCLE_SHAPES.arms,
  CORE: BROAD_MUSCLE_SHAPES.core,
};

/**
 * `shoulders` is both a region in its own right and the umbrella for the three
 * delt heads, so it would draw twice. Drop the umbrella when a head covers it.
 */
const REDUNDANT = new Set(["shoulders"]);

const SILHOUETTE = bodySilhouette();

function requestedFill(set: Set<string>, key: string) {
  if (set.has(key)) return true;
  return [...set].some((requested) => BROAD_MUSCLE_SHAPES[requested]?.includes(key));
}

export function MuscleDiagram({
  primary = [],
  secondary = [],
  gradeColors,
  size = 220,
  view = "both",
}: Props) {
  const prim = new Set(primary.map(normaliseMuscle));
  const sec = new Set(secondary.map(normaliseMuscle));
  const graded = new Map<string, string>();

  for (const [group, color] of Object.entries(gradeColors ?? {})) {
    if (!color) continue;
    for (const shape of GRADE_SHAPES[group] ?? []) graded.set(shape, color);
  }

  const fill = (key: string) =>
    graded.get(key) ?? (requestedFill(prim, key) ? ACCENT : requestedFill(sec, key) ? DIM : BASE);

  const render = (side: Side) =>
    Object.entries(MUSCLE_SHAPES).flatMap(([key, shape]) =>
      REDUNDANT.has(key)
        ? []
        : (shape[side] ?? []).map((d, index) => (
            <path
              key={`${side}-${key}-${index}`}
              d={d}
              fill={fill(key)}
              stroke={SEPARATOR}
              strokeWidth={0.8}
              strokeLinejoin="round"
            />
          )),
    );

  const sides: Side[] = view === "front" ? ["f"] : view === "back" ? ["b"] : ["f", "b"];
  const { x, y, width, height } = BODY_CONTENT;
  // Scale by the figure's own bounds, never the raw grid — the grid carries a
  // wide empty margin, and scaling by it renders the body a third too small.
  const figureWidth = (size * width) / height;

  return (
    <div className="flex justify-center gap-3" style={{ width: "100%" }}>
      {sides.map((side) => (
        <svg
          key={side}
          viewBox={`${x} ${y} ${width} ${height}`}
          width={figureWidth}
          height={size}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <path
            d={SILHOUETTE}
            fill={BODY_BASE}
            stroke={OUTLINE}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
          {/* Head and hands carry no grade, so they read as the figure rather
              than as ungraded muscle. */}
          <path d={HEAD} fill={HEAD_FILL} stroke={OUTLINE} strokeWidth={1.1} />
          {render(side)}
        </svg>
      ))}
    </div>
  );
}
