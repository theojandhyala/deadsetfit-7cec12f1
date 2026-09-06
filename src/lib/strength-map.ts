import { estimate1RM, updateScheduleDay, WEEK } from "./calc";
import { allExercises, getExercise } from "./exercises";
import type { AppState, CompletedSet, DayKey, Exercise, Schedule, SetLog } from "./types";

export const STRENGTH_REGIONS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
] as const;

export type StrengthRegion = (typeof STRENGTH_REGIONS)[number];

export interface StrengthMapRegion {
  id: StrengthRegion;
  label: string;
  score: number;
  exerciseCount: number;
  loggedExerciseCount: number;
  status: "unplanned" | "unlogged" | "tracked";
  exercises: StrengthExerciseEvidence[];
  weeklySets: number;
  weeklyTarget: { min: number; max: number };
  trend: "up" | "steady" | "down";
}

export interface StrengthExerciseEvidence {
  exerciseId: string;
  name: string;
  sessions: number;
  firstEstimate: number;
  latestEstimate: number;
  bestEstimate: number;
  changePercent: number;
  latestWeight: number;
  latestReps: number;
}

export interface StrengthRecommendation {
  exercise: Exercise;
  alreadyPlanned: boolean;
  reason: string;
}

export interface StrengthMapResult {
  regions: StrengthMapRegion[];
  trackedCount: number;
  plannedCount: number;
  overall: number;
}

const INJURY_MOVEMENT_RULES: Array<[RegExp, RegExp]> = [
  [/(shoulder|rotator|delt)/i, /(overhead|shoulder press|upright row|dip|behind.{0,3}neck)/i],
  [/(knee|patella|acl|mcl|meniscus)/i, /(squat|lunge|leg press|leg extension|step.?up)/i],
  [/(lower back|lumbar|spine|disc)/i, /(deadlift|romanian|rdl|good morning|bent.?over row)/i],
  [/(elbow|tennis elbow)/i, /(dip|skull|tricep extension|preacher curl)/i],
  [/(wrist|hand)/i, /(barbell|dumbbell|push.?up|front rack)/i],
  [/(hip|groin)/i, /(squat|lunge|split squat|hip thrust|adductor)/i],
];

export function exerciseRespectsInjuryNotes(exercise: Exercise, injuryNotes?: string): boolean {
  const notes = injuryNotes?.trim();
  if (!notes || /^(none|no|n\/a)$/i.test(notes)) return true;
  const movement = `${exercise.id} ${exercise.name}`;
  return !INJURY_MOVEMENT_RULES.some(
    ([injuryPattern, movementPattern]) => injuryPattern.test(notes) && movementPattern.test(movement),
  );
}

const LABELS: Record<StrengthRegion, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

const BODYWEIGHT_LOAD: Array<[RegExp, number]> = [
  [/push[- ]?up/i, 0.64],
  [/(pull[- ]?up|chin[- ]?up|dip)/i, 1],
  [/(squat|lunge|split)/i, 0.8],
  [/(plank|dead bug|crunch|raise|wheel)/i, 0.35],
];

function addRegion(set: Set<StrengthRegion>, haystack: string) {
  if (/(chest|pec)/i.test(haystack)) set.add("chest");
  if (/(back|lat|rhomboid|erector)/i.test(haystack)) set.add("back");
  if (/(shoulder|delt|trap)/i.test(haystack)) set.add("shoulders");
  if (/(arm|bicep|tricep|forearm|brachialis)/i.test(haystack)) set.add("arms");
  if (/(core|abdom|oblique)/i.test(haystack)) set.add("core");
  if (/(quad|leg extension|leg press|squat|lunge)/i.test(haystack)) set.add("quads");
  if (/(hamstring|leg curl|romanian|rdl|good morning)/i.test(haystack)) set.add("hamstrings");
  if (/(glute|hip thrust|bridge|romanian|rdl)/i.test(haystack)) set.add("glutes");
  if (/(calf|calves|soleus)/i.test(haystack)) set.add("calves");
}

