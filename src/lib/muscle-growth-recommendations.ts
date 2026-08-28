import { trackingModeFor, type TrackingMode } from "./set-tracking";
import type { Equipment, Exercise, Profile, Program, Schedule } from "./types";

/**
 * Deterministic muscle-growth coaching for the Strength screen.
 *
 * This module deliberately contains no model calls, network access, dates or
 * random values. The same profile, plan and exercise library always produce
 * the same cards in the same order.
 */

export type GrowthGoal = "SIZE" | "STRENGTH" | "BALANCE";

export type BroadGrowthTarget = "CHEST" | "BACK" | "SHOULDERS" | "ARMS" | "LEGS" | "CORE";

export type SpecificGrowthTarget =
  | "UPPER_CHEST"
  | "MID_CHEST"
  | "LOWER_CHEST"
  | "BACK_WIDTH"
  | "BACK_THICKNESS"
  | "LOWER_BACK"
  | "TRAPS"
  | "FRONT_DELTS"
  | "SIDE_DELTS"
  | "REAR_DELTS"
  | "BICEPS"
  | "TRICEPS"
  | "FOREARMS"
  | "QUADS"
  | "HAMSTRINGS"
  | "GLUTES"
  | "CALVES"
  | "ADDUCTORS"
  | "ABDUCTORS"
  | "HIP_FLEXORS"
  | "ABS"
  | "OBLIQUES";

export type GrowthTarget = BroadGrowthTarget | SpecificGrowthTarget;

export interface GrowthTargetOption {
  id: GrowthTarget;
  label: string;
  shortLabel: string;
  question: string;
  muscleGroup: BroadGrowthTarget;
  kind: "BROAD" | "SPECIFIC";
}

export interface GrowthGoalOption {
  id: GrowthGoal;
  label: string;
  description: string;
}

export const GROWTH_GOAL_OPTIONS: readonly GrowthGoalOption[] = [
  { id: "SIZE", label: "Build size", description: "Prioritise focused, repeatable volume." },
  {
    id: "STRENGTH",
    label: "Get stronger",
    description: "Prioritise loadable movements and lower rep targets.",
  },
  {
    id: "BALANCE",
    label: "Fix my balance",
    description: "Fill the areas your current programme misses.",
  },
] as const;

const BROAD_OPTIONS: readonly GrowthTargetOption[] = [
  {
    id: "CHEST",
    label: "Chest",
    shortLabel: "Chest",
    question: "How can I get my chest bigger?",
    muscleGroup: "CHEST",
    kind: "BROAD",
  },
  {
    id: "BACK",
    label: "Back",
    shortLabel: "Back",
    question: "How can I get my back bigger?",
    muscleGroup: "BACK",
    kind: "BROAD",
  },
  {
    id: "SHOULDERS",
    label: "Shoulders",
    shortLabel: "Shoulders",
    question: "How can I build wider shoulders?",
    muscleGroup: "SHOULDERS",
    kind: "BROAD",
  },
  {
    id: "ARMS",
    label: "Arms",
    shortLabel: "Arms",
    question: "How can I get bigger arms?",
    muscleGroup: "ARMS",
    kind: "BROAD",
  },
  {
    id: "LEGS",
    label: "Legs",
    shortLabel: "Legs",
    question: "How can I build bigger legs?",
    muscleGroup: "LEGS",
    kind: "BROAD",
  },
  {
    id: "CORE",
    label: "Core",
    shortLabel: "Core",
    question: "How can I build a stronger core?",
    muscleGroup: "CORE",
    kind: "BROAD",
  },
] as const;

