import {
  MALE_BACK,
  MALE_FRONT,
  type BodyDiagram,
  type MusclePath,
  type OutlinePath,
} from "@musclemap/assets";

type Muscle = string;
type DiagramView = "front" | "back" | "both";
type GradeGroup = "CHEST" | "BACK" | "LEGS" | "SHOULDERS" | "ARMS" | "CORE";
type AnatomyGroup = MusclePath["group"];

interface Props {
  primary?: Muscle[];
  secondary?: Muscle[];
  /** Optional broad-muscle colour map used by the strength report. */
  gradeColors?: Partial<Record<GradeGroup, string>>;
  /** Figure height in CSS pixels. */
  size?: number;
  /** Render one side for comparison layouts, or both for exercise detail. */
  view?: DiagramView;
}

const ACCENT = "#f04432";
const SECONDARY = "#6b211b";
const MUSCLE_BASE = "#292b30";
const BODY_BASE = "#101114";
const MUSCLE_OUTLINE = "#ecece4";
const BODY_OUTLINE = "#aeb0b5";
const BODY_STROKE_WIDTH = 7;
const MUSCLE_STROKE_WIDTH = 7;

/**
 * MuscleMap reserves HIP_FLEXORS in its public group contract but does not yet
 * ship a traced male path. Keep the missing iliopsoas region independently
 * colourable instead of silently dropping Deadset's hip-flexor exercises.
 */
const FRONT_HIP_FLEXORS: MusclePath[] = [
  {
    id: "HIP_FLEXOR_LEFT",
    group: "HIP_FLEXORS",
    side: "LEFT",
    d: "M447 688C455 681 466 679 478 683C481 695 480 708 476 722C473 734 468 746 461 756C453 747 447 736 443 722C440 708 441 696 447 688Z",
  },
];

const ALL_BACK: AnatomyGroup[] = ["BACK_UPPER", "BACK_LOWER", "TRAPEZIUS", "RHOMBOIDS", "LATS"];
const ALL_LEGS: AnatomyGroup[] = [
  "GLUTES",
  "QUADS",
  "HAMSTRINGS",
  "CALVES",
  "HIP_FLEXORS",
  "ADDUCTORS",
  "ABDUCTORS",
];
const ALL_SHOULDERS: AnatomyGroup[] = ["SHOULDERS_FRONT", "SHOULDERS_SIDE", "SHOULDERS_REAR"];
const ALL_ARMS: AnatomyGroup[] = ["BICEPS", "TRICEPS", "FOREARMS"];
const ALL_CORE: AnatomyGroup[] = ["CORE", "OBLIQUES"];

const GRADE_GROUPS: Record<GradeGroup, AnatomyGroup[]> = {
  CHEST: ["CHEST"],
  BACK: ALL_BACK,
  LEGS: ALL_LEGS,
  SHOULDERS: ALL_SHOULDERS,
  ARMS: ALL_ARMS,
  CORE: ALL_CORE,
};

/**
 * Exercise data includes broad labels ("back") and precise labels
 * ("rear delts", "hamstrings"). Both resolve to the same anatomical atlas.
 */
const LABEL_GROUPS: Record<string, AnatomyGroup[]> = {
  chest: ["CHEST"],
  pec: ["CHEST"],
  pecs: ["CHEST"],
  pectoral: ["CHEST"],
  pectorals: ["CHEST"],
  "upper-chest": ["CHEST"],

  back: ALL_BACK,
  "upper-back": ["BACK_UPPER", "TRAPEZIUS", "RHOMBOIDS"],
  "mid-back": ["BACK_UPPER", "RHOMBOIDS"],
  "lower-back": ["BACK_LOWER"],
  erector: ["BACK_LOWER"],
  erectors: ["BACK_LOWER"],
  lat: ["LATS"],
  lats: ["LATS"],
  rhomboid: ["RHOMBOIDS"],
  rhomboids: ["RHOMBOIDS"],
  trap: ["TRAPEZIUS"],
  traps: ["TRAPEZIUS"],
  trapezius: ["TRAPEZIUS"],

  shoulder: ALL_SHOULDERS,
  shoulders: ALL_SHOULDERS,
  delt: ALL_SHOULDERS,
  delts: ALL_SHOULDERS,
  deltoid: ALL_SHOULDERS,
  deltoids: ALL_SHOULDERS,
  "front-delt": ["SHOULDERS_FRONT"],
  "front-delts": ["SHOULDERS_FRONT"],
  "side-delt": ["SHOULDERS_SIDE"],
  "side-delts": ["SHOULDERS_SIDE"],
  "rear-delt": ["SHOULDERS_REAR"],
  "rear-delts": ["SHOULDERS_REAR"],
  rotator: ["SHOULDERS_REAR"],
  "rotator-cuff": ["SHOULDERS_REAR"],

  arm: ALL_ARMS,
  arms: ALL_ARMS,
  bicep: ["BICEPS"],
  biceps: ["BICEPS"],
  brachialis: ["BICEPS"],
  tricep: ["TRICEPS"],
  triceps: ["TRICEPS"],
  forearm: ["FOREARMS"],
  forearms: ["FOREARMS"],

  core: ALL_CORE,
  ab: ["CORE"],
  abs: ["CORE"],
  abdominal: ["CORE"],
  abdominals: ["CORE"],
  oblique: ["OBLIQUES"],
  obliques: ["OBLIQUES"],

  leg: ALL_LEGS,
  legs: ALL_LEGS,
  quad: ["QUADS"],
  quads: ["QUADS"],
  quadricep: ["QUADS"],
  quadriceps: ["QUADS"],
  hamstring: ["HAMSTRINGS"],
  hamstrings: ["HAMSTRINGS"],
  glute: ["GLUTES"],
  glutes: ["GLUTES"],
  calf: ["CALVES"],
  calves: ["CALVES"],
  "hip-flexor": ["HIP_FLEXORS"],
  "hip-flexors": ["HIP_FLEXORS"],
  adductor: ["ADDUCTORS"],
  adductors: ["ADDUCTORS"],
  abductor: ["ABDUCTORS"],
  abductors: ["ABDUCTORS"],
};