export function strengthRegionsForExercise(
  exercise: Pick<Exercise, "id" | "name" | "muscleGroup" | "secondaryMuscles">,
  sessionMuscles: string[] = [],
): StrengthRegion[] {
  const regions = new Set<StrengthRegion>();
  const haystack = [
    exercise.id,
    exercise.name,
    exercise.muscleGroup,
    ...(exercise.secondaryMuscles ?? []),
    ...sessionMuscles,
  ].join(" ");
  addRegion(regions, haystack);

  // A broad library group is useful for scheduling but too vague for a map.
  // Exercise-name rules above win; only fall back to the whole lower body when
  // the movement genuinely has no more specific metadata.
  const lowerBodyRegions: StrengthRegion[] = ["quads", "hamstrings", "glutes", "calves"];
  if (
    exercise.muscleGroup === "LEGS" &&
    ![...regions].some((region) => lowerBodyRegions.includes(region))
  ) {
    regions.add("quads");
    regions.add("hamstrings");
    regions.add("glutes");
    regions.add("calves");
  }
  return [...regions];
}

function effectiveLoad(
  exercise: Pick<Exercise, "id" | "name">,
  set: Pick<CompletedSet, "weight" | "reps"> | Pick<SetLog, "weight" | "reps">,
  bodyweightKg: number,
): number {
  if (set.reps <= 0) return 0;
  if (set.weight > 0) return estimate1RM(set.weight, set.reps);
  const factor = BODYWEIGHT_LOAD.find(([pattern]) =>
    pattern.test(`${exercise.id} ${exercise.name}`),
  )?.[1];
  return factor ? estimate1RM(bodyweightKg * factor, set.reps) : 0;
}

type Point = { day: string; value: number; weight: number; reps: number };

function exerciseScore(points: Point[]): number {
  if (!points.length) return 0;
  const byDay = new Map<string, number>();
  for (const point of points) {
    byDay.set(point.day, Math.max(byDay.get(point.day) ?? 0, point.value));
  }
  const ordered = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const first = ordered[0][1];
  const best = Math.max(...ordered.map(([, value]) => value));
  const gain = first > 0 ? Math.max(0, best / first - 1) : 0;
  const progress = Math.min(35, gain * 70); // +50% load/e1RM earns the full progress band.
  const proof = Math.min(15, Math.max(0, ordered.length - 1) * 3);
  return Math.round(50 + progress + proof);
}