const SPECIFIC_OPTIONS: readonly GrowthTargetOption[] = [
  specific("UPPER_CHEST", "Upper chest", "Upper chest", "CHEST"),
  specific("MID_CHEST", "Mid chest", "Mid chest", "CHEST"),
  specific("LOWER_CHEST", "Lower chest", "Lower chest", "CHEST"),
  specific("BACK_WIDTH", "Back width", "Width", "BACK"),
  specific("BACK_THICKNESS", "Back thickness", "Thickness", "BACK"),
  specific("LOWER_BACK", "Lower back", "Lower back", "BACK"),
  specific("TRAPS", "Traps", "Traps", "BACK"),
  specific("FRONT_DELTS", "Front delts", "Front delts", "SHOULDERS"),
  specific("SIDE_DELTS", "Side delts", "Side delts", "SHOULDERS"),
  specific("REAR_DELTS", "Rear delts", "Rear delts", "SHOULDERS"),
  specific("BICEPS", "Biceps", "Biceps", "ARMS"),
  specific("TRICEPS", "Triceps", "Triceps", "ARMS"),
  specific("FOREARMS", "Forearms", "Forearms", "ARMS"),
  specific("QUADS", "Quads", "Quads", "LEGS"),
  specific("HAMSTRINGS", "Hamstrings", "Hamstrings", "LEGS"),
  specific("GLUTES", "Glutes", "Glutes", "LEGS"),
  specific("CALVES", "Calves", "Calves", "LEGS"),
  specific("ADDUCTORS", "Inner thighs", "Adductors", "LEGS"),
  specific("ABDUCTORS", "Outer hips", "Abductors", "LEGS"),
  specific("HIP_FLEXORS", "Hip flexors", "Hip flexors", "LEGS"),
  specific("ABS", "Abs", "Abs", "CORE"),
  specific("OBLIQUES", "Obliques", "Obliques", "CORE"),
] as const;

function specific(
  id: SpecificGrowthTarget,
  label: string,
  shortLabel: string,
  muscleGroup: BroadGrowthTarget,
): GrowthTargetOption {
  return {
    id,
    label,
    shortLabel,
    question: `How can I build my ${label.toLowerCase()}?`,
    muscleGroup,
    kind: "SPECIFIC",
  };
}

export const GROWTH_TARGET_OPTIONS: readonly GrowthTargetOption[] = [
  ...BROAD_OPTIONS,
  ...SPECIFIC_OPTIONS,
] as const;

const TARGET_BY_ID = new Map(GROWTH_TARGET_OPTIONS.map((option) => [option.id, option]));