function normaliseMuscle(muscle: string) {
  return muscle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function requestedGroups(labels: Muscle[]) {
  const groups = new Set<AnatomyGroup>();
  for (const label of labels) {
    for (const group of LABEL_GROUPS[normaliseMuscle(label)] ?? []) groups.add(group);
  }
  return groups;
}

function expandPath(path: MusclePath | OutlinePath, mirror: string) {
  const paths = [{ d: path.d, transform: undefined as string | undefined }];
  if (path.side === "LEFT") paths.push({ d: path.d, transform: mirror });
  return paths;
}

function AnatomyFigure({
  diagram,
  size,
  fillFor,
}: {
  diagram: BodyDiagram;
  size: number;
  fillFor: (group: AnatomyGroup) => string;
}) {
  const mirror = `matrix(-1 0 0 1 ${2 * diagram.centerX} 0)`;
  const width = Math.round(size * (2 / 3));

  return (
    <svg
      viewBox={diagram.viewBox}
      width={width}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${diagram.view === "FRONT" ? "Front" : "Back"} muscle anatomy`}
      className="block max-w-full"
    >
      <g
        fill={BODY_BASE}
        stroke={BODY_OUTLINE}
        strokeWidth={BODY_STROKE_WIDTH}
        strokeLinejoin="round"
      >
        {diagram.outline.flatMap((path, index) =>
          expandPath(path, mirror).map((part, partIndex) => (
            <path
              key={`outline-${path.id}-${index}-${partIndex}`}
              d={part.d}
              transform={part.transform}
            />
          )),
        )}
      </g>

      <g stroke={MUSCLE_OUTLINE} strokeWidth={MUSCLE_STROKE_WIDTH} strokeLinejoin="round">
        {[...diagram.muscles, ...(diagram.view === "FRONT" ? FRONT_HIP_FLEXORS : [])].flatMap(
          (path, index) =>
            expandPath(path, mirror).map((part, partIndex) => (
              <path
                key={`${path.id ?? path.group}-${index}-${partIndex}`}
                d={part.d}
                fill={fillFor(path.group)}
                transform={part.transform}
                data-muscle-group={path.group}
              />
            )),
        )}
      </g>
    </svg>
  );
}

/**
 * Detailed, independently colourable front/back muscular anatomy. The atlas is
 * rendered as SVG image data so it remains sharp and every region can reflect
 * the athlete's exercise selection or strength grade.
 */
export function MuscleDiagram({
  primary = [],
  secondary = [],
  gradeColors,
  size = 220,
  view = "both",
}: Props) {
  const primaryGroups = requestedGroups(primary);
  const secondaryGroups = requestedGroups(secondary);
  const graded = new Map<AnatomyGroup, string>();

  for (const [group, color] of Object.entries(gradeColors ?? {}) as Array<
    [GradeGroup, string | undefined]
  >) {
    if (!color) continue;
    for (const anatomyGroup of GRADE_GROUPS[group] ?? []) graded.set(anatomyGroup, color);
  }

  const fillFor = (group: AnatomyGroup) =>
    graded.get(group) ??
    (primaryGroups.has(group) ? ACCENT : secondaryGroups.has(group) ? SECONDARY : MUSCLE_BASE);

  const diagrams =
    view === "front" ? [MALE_FRONT] : view === "back" ? [MALE_BACK] : [MALE_FRONT, MALE_BACK];

  return (
    <div
      className="flex w-full items-end justify-center gap-1.5"
      aria-label={view === "both" ? "Front and back muscle map" : `${view} muscle map`}
    >
      {diagrams.map((diagram) => (
        <AnatomyFigure key={diagram.id} diagram={diagram} size={size} fillFor={fillFor} />
      ))}
    </div>
  );
}