export function buildStrengthMap(state: AppState, now = new Date()): StrengthMapResult {
  const planned = new Map<StrengthRegion, Set<string>>();
  const logged = new Map<StrengthRegion, Map<string, Point[]>>();
  const weeklySets = new Map<StrengthRegion, number>();
  for (const region of STRENGTH_REGIONS) {
    planned.set(region, new Set());
    logged.set(region, new Map());
    weeklySets.set(region, 0);
  }

  const exerciseFor = (id: string, fallbackName = id) =>
    getExercise(id, state.savedExercises) ?? {
      id,
      name: fallbackName,
      // Unknown/custom movements are classified from their name and any
      // session muscle metadata instead of being falsely painted as core.
      muscleGroup: "" as Exercise["muscleGroup"],
      equipment: [],
      skill: "BEGINNER" as const,
      sets: 0,
      reps: "",
      videoId: "",
      instruction: "",
    };

  if (state.schedule) {
    for (const day of Object.values(state.schedule)) {
      for (const id of day.exerciseIds) {
        const exercise = exerciseFor(id);
        for (const region of strengthRegionsForExercise(exercise)) planned.get(region)!.add(id);
      }
    }
  }

  const addPoint = (
    exercise: Exercise,
    muscles: string[],
    day: string,
    value: number,
    weight: number,
    reps: number,
  ) => {
    if (value <= 0) return;
    for (const region of strengthRegionsForExercise(exercise, muscles)) {
      const exercises = logged.get(region)!;
      const points = exercises.get(exercise.id) ?? [];
      points.push({ day: day.slice(0, 10), value, weight, reps });
      exercises.set(exercise.id, points);
    }
  };

  // Signup/profile baselines are genuine athlete-entered evidence. Keeping
  // them in the same pipeline means the map is useful before workout one and
  // subsequent logged sets build on the exact starting point they supplied.
  for (const [exerciseId, pr] of Object.entries(state.manualPRs ?? {})) {
    const exercise = exerciseFor(exerciseId);
    const reps = Math.max(1, pr.reps ?? 1);
    const baseline = { weight: pr.value, reps };
    addPoint(
      exercise,
      [],
      pr.date,
      effectiveLoad(exercise, baseline, state.profile?.weightKg ?? 0),
      pr.value,
      reps,
    );
  }

  for (const log of state.logs) {
    const exercise = exerciseFor(log.exerciseId);
    addPoint(
      exercise,
      [],
      log.date,
      effectiveLoad(exercise, log, state.profile?.weightKg ?? 0),
      log.weight,
      log.reps,
    );
  }

  for (const session of state.sessions) {
    const sessionAge = now.getTime() - new Date(`${session.date}T12:00:00`).getTime();
    const inLastSevenDays = sessionAge >= 0 && sessionAge < 7 * 86_400_000;
    for (const item of session.exercises) {
      const exercise = exerciseFor(item.exerciseId, item.name);
      for (const set of item.sets) {
        if (set.kind === "warmup") continue;
        if (inLastSevenDays) {
          for (const region of strengthRegionsForExercise(exercise, item.primary_muscles)) {
            weeklySets.set(region, (weeklySets.get(region) ?? 0) + 1);
          }
        }
        addPoint(
          exercise,
          item.primary_muscles,
          session.date || session.startedAt,
          effectiveLoad(exercise, set, state.profile?.weightKg ?? 0),
          set.weight,
          set.reps,
        );
      }
    }
  }

  const regions = STRENGTH_REGIONS.map((id): StrengthMapRegion => {
    const plannedExercises = planned.get(id)!;
    const loggedExercises = logged.get(id)!;
    const scores = [...loggedExercises.values()].map(exerciseScore).filter((score) => score > 0);
    const exercises = [...loggedExercises.entries()]
      .map(([exerciseId, points]): StrengthExerciseEvidence => {
        const ordered = [...points].sort((a, b) => a.day.localeCompare(b.day));
        const first = ordered[0];
        const latest = ordered[ordered.length - 1];
        const best = ordered.reduce((winner, point) =>
          point.value > winner.value ? point : winner,
        );
        return {
          exerciseId,
          name: exerciseFor(exerciseId).name,
          sessions: new Set(ordered.map((point) => point.day)).size,
          firstEstimate: Math.round(first.value),
          latestEstimate: Math.round(latest.value),
          bestEstimate: Math.round(best.value),
          changePercent: first.value > 0 ? Math.round((best.value / first.value - 1) * 100) : 0,
          latestWeight: latest.weight,
          latestReps: latest.reps,
        };
      })
      .sort((a, b) => b.bestEstimate - a.bestEstimate);
    const historicalScore = scores.length
      ? Math.round(scores.reduce((total, value) => total + value, 0) / scores.length)
      : 0;
    const exerciseCount = plannedExercises.size;
    const experience = state.profile?.experience ?? "BEGINNER";
    const weeklyTarget =
      experience === "ADVANCED"
        ? { min: 10, max: 18 }
        : experience === "INTERMEDIATE"
          ? { min: 8, max: 16 }
          : { min: 6, max: 12 };
    const averageChange = exercises.length
      ? exercises.reduce((total, exercise) => total + exercise.changePercent, 0) / exercises.length
      : 0;
    // The visual answers whether the current plan covers the area. Historical
    // lifts remain elsewhere, but an uncovered region must stay grey.
    const score = exerciseCount === 0 ? 0 : historicalScore;
    return {
      id,
      label: LABELS[id],
      score,
      exerciseCount,
      loggedExerciseCount: loggedExercises.size,
      status: exerciseCount === 0 ? "unplanned" : scores.length === 0 ? "unlogged" : "tracked",
      exercises,
      weeklySets: weeklySets.get(id) ?? 0,
      weeklyTarget,
      trend: averageChange > 1 ? "up" : averageChange < -1 ? "down" : "steady",
    };
  });
  const tracked = regions.filter((region) => region.status === "tracked");
  return {
    regions,
    trackedCount: tracked.length,
    plannedCount: regions.filter((region) => region.status !== "unplanned").length,
    overall: tracked.length
      ? Math.round(tracked.reduce((total, region) => total + region.score, 0) / tracked.length)
      : 0,
  };
}

