/**
 * Original, stylised anatomical front/back figure used by the exercise library
 * and Strength map. The regions are intentionally simplified enough to stay
 * legible on a phone while retaining a recognisable muscular silhouette.
 */
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

interface MuscleRegion {
  key: string;
  f?: string[];
  b?: string[];
}

const ACCENT = "#f04432";
const DIM = "#6b211b";
const BASE = "#292b2f";
const BODY_BASE = "#17191c";
const OUTLINE = "#85888f";
const SEPARATOR = "#111316";

/**
 * A broad label such as "shoulders" needs to light every visible subdivision,
 * while a precise label such as "rear-delts" should only light that region.
 */
const BROAD_MUSCLE_SHAPES: Record<string, string[]> = {
  chest: ["chest", "upper-chest"],
  back: ["lats", "mid-back", "upper-back", "traps"],
  legs: ["quads", "hamstrings", "glutes", "calves", "hip-flexors"],
  shoulders: ["front-delts", "side-delts", "rear-delts", "rotator-cuff"],
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

/*
 * Muscle regions use a 180 × 400 coordinate system. Every path below was made
 * for DEADSET; no third-party anatomical asset or path data is embedded here.
 */
const REGIONS: MuscleRegion[] = [
  {
    key: "traps",
    b: [
      "M76 55 C80 49 85 46 90 45 C95 46 100 49 104 55 L116 70 C108 75 99 78 90 79 C81 78 72 75 64 70 Z",
      "M77 72 C82 75 86 77 90 78 C94 77 98 75 103 72 L99 114 L90 129 L81 114 Z",
    ],
  },
  {
    key: "front-delts",
    f: [
      "M61 67 C52 67 45 72 42 81 C43 89 48 95 56 97 C61 91 65 81 66 72 Z",
      "M119 67 C128 67 135 72 138 81 C137 89 132 95 124 97 C119 91 115 81 114 72 Z",
    ],
  },
  {
    key: "side-delts",
    f: [
      "M43 80 C37 87 35 97 37 108 L48 107 C52 101 55 94 56 89 C50 88 46 85 43 80 Z",
      "M137 80 C143 87 145 97 143 108 L132 107 C128 101 125 94 124 89 C130 88 134 85 137 80 Z",
    ],
  },
  {
    key: "rear-delts",
    b: [
      "M62 67 C50 67 42 74 39 84 C41 93 48 98 57 98 C62 91 65 80 65 72 Z",
      "M118 67 C130 67 138 74 141 84 C139 93 132 98 123 98 C118 91 115 80 115 72 Z",
    ],
  },
  {
    key: "rotator-cuff",
    b: [
      "M58 76 C65 72 73 72 79 77 L76 94 C69 96 62 94 57 89 Z",
      "M122 76 C115 72 107 72 101 77 L104 94 C111 96 118 94 123 89 Z",
    ],
  },
  {
    key: "upper-chest",
    f: [
      "M64 69 C72 64 81 62 88 64 L88 84 C79 82 71 79 63 76 Z",
      "M116 69 C108 64 99 62 92 64 L92 84 C101 82 109 79 117 76 Z",
    ],
  },
  {
    key: "chest",
    f: [
      "M62 78 C70 80 79 84 88 86 L88 111 C79 116 69 114 61 108 C58 98 59 87 62 78 Z",
      "M118 78 C110 80 101 84 92 86 L92 111 C101 116 111 114 119 108 C122 98 121 87 118 78 Z",
    ],
  },
  {
    key: "upper-back",
    b: [
      "M65 72 C71 77 77 81 82 84 L80 111 C72 107 65 101 58 93 Z",
      "M115 72 C109 77 103 81 98 84 L100 111 C108 107 115 101 122 93 Z",
    ],
  },
  {
    key: "lats",
    b: [
      "M59 96 C66 102 73 108 80 114 L78 160 C70 157 64 151 59 143 L53 111 Z",
      "M121 96 C114 102 107 108 100 114 L102 160 C110 157 116 151 121 143 L127 111 Z",
    ],
  },
  {
    key: "mid-back",
    b: [
      "M82 84 L89 80 L89 158 L79 157 L80 113 Z",
      "M98 84 L91 80 L91 158 L101 157 L100 113 Z",
      "M79 158 L89 158 L89 174 L77 174 Z",
      "M101 158 L91 158 L91 174 L103 174 Z",
    ],
  },
  {
    key: "biceps",
    f: [
      "M42 108 C38 119 37 134 40 147 C44 151 49 150 53 145 L55 113 C51 108 47 106 42 108 Z",
      "M138 108 C142 119 143 134 140 147 C136 151 131 150 127 145 L125 113 C129 108 133 106 138 108 Z",
    ],
  },
  {
    key: "brachialis",
    f: [
      "M52 111 C57 119 57 134 52 145 L47 141 L47 116 Z",
      "M128 111 C123 119 123 134 128 145 L133 141 L133 116 Z",
    ],
  },
  {
    key: "triceps",
    b: [
      "M41 104 C35 117 35 136 40 151 C45 153 51 148 54 140 L54 113 C50 106 46 103 41 104 Z",
      "M139 104 C145 117 145 136 140 151 C135 153 129 148 126 140 L126 113 C130 106 134 103 139 104 Z",
    ],
  },
  {
    key: "forearms",
    f: [
      "M39 150 C34 161 31 176 29 190 L39 195 C44 184 47 169 48 153 C45 149 42 148 39 150 Z",
      "M49 153 C50 169 47 185 41 197 L47 199 C54 185 57 167 55 151 Z",
      "M141 150 C146 161 149 176 151 190 L141 195 C136 184 133 169 132 153 C135 149 138 148 141 150 Z",
      "M131 153 C130 169 133 185 139 197 L133 199 C126 185 123 167 125 151 Z",
    ],
    b: [
      "M39 152 C34 165 31 180 30 193 L40 198 C45 185 48 169 48 154 Z",
      "M49 154 C50 171 47 187 42 199 L48 201 C55 185 57 168 54 151 Z",
      "M141 152 C146 165 149 180 150 193 L140 198 C135 185 132 169 132 154 Z",
      "M131 154 C130 171 133 187 138 199 L132 201 C125 185 123 168 126 151 Z",
    ],
  },
  {
    key: "core",
    f: [
      "M82 114 C85 112 87 112 89 113 L89 130 L81 130 Z",
      "M98 114 C95 112 93 112 91 113 L91 130 L99 130 Z",
      "M81 132 L89 132 L89 150 L80 150 Z",
      "M99 132 L91 132 L91 150 L100 150 Z",
      "M80 152 L89 152 L89 171 L79 171 Z",
      "M100 152 L91 152 L91 171 L101 171 Z",
      "M80 173 L89 173 L89 190 L82 194 L78 187 Z",
      "M100 173 L91 173 L91 190 L98 194 L102 187 Z",
    ],
  },
  {
    key: "obliques",
    f: [
      "M61 111 C67 114 73 116 79 116 L78 142 L69 151 L63 139 Z",
      "M119 111 C113 114 107 116 101 116 L102 142 L111 151 L117 139 Z",
      "M69 153 L78 143 L77 184 L70 190 L65 174 Z",
      "M111 153 L102 143 L103 184 L110 190 L115 174 Z",
    ],
  },
  {
    key: "hip-flexors",
    f: [
      "M77 188 L88 195 L86 211 L72 207 L70 194 Z",
      "M103 188 L92 195 L94 211 L108 207 L110 194 Z",
    ],
  },
  {
    key: "glutes",
    b: [
      "M69 177 C76 172 84 173 89 179 L89 208 C82 218 72 216 66 208 C63 195 64 184 69 177 Z",
      "M111 177 C104 172 96 173 91 179 L91 208 C98 218 108 216 114 208 C117 195 116 184 111 177 Z",
    ],
  },
  {
    key: "quads",
    f: [
      "M68 211 C75 207 82 208 87 213 L85 265 C80 272 74 272 68 266 C64 247 64 226 68 211 Z",
      "M88 213 L88 269 C83 278 78 278 75 272 C82 258 83 234 82 211 Z",
      "M112 211 C105 207 98 208 93 213 L95 265 C100 272 106 272 112 266 C116 247 116 226 112 211 Z",
      "M92 213 L92 269 C97 278 102 278 105 272 C98 258 97 234 98 211 Z",
    ],
  },
  {
    key: "hamstrings",
    b: [
      "M67 216 C73 212 80 213 86 217 L85 267 C81 276 74 278 68 271 C64 252 64 232 67 216 Z",
      "M87 216 L88 268 C84 277 80 281 76 276 C82 257 81 235 80 215 Z",
      "M113 216 C107 212 100 213 94 217 L95 267 C99 276 106 278 112 271 C116 252 116 232 113 216 Z",
      "M93 216 L92 268 C96 277 100 281 104 276 C98 257 99 235 100 215 Z",
    ],
  },
  {
    key: "calves",
    f: [
      "M69 280 C74 276 80 279 83 288 L81 337 C78 344 74 343 71 337 C67 318 66 298 69 280 Z",
      "M87 281 C90 298 88 319 83 338 L82 290 C83 284 84 281 87 281 Z",
      "M111 280 C106 276 100 279 97 288 L99 337 C102 344 106 343 109 337 C113 318 114 298 111 280 Z",
      "M93 281 C90 298 92 319 97 338 L98 290 C97 284 96 281 93 281 Z",
    ],
    b: [
      "M68 282 C74 276 82 280 85 292 C84 312 82 330 79 342 C73 345 68 338 67 327 C65 310 65 294 68 282 Z",
      "M86 285 C89 299 87 324 81 343 L84 346 C90 329 92 302 90 282 Z",
      "M112 282 C106 276 98 280 95 292 C96 312 98 330 101 342 C107 345 112 338 113 327 C115 310 115 294 112 282 Z",
      "M94 285 C91 299 93 324 99 343 L96 346 C90 329 88 302 90 282 Z",
    ],
  },
];

const GRADE_SHAPES: Record<string, string[]> = {
  CHEST: BROAD_MUSCLE_SHAPES.chest,
  BACK: BROAD_MUSCLE_SHAPES.back,
  LEGS: BROAD_MUSCLE_SHAPES.legs,
  SHOULDERS: BROAD_MUSCLE_SHAPES.shoulders,
  ARMS: BROAD_MUSCLE_SHAPES.arms,
  CORE: BROAD_MUSCLE_SHAPES.core,
};

function BodySilhouette({ side }: { side: Side }) {
  const back = side === "b";
  return (
    <g fill={BODY_BASE} stroke={OUTLINE} strokeWidth={1.15} strokeLinejoin="round">
      <ellipse cx="90" cy="27" rx="14" ry="18" />
      <path d="M82 43 L82 57 C74 61 67 64 59 68 L64 91 L69 117 L66 163 L72 179 L70 207 L88 215 L90 201 L92 215 L110 207 L108 179 L114 163 L111 117 L116 91 L121 68 C113 64 106 61 98 57 L98 43 Z" />
      <path d="M59 68 C47 68 39 75 36 88 L33 119 L37 151 L28 188 L31 201 L42 204 L51 170 L56 145 L58 115 L66 92 Z" />
      <path d="M121 68 C133 68 141 75 144 88 L147 119 L143 151 L152 188 L149 201 L138 204 L129 170 L124 145 L122 115 L114 92 Z" />
      <path d="M29 188 L25 202 L28 214 L35 211 L42 203 L40 194 Z" />
      <path d="M151 188 L155 202 L152 214 L145 211 L138 203 L140 194 Z" />
      <path d="M70 199 C64 216 63 239 66 267 L64 288 L69 348 L72 376 L85 376 L88 344 L89 282 L90 223 L91 282 L92 344 L95 376 L108 376 L111 348 L116 288 L114 267 C117 239 116 216 110 199 L90 205 Z" />
      <path d="M71 374 L68 385 C73 391 82 392 88 387 L85 374 Z" />
      <path d="M109 374 L112 385 C107 391 98 392 92 387 L95 374 Z" />
      {back ? (
        <path d="M76 47 C80 52 85 55 90 55 C95 55 100 52 104 47" fill="none" opacity="0.55" />
      ) : (
        <path d="M82 48 C85 52 87 54 90 54 C93 54 95 52 98 48" fill="none" opacity="0.55" />
      )}
    </g>
  );
}

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
    REGIONS.flatMap((region) =>
      (region[side] ?? []).map((d, index) => (
        <path
          key={`${side}-${region.key}-${index}`}
          d={d}
          fill={fill(region.key)}
          stroke={SEPARATOR}
          strokeWidth={0.9}
          strokeLinejoin="round"
        />
      )),
    );

  const sides: Side[] = view === "front" ? ["f"] : view === "back" ? ["b"] : ["f", "b"];
  const figureWidth = size * 0.45;

  return (
    <div className="flex justify-center gap-3" style={{ width: "100%" }}>
      {sides.map((side) => (
        <svg
          key={side}
          viewBox="0 0 180 400"
          width={figureWidth}
          height={size}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <BodySilhouette side={side} />
          {render(side)}
        </svg>
      ))}
    </div>
  );
}