const COVERAGE_AREAS: Record<BroadGrowthTarget, readonly SpecificGrowthTarget[]> = {
  CHEST: ["UPPER_CHEST", "MID_CHEST", "LOWER_CHEST"],
  BACK: ["BACK_WIDTH", "BACK_THICKNESS", "LOWER_BACK", "TRAPS"],
  SHOULDERS: ["FRONT_DELTS", "SIDE_DELTS", "REAR_DELTS"],
  ARMS: ["BICEPS", "TRICEPS", "FOREARMS"],
  LEGS: ["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "ADDUCTORS", "ABDUCTORS", "HIP_FLEXORS"],
  CORE: ["ABS", "OBLIQUES"],
};

const TARGET_PATTERNS: Record<SpecificGrowthTarget, readonly RegExp[]> = {
  UPPER_CHEST: [/\bupper[ -]?chest\b/i, /\bincline\b/i, /\bclavicular\b/i],
  MID_CHEST: [
    /\bmid(?:dle)?[ -]?chest\b/i,
    /\bflat[ -]?(?:bench|press|fly|flye)\b/i,
    /\bbench press\b/i,
    /\bchest press\b/i,
    /\bpec deck\b/i,
    /\bcable (?:fly|flye)\b/i,
  ],
  LOWER_CHEST: [/\blower[ -]?chest\b/i, /\bdecline\b/i, /\bchest dips?\b/i, /^dips?\b/i],
  BACK_WIDTH: [
    /\bback width\b/i,
    /\blats?\b/i,
    /\bpull[ -]?ups?\b/i,
    /\bchin[ -]?ups?\b/i,
    /\bpulldowns?\b/i,
    /\bstraight[ -]?arm\b/i,
  ],
  BACK_THICKNESS: [
    /\bback thickness\b/i,
    /\bmid[ -]?back\b/i,
    /\bupper[ -]?back\b/i,
    /\brhomboids?\b/i,
    /\brows?\b/i,
    /\bface pulls?\b/i,
  ],
  LOWER_BACK: [
    /\blower[ -]?back\b/i,
    /\berectors?\b/i,
    /\bdeadlifts?\b/i,
    /\bback extensions?\b/i,
    /\bhyperextensions?\b/i,
    /\bsupermans?\b/i,
    /\bgood mornings?\b/i,
  ],
  TRAPS: [/\btraps?\b/i, /\btrapezius\b/i, /\bshrugs?\b/i, /\bupright rows?\b/i],
  FRONT_DELTS: [
    /\bfront delts?\b/i,
    /\banterior delts?\b/i,
    /\bfront raises?\b/i,
    /\boverhead press\b/i,
    /\bshoulder press\b/i,
    /\bmilitary press\b/i,
    /\bpike push[ -]?ups?\b/i,
  ],
  SIDE_DELTS: [
    /\bside delts?\b/i,
    /\blateral delts?\b/i,
    /\bmiddle delts?\b/i,
    /\blateral raises?\b/i,
  ],
  REAR_DELTS: [
    /\brear delts?\b/i,
    /\bposterior delts?\b/i,
    /\breverse (?:fly|flye|pec deck)\b/i,
    /\bface pulls?\b/i,
  ],
  BICEPS: [/\bbiceps?\b/i, /\b(?:barbell|dumbbell|hammer|preacher|incline) curls?\b/i],
  TRICEPS: [
    /\btriceps?\b/i,
    /\bpushdowns?\b/i,
    /\bskull crushers?\b/i,
    /\bclose[ -]?grip\b/i,
    /\btriceps? extensions?\b/i,
  ],
  FOREARMS: [
    /\bforearms?\b/i,
    /\bwrist (?:curls?|rollers?)\b/i,
    /\breverse curls?\b/i,
    /\bhammer curls?\b/i,
    /\bfarmers?(?:'s)? (?:carry|walk)\b/i,
  ],
  QUADS: [
    /\bquads?\b/i,
    /\bquadriceps\b/i,
    /\bsquats?\b/i,
    /\bleg press\b/i,
    /\bleg extensions?\b/i,
    /\blunges?\b/i,
    /\bstep[ -]?ups?\b/i,
  ],
  HAMSTRINGS: [
    /\bhamstrings?\b/i,
    /\bromanian deadlifts?\b/i,
    /\brdls?\b/i,
    /\bleg curls?\b/i,
    /\bgood mornings?\b/i,
  ],
  GLUTES: [
    /\bglutes?\b/i,
    /\bhip thrusts?\b/i,
    /\bglute bridges?\b/i,
    /\bsplit squats?\b/i,
    /\blunges?\b/i,
    /\bsquats?\b/i,
  ],
  CALVES: [/\bcalf\b/i, /\bcalves\b/i, /\bcalf raises?\b/i],
  ADDUCTORS: [/\badductors?\b/i, /\binner thighs?\b/i, /\bsumo\b/i],
  ABDUCTORS: [/\babductors?\b/i, /\bouter hips?\b/i, /\blateral band\b/i, /\bclam ?shells?\b/i],
  HIP_FLEXORS: [/\bhip flexors?\b/i, /\bhanging (?:leg|knee) raises?\b/i, /\bcaptain'?s chair\b/i],
  ABS: [
    /\babs?\b/i,
    /\babdominals?\b/i,
    /\bcore\b/i,
    /\bcrunches?\b/i,
    /\bplanks?\b/i,
    /\bdead bugs?\b/i,
    /\brollouts?\b/i,
    /\bleg raises?\b/i,
  ],
  OBLIQUES: [
    /\bobliques?\b/i,
    /\bside planks?\b/i,
    /\bbicycle crunches?\b/i,
    /\bwood ?chops?\b/i,
    /\bpallof\b/i,
    /\brussian twists?\b/i,
    /\brotation(?:al)?\b/i,
  ],
};

const COMPOUND_PATTERN =
  /\b(bench presses?|chest presses?|overhead presses?|shoulder presses?|military presses?|deadlifts?|squats?|leg presses?|rows?|pull[ -]?ups?|chin[ -]?ups?|dips?|lunges?|split squats?|hip thrusts?|push[ -]?ups?)\b/i;

const SAFE_EXERCISE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

type GrowthProfile = Partial<
  Pick<
    Profile,
    | "equipment"
    | "experience"
    | "daysPerWeek"
    | "focusMuscles"
    | "sessionMinutes"
    | "exercisesPerSession"
    | "injuries"
  >
>;

export interface BuildMuscleGrowthGuideOptions {
  target: GrowthTarget;
  goal?: GrowthGoal;
  exercises: readonly Exercise[];
  profile?: GrowthProfile | null;
  schedule?: Schedule | null;
  activeProgram?: Pick<Program, "days"> | null;
  /** Movements hidden by the athlete or unavailable today. */
  excludedExerciseIds?: readonly string[];
  /** Number of cards to return. Clamped to 1–6. */
  limit?: number;
}

export interface GrowthPrescription {
  sets: number;
  /**
   * A schedule target such as "8-12" or "45-60s", never a completed-set rep
   * count. Live duration/distance sets must continue to be stored with reps: 0.
   */
  reps: string;
  tracking: TrackingMode;
  restSeconds: number;
}

export interface GrowthRecommendationAction {
  id: string;
  type: "ADD_EXERCISE";
  exerciseId: string;
}

export interface GrowthExerciseRecommendation {
  /** Stable, DOM/navigation-safe identifier for this rendered card. */
  id: string;
  exerciseId: string;
  name: string;
  muscleGroup: BroadGrowthTarget;
  match: "DIRECT" | "SUPPORTING";
  areas: SpecificGrowthTarget[];
  areaLabels: string[];
  alreadyPlanned: boolean;
  reason: string;
  reasons: string[];
  caution?: string;
  prescription: GrowthPrescription;
  action: GrowthRecommendationAction;
}

export interface GrowthCoverage {
  status: "NONE" | "PARTIAL" | "COVERED";
  headline: string;
  guidance: string;
  coveredAreas: SpecificGrowthTarget[];
  coveredAreaLabels: string[];
  missingAreas: SpecificGrowthTarget[];
  missingAreaLabels: string[];
  plannedExerciseIds: string[];
  weeklyExposureCount: number;
  suggestedWeeklyExposure: string;
}

export interface MuscleGrowthGuide {
  /** Stable, safe identifier for the whole result. */
  id: string;
  target: GrowthTarget;
  goal: GrowthGoal;
  title: string;
  question: string;
  summary: string;
  safetyNote: string;
  coverage: GrowthCoverage;
  recommendations: GrowthExerciseRecommendation[];
  /** New, safe library IDs ready for a UI's bulk-add action. */
  addExerciseIds: string[];
  emptyReason?: string;
}

interface PlannedContext {
  ids: Set<string>;
  names: Set<string>;
  exerciseIds: string[];
  areas: Set<SpecificGrowthTarget>;
  targetExerciseCount: number;
  weeklyExposureCount: number;
}

interface Candidate {
  exercise: Exercise;
  score: number;
  directAreas: SpecificGrowthTarget[];
  alreadyPlanned: boolean;
  compound: boolean;
  tracking: Exclude<TrackingMode, "DISTANCE">;
}

export function isSafeGrowthExerciseId(value: string): boolean {
  return SAFE_EXERCISE_ID.test(value);
}

export function growthTargetOption(target: GrowthTarget): GrowthTargetOption {
  const option = TARGET_BY_ID.get(target);
  if (!option) throw new Error(`Unknown growth target: ${target}`);
  return option;
}

export function growthTargetsFor(muscle: BroadGrowthTarget): GrowthTargetOption[] {
  return GROWTH_TARGET_OPTIONS.filter((option) => option.muscleGroup === muscle);
}

export function buildMuscleGrowthGuide({
  target,
  goal = "SIZE",
  exercises,
  profile,
  schedule,
  activeProgram,
  excludedExerciseIds = [],
  limit = 3,
}: BuildMuscleGrowthGuideOptions): MuscleGrowthGuide {
  const option = growthTargetOption(target);
  const numericLimit = Number.isFinite(limit) ? Math.floor(limit) : 3;
  const safeLimit = Math.max(1, Math.min(6, numericLimit));
  const guideId = `growth-${target.toLowerCase().replaceAll("_", "-")}-${goal.toLowerCase()}`;
  const excluded = new Set(excludedExerciseIds);
  const planned = plannedContext(exercises, option, schedule, activeProgram);
  const availableEquipment = profile?.equipment;

  const eligibleExercises = exercises.filter((exercise) => {
    if (!isSafeGrowthExerciseId(exercise.id) || excluded.has(exercise.id)) return false;
    if (exercise.muscleGroup !== option.muscleGroup) return false;
    if (!fitsEquipment(exercise, availableEquipment)) return false;
    return true;
  });
  const candidates = uniqueCandidates(eligibleExercises, planned)
    .map(({ exercise, alreadyPlanned }) => {
      const directAreas = directAreasFor(exercise, option.muscleGroup);
      if (option.kind === "SPECIFIC" && !directAreas.includes(option.id as SpecificGrowthTarget)) {
        return null;
      }
      const compound = isCompound(exercise);
      const tracking = trackingModeFor(exercise, exercise.reps);
      // Conditioning movements are not honest muscle-growth recommendations.
      // Their distance logging remains available elsewhere in the app.
      if (tracking === "DISTANCE") return null;
      const score = candidateScore({
        exercise,
        option,
        goal,
        profile,
        directAreas,
        alreadyPlanned,
        compound,
        tracking,
        missingAreas: new Set(plannedMissingAreas(option, planned)),
      });
      return {
        exercise,
        score,
        directAreas,
        alreadyPlanned,
        compound,
        tracking,
      } satisfies Candidate;
    })
    .filter((candidate): candidate is Candidate => candidate !== null);

  const selected = selectDiverse(candidates, option, safeLimit);
  const recommendations = selected.map((candidate, index) =>
    recommendation(candidate, option, goal, profile, planned, guideId, index),
  );
  const coverage = buildCoverage(option, goal, planned);
  const emptyReason = recommendations.length
    ? undefined
    : availableEquipment
      ? `No ${option.label.toLowerCase()} matches were found for your ${equipmentLabel(availableEquipment).toLowerCase()} setup.`
      : `No safe ${option.label.toLowerCase()} matches were found in the current exercise library.`;

  return {
    id: guideId,
    target,
    goal,
    title: `${option.label} game plan`,
    question: option.question,
    summary: guideSummary(option, goal, recommendations.length, profile),
    safetyNote: profile?.injuries?.trim()
      ? "Your profile includes an injury note. Use only pain-free movements and get qualified guidance before loading an affected area."
      : "Use a controlled, pain-free range of motion and stop if a movement causes sharp pain.",
    coverage,
    recommendations,
    addExerciseIds: recommendations
      .filter((item) => !item.alreadyPlanned)
      .map((item) => item.exerciseId),
    emptyReason,
  };
}

function uniqueCandidates(exercises: readonly Exercise[], planned: PlannedContext) {
  const ordered = [...exercises].sort((a, b) => {
    const aExact = planned.ids.has(a.id);
    const bExact = planned.ids.has(b.id);
    if (aExact !== bExact) return aExact ? -1 : 1;
    const aPlanned = planned.ids.has(a.id) || planned.names.has(normalizeName(a.name));
    const bPlanned = planned.ids.has(b.id) || planned.names.has(normalizeName(b.name));
    if (aPlanned !== bPlanned) return aPlanned ? -1 : 1;
    const metadata = metadataScore(b) - metadataScore(a);
    return metadata || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
  const byName = new Map<string, { exercise: Exercise; alreadyPlanned: boolean }>();
  for (const exercise of ordered) {
    const name = normalizeName(exercise.name);
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      exercise,
      alreadyPlanned: planned.ids.has(exercise.id) || planned.names.has(name),
    });
  }
  return [...byName.values()];
}

function metadataScore(exercise: Exercise) {
  return (
    (exercise.secondaryMuscles?.length ?? 0) * 3 +
    (exercise.equipmentLabel ? 2 : 0) +
    (exercise.proTip ? 1 : 0) +
    (exercise.isCompound !== undefined ? 1 : 0)
  );
}

function candidateScore({
  exercise,
  option,
  goal,
  profile,
  directAreas,
  alreadyPlanned,
  compound,
  tracking,
  missingAreas,
}: {
  exercise: Exercise;
  option: GrowthTargetOption;
  goal: GrowthGoal;
  profile?: GrowthProfile | null;
  directAreas: SpecificGrowthTarget[];
  alreadyPlanned: boolean;
  compound: boolean;
  tracking: TrackingMode;
  missingAreas: Set<SpecificGrowthTarget>;
}) {
  let score = option.kind === "BROAD" ? 50 : 82;
  score += Math.min(18, directAreas.length * 6);
  score +=
    directAreas.filter((area) => missingAreas.has(area)).length * (goal === "BALANCE" ? 16 : 7);

  if (goal === "SIZE") score += compound ? 7 : 15;
  if (goal === "STRENGTH") score += compound ? 28 : 4;
  if (goal === "BALANCE") score += alreadyPlanned ? -28 : 18;
  else if (alreadyPlanned) score -= 10;

  if (tracking === "DISTANCE") score -= 40;
  if (tracking === "DURATION" && option.muscleGroup !== "CORE") score -= 8;

  const experience = profile?.experience;
  if (experience) {
    const gap = experienceRank(exercise.skill) - experienceRank(experience);
    if (gap <= 0) score += 6;
    if (gap >= 1) score -= gap * 16;
  }

  if (exercise.equipmentLabel) score += 2;
  if (exercise.secondaryMuscles?.length) score += 2;
  return score;
}

function selectDiverse(
  candidates: Candidate[],
  option: GrowthTargetOption,
  limit: number,
): Candidate[] {
  const remaining = [...candidates];
  const selected: Candidate[] = [];
  const covered = new Set<SpecificGrowthTarget>();
  while (remaining.length && selected.length < limit) {
    remaining.sort((a, b) => {
      const aNew = a.directAreas.filter((area) => !covered.has(area)).length;
      const bNew = b.directAreas.filter((area) => !covered.has(area)).length;
      const diversity = bNew * 9 - aNew * 9;
      return (
        b.score - a.score + diversity ||
        a.exercise.name.localeCompare(b.exercise.name) ||
        a.exercise.id.localeCompare(b.exercise.id)
      );
    });
    const next = remaining.shift()!;
    selected.push(next);
    next.directAreas.forEach((area) => covered.add(area));
    if (option.kind === "SPECIFIC") covered.add(option.id as SpecificGrowthTarget);
  }
  return selected;
}

function recommendation(
  candidate: Candidate,
  option: GrowthTargetOption,
  goal: GrowthGoal,
  profile: GrowthProfile | null | undefined,
  planned: PlannedContext,
  guideId: string,
  index: number,
): GrowthExerciseRecommendation {
  const { exercise, directAreas, alreadyPlanned, compound, tracking } = candidate;
  const relevantAreas =
    option.kind === "SPECIFIC"
      ? [option.id as SpecificGrowthTarget]
      : directAreas.filter((area) => COVERAGE_AREAS[option.muscleGroup].includes(area));
  const reasons = recommendationReasons(
    exercise,
    option,
    goal,
    profile,
    relevantAreas,
    alreadyPlanned,
    compound,
    planned,
  );
  const id = `${guideId}-rec-${index + 1}`;
  return {
    id,
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroup: option.muscleGroup,
    match: option.kind === "SPECIFIC" || relevantAreas.length ? "DIRECT" : "SUPPORTING",
    areas: relevantAreas,
    areaLabels: relevantAreas.map(targetLabel),
    alreadyPlanned,
    reason: reasons.slice(0, 2).join(" "),
    reasons,
    caution:
      profile?.experience === "BEGINNER" && exercise.skill === "ADVANCED"
        ? "Advanced technique: start light and get your setup checked before progressing."
        : undefined,
    prescription: prescriptionFor(exercise, goal, compound, tracking),
    action: {
      id: `${guideId}-add-${index + 1}`,
      type: "ADD_EXERCISE",
      exerciseId: exercise.id,
    },
  };
}

function recommendationReasons(
  exercise: Exercise,
  option: GrowthTargetOption,
  goal: GrowthGoal,
  profile: GrowthProfile | null | undefined,
  areas: SpecificGrowthTarget[],
  alreadyPlanned: boolean,
  compound: boolean,
  planned: PlannedContext,
) {
  const reasons: string[] = [];
  if (areas.length) {
    reasons.push(`Directly targets ${joinLabels(areas.map(targetLabel)).toLowerCase()}.`);
  } else {
    reasons.push(`Trains your ${option.label.toLowerCase()} with a repeatable movement pattern.`);
  }

  if (goal === "SIZE") {
    reasons.push(
      compound
        ? "A loadable compound anchor for your size-focused sessions."
        : "Focused work that makes controlled volume easy to progress.",
    );
  } else if (goal === "STRENGTH") {
    reasons.push(
      compound
        ? "A compound pattern suited to measurable low-rep progression."
        : "Supports the target area without adding another heavy compound.",
    );
  } else {
    const fills = areas.filter((area) => !planned.areas.has(area));
    reasons.push(
      fills.length
        ? `Fills your plan's ${joinLabels(fills.map(targetLabel)).toLowerCase()} gap.`
        : "Adds another angle for a more balanced plan.",
    );
  }

  if (alreadyPlanned)
    reasons.push("Already in your plan, so you can progress it instead of adding a duplicate.");
  else if (profile?.equipment)
    reasons.push(`Fits your ${equipmentLabel(profile.equipment).toLowerCase()} setup.`);

  if (profile?.experience && experienceRank(exercise.skill) <= experienceRank(profile.experience)) {
    reasons.push(`Matches your ${profile.experience.toLowerCase()} experience level.`);
  }
  return reasons;
}

function prescriptionFor(
  exercise: Exercise,
  goal: GrowthGoal,
  compound: boolean,
  tracking: TrackingMode,
): GrowthPrescription {
  const baseSets = clamp(exercise.sets || 3, 2, 5);
  if (tracking !== "WEIGHT") {
    return {
      sets: goal === "STRENGTH" ? Math.max(3, baseSets) : baseSets,
      reps: exercise.reps || (tracking === "DURATION" ? "30-45s" : "Work interval"),
      tracking,
      restSeconds: goal === "STRENGTH" ? 120 : 75,
    };
  }
  if (goal === "STRENGTH") {
    return {
      sets: compound ? Math.max(4, baseSets) : Math.max(3, baseSets),
      reps: compound ? "3-6" : "6-10",
      tracking,
      restSeconds: compound ? 180 : 120,
    };
  }
  if (goal === "SIZE") {
    return {
      sets: compound ? Math.max(3, baseSets) : 3,
      reps: compound ? "6-10" : "10-15",
      tracking,
      restSeconds: compound ? 120 : 75,
    };
  }
  return {
    sets: baseSets,
    reps: exercise.reps || "8-12",
    tracking,
    restSeconds: compound ? 120 : 90,
  };
}

function plannedContext(
  exercises: readonly Exercise[],
  option: GrowthTargetOption,
  schedule?: Schedule | null,
  activeProgram?: Pick<Program, "days"> | null,
): PlannedContext {
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const ids = new Set<string>();
  const names = new Set<string>();
  const areas = new Set<SpecificGrowthTarget>();
  const exerciseIds: string[] = [];
  const exposureDays = new Set<string>();
  let targetExerciseCount = 0;

  const add = (dayKey: string, id: string, name: string, text: string, group?: string) => {
    ids.add(id);
    names.add(normalizeName(name));
    const parent = group?.toUpperCase() === option.muscleGroup;
    const matched = directAreasForText(text, option.muscleGroup);
    const matchesTarget =
      option.kind === "BROAD"
        ? parent || matched.length > 0
        : matched.includes(option.id as SpecificGrowthTarget);
    if (!matchesTarget) return;
    if (isSafeGrowthExerciseId(id) && !exerciseIds.includes(id)) exerciseIds.push(id);
    targetExerciseCount += 1;
    exposureDays.add(dayKey);
    matched.forEach((area) => areas.add(area));
  };

  // An active saved programme is the live workout source of truth. The older
  // weekly schedule may still be present in state, but must not double-count
  // its movements or exposures while that programme is active.
  if (schedule && !activeProgram) {
    for (const [dayKey, day] of Object.entries(schedule)) {
      for (const id of day.exerciseIds) {
        const exercise = exerciseById.get(id);
        if (!exercise) {
          ids.add(id);
          continue;
        }
        add(
          `schedule-${dayKey}`,
          exercise.id,
          exercise.name,
          searchableText(exercise),
          exercise.muscleGroup,
        );
      }
    }
  }

  if (activeProgram) {
    for (const [dayKey, day] of Object.entries(activeProgram.days)) {
      for (const item of day.items) {
        add(
          `program-${dayKey}`,
          item.id,
          item.name,
          [item.name, item.equipment, ...item.primary_muscles].join(" "),
          broadGroupFromText(item.primary_muscles.join(" ")) ?? undefined,
        );
      }
    }
  }

  return {
    ids,
    names,
    exerciseIds,
    areas,
    targetExerciseCount,
    weeklyExposureCount: exposureDays.size,
  };
}

function buildCoverage(
  option: GrowthTargetOption,
  goal: GrowthGoal,
  planned: PlannedContext,
): GrowthCoverage {
  const expected =
    option.kind === "BROAD"
      ? [...COVERAGE_AREAS[option.muscleGroup]]
      : [option.id as SpecificGrowthTarget];
  const coveredAreas = expected.filter((area) => planned.areas.has(area));
  const missingAreas = expected.filter((area) => !planned.areas.has(area));
  const status: GrowthCoverage["status"] =
    planned.targetExerciseCount === 0 ? "NONE" : missingAreas.length ? "PARTIAL" : "COVERED";
  const weeklyExposure = goal === "BALANCE" ? "1–2 sessions per week" : "2 sessions per week";
  const headline =
    status === "NONE"
      ? `No ${option.label.toLowerCase()} work is set yet`
      : status === "PARTIAL"
        ? `${missingAreas.length} area${missingAreas.length === 1 ? "" : "s"} still missing`
        : `${option.label} coverage is complete`;
  let guidance: string;
  if (status === "NONE") {
    guidance =
      option.kind === "BROAD"
        ? `Start with ${joinLabels(expected.slice(0, 2).map(targetLabel)).toLowerCase()} instead of adding several versions of the same movement.`
        : `Add one ${option.label.toLowerCase()} movement that fits your equipment, then progress it consistently.`;
  } else if (status === "PARTIAL") {
    guidance = `You already cover ${joinLabels(coveredAreas.map(targetLabel)).toLowerCase() || option.label.toLowerCase()}. Add ${joinLabels(missingAreas.map(targetLabel)).toLowerCase()} before duplicating covered angles.`;
  } else {
    guidance = `Your plan covers ${joinLabels(coveredAreas.map(targetLabel)).toLowerCase()}. Progress those movements before adding more exercises.`;
  }
  return {
    status,
    headline,
    guidance,
    coveredAreas,
    coveredAreaLabels: coveredAreas.map(targetLabel),
    missingAreas,
    missingAreaLabels: missingAreas.map(targetLabel),
    plannedExerciseIds: [...planned.exerciseIds].sort(),
    weeklyExposureCount: planned.weeklyExposureCount,
    suggestedWeeklyExposure: weeklyExposure,
  };
}

function plannedMissingAreas(option: GrowthTargetOption, planned: PlannedContext) {
  const expected =
    option.kind === "BROAD"
      ? COVERAGE_AREAS[option.muscleGroup]
      : [option.id as SpecificGrowthTarget];
  return expected.filter((area) => !planned.areas.has(area));
}

function guideSummary(
  option: GrowthTargetOption,
  goal: GrowthGoal,
  count: number,
  profile?: GrowthProfile | null,
) {
  const goalText =
    goal === "SIZE" ? "size-focused" : goal === "STRENGTH" ? "strength-focused" : "balance-focused";
  const setup = profile?.equipment
    ? ` for your ${equipmentLabel(profile.equipment).toLowerCase()} setup`
    : "";
  if (!count) return `No ${goalText} match is available${setup}.`;
  return `${count} ${goalText} pick${count === 1 ? "" : "s"}${setup}, ranked from your exercise library and current plan.`;
}

function directAreasFor(exercise: Exercise, group: BroadGrowthTarget): SpecificGrowthTarget[] {
  return directAreasForText(searchableText(exercise), group);
}

function directAreasForText(text: string, group: BroadGrowthTarget): SpecificGrowthTarget[] {
  return COVERAGE_AREAS[group].filter((target) =>
    TARGET_PATTERNS[target].some((pattern) => pattern.test(text)),
  );
}

function searchableText(exercise: Exercise) {
  return [
    exercise.name,
    exercise.instruction,
    exercise.equipmentLabel,
    exercise.proTip,
    ...(exercise.primaryMuscles ?? []),
    ...(exercise.secondaryMuscles ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function broadGroupFromText(text: string): BroadGrowthTarget | null {
  const value = text.toLowerCase();
  if (/(chest|pec)/.test(value)) return "CHEST";
  if (/(back|lat|trap|rhomboid|erector)/.test(value)) return "BACK";
  if (/(shoulder|delt|rotator)/.test(value)) return "SHOULDERS";
  if (/(arm|bicep|tricep|forearm|brachialis)/.test(value)) return "ARMS";
  if (/(leg|quad|hamstring|glute|calf|calves|adductor|abductor|hip flexor)/.test(value))
    return "LEGS";
  if (/(core|abs|abdominal|oblique)/.test(value)) return "CORE";
  return null;
}

function isCompound(exercise: Exercise) {
  return exercise.isCompound ?? COMPOUND_PATTERN.test(exercise.name);
}

function fitsEquipment(exercise: Exercise, equipment?: Equipment) {
  if (!equipment) return true;
  return exercise.equipment.includes(equipment) || exercise.equipment.includes("BODYWEIGHT");
}

function equipmentLabel(equipment: Equipment) {
  if (equipment === "FULL_GYM") return "Full gym";
  if (equipment === "HOME_GYM") return "Home gym";
  return "Bodyweight";
}

function targetLabel(target: SpecificGrowthTarget) {
  return growthTargetOption(target).shortLabel;
}

function experienceRank(experience: Profile["experience"]) {
  if (experience === "BEGINNER") return 0;
  if (experience === "INTERMEDIATE") return 1;
  return 2;
}

function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