export function strengthRecommendations(
  state: AppState,
  region: StrengthRegion,
  limit = 4,
): StrengthRecommendation[] {
  const planned = new Set(
    state.schedule ? Object.values(state.schedule).flatMap((day) => day.exerciseIds) : [],
  );
  const equipment = state.profile?.equipment;
  const experience = state.profile?.experience;
  return allExercises(state.savedExercises)
    .filter((exercise) => strengthRegionsForExercise(exercise).includes(region))
    .filter((exercise) => !equipment || exercise.equipment.includes(equipment))
    .filter((exercise) => exerciseRespectsInjuryNotes(exercise, state.profile?.injuries))
    .sort((a, b) => {
      const plannedOrder = Number(planned.has(b.id)) - Number(planned.has(a.id));
      if (plannedOrder) return plannedOrder;
      const levelOrder = Number(b.skill === experience) - Number(a.skill === experience);
      if (levelOrder) return levelOrder;
      return Number(Boolean(b.isCompound)) - Number(Boolean(a.isCompound));
    })
    .slice(0, limit)
    .map((exercise) => ({
      exercise,
      alreadyPlanned: planned.has(exercise.id),
      reason: exercise.isCompound
        ? `High-return ${LABELS[region].toLowerCase()} movement`
        : `Adds focused ${LABELS[region].toLowerCase()} work`,
    }));
}

export function addStrengthExerciseToSchedule(
  state: AppState,
  exerciseId: string,
  region: StrengthRegion,
): { schedule: Schedule; day: DayKey; added: boolean } | null {
  if (!state.schedule) return null;
  for (const day of WEEK) {
    if (state.schedule[day].exerciseIds.includes(exerciseId)) {
      return { schedule: state.schedule, day, added: false };
    }
  }

  const trainingDays = WEEK.filter((day) => state.schedule![day].exerciseIds.length > 0);
  if (!trainingDays.length) return null;
  const scoreDay = (day: DayKey) => {
    const ids = state.schedule![day].exerciseIds;
    const matches = ids.filter((id) => {
      const exercise = getExercise(id, state.savedExercises);
      return exercise ? strengthRegionsForExercise(exercise).includes(region) : false;
    }).length;
    // Matching an existing session is more important than merely choosing the shortest day.
    return matches * 100 - ids.length;
  };
  const day = [...trainingDays].sort((a, b) => scoreDay(b) - scoreDay(a))[0];
  return {
    day,
    added: true,
    schedule: updateScheduleDay(state.schedule, day, (current) => ({
      ...current,
      exerciseIds: [...current.exerciseIds, exerciseId],
    })),
  };
}

export function strengthMapColor(score: number): string {
  if (score <= 0) return "#1a1a1a";
  if (score < 55) return "#a33a32";
  if (score < 65) return "#e63222";
  if (score < 75) return "#f59e0b";
  if (score < 85) return "#22c55e";
  if (score < 95) return "#3b82f6";
  return "#a855f7";
}
