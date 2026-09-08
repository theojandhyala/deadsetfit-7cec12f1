import { allExercises, getExercise } from "./exercises";
import { defaultSchedule } from "./calc";
import { normalisedPlanExerciseName } from "./muscle-growth-plan";
import { libraryExerciseToExercise } from "./exercise-library";
import type { LibraryExercise } from "./library.functions";
import type { AppState, Exercise } from "./types";

export interface FinderExercise extends LibraryExercise {
  muscleGroup: Exercise["muscleGroup"];
  source: "SAVED" | "BUILT_IN" | "CATALOGUE";
  plannedSets: number;
  plannedReps: string;
}

const ALIASES: Record<string, string> = {
  db: "dumbbell",
  dumbbells: "dumbbell",
  bb: "barbell",
  barbells: "barbell",
  kb: "kettlebell",
  kettlebells: "kettlebell",
  bw: "bodyweight",
  flys: "fly",
  flies: "fly",
  flyes: "fly",
  pec: "chest",
  pecs: "chest",
  pectoral: "chest",
  pectorals: "chest",
  delt: "shoulder",
  delts: "shoulder",
  shoulders: "shoulder",
  lats: "lat",
  abdominals: "abs",
  abdominal: "abs",
  bands: "band",
  biceps: "bicep",
  triceps: "tricep",
  calves: "calf",
  quads: "quad",
  hamstrings: "hamstring",
  glutes: "glute",
  curls: "curl",
  rows: "row",
  presses: "press",
  pullups: "pull up",
  pushups: "push up",
  pulldowns: "pulldown",
  rdl: "romanian deadlift",
  ohp: "overhead press",
};

export function normaliseExerciseSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => ALIASES[word] ?? word)
    .join(" ");
}

/** One insertion/deletion/substitution or adjacent transposition, only for longer words. */
function nearWord(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
    );
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** All query words must match. Exact phrases rank before aliases and conservative typo matches. */
export function exerciseSearchScore(query: string, name: string, metadata = ""): number {
  const needle = normaliseExerciseSearch(query).slice(0, 120);
  if (!needle) return 1;
  const title = normaliseExerciseSearch(name);
  if (title === needle) return 1000;
  if (title.includes(needle)) return 800;
  const names = title.split(" ");
  const words = [...names, ...normaliseExerciseSearch(metadata).split(" ")];
  let score = 0;
  for (const token of needle.split(" ")) {
    if (names.some((word) => word.startsWith(token))) score += 80;
    else if (words.some((word) => word.startsWith(token))) score += 40;
    else if (words.some((word) => nearWord(token, word))) score += 10;
    else return 0;
  }
  return score;
}

function localEquipment(exercise: Exercise): string {
  if (exercise.equipmentLabel) return exercise.equipmentLabel;
  const text = `${exercise.name} ${exercise.instruction}`.toLowerCase();
  // Specific equipment comes before the broad access category (which may include bodyweight).
  for (const [pattern, label] of [
    [/dumbbell|\bdb\b/, "DUMBBELL"],
    [/kettlebell/, "KETTLEBELL"],
    [/cable|pulldown/, "CABLE"],
    [/machine|leg press|leg extension|leg curl/, "MACHINE"],
    [/barbell|bench press|deadlift|back squat/, "BARBELL"],
    [/\bband/, "BANDS"],
  ] as const)
    if (pattern.test(text)) return label;
  return exercise.equipment.includes("BODYWEIGHT") ? "BODYWEIGHT" : "OTHER";
}

export function buildExerciseFinderCatalogue(
  saved: Exercise[],
  remote: LibraryExercise[],
): FinderExercise[] {
  const result: FinderExercise[] = [];
  const ids = new Set<string>();
  const identities = new Set<string>();
  const add = (entry: FinderExercise) => {
    const identity = `${normaliseExerciseSearch(entry.name)}:${normaliseExerciseSearch(entry.equipment)}`;
    if (ids.has(entry.id) || identities.has(identity)) return;
    ids.add(entry.id);
    identities.add(identity);
    result.push(entry);
  };
  const savedIds = new Set(saved.map((exercise) => exercise.id));
  // Saved records retain their IDs, prescriptions and measurement mode; never rewrite history.
  for (const exercise of [...saved, ...allExercises()]) {
    const group = exercise.muscleGroup;
    add({
      id: exercise.id,
      slug: exercise.id,
      name: exercise.name,
      category:
        group === "BACK" ? "PULL" : group === "CHEST" || group === "SHOULDERS" ? "PUSH" : group,
      primary_muscles: exercise.primaryMuscles?.length ? exercise.primaryMuscles : [group],
      secondary_muscles: exercise.secondaryMuscles ?? [],
      equipment: localEquipment(exercise),
      difficulty: exercise.skill === "BEGINNER" ? 2 : exercise.skill === "ADVANCED" ? 5 : 3,
      instructions: exercise.instruction,
      pro_tip: exercise.proTip ?? "",
      youtube_query: exercise.youtubeQuery || `${exercise.name} exercise form`,
      warmup_note: "",
      stretch_note: "",
      is_compound: exercise.isCompound ?? false,
      muscleGroup: group,
      source: savedIds.has(exercise.id) ? "SAVED" : "BUILT_IN",
      plannedSets: exercise.sets,
      plannedReps: exercise.reps,
    });
  }
  for (const exercise of remote) {
    const converted = libraryExerciseToExercise(exercise);
    add({
      ...exercise,
      muscleGroup: converted.muscleGroup,
      source: "CATALOGUE",
      plannedSets: converted.sets,
      plannedReps: converted.reps,
    });
  }
  return result;
}

export interface FinderFilters {
  query: string;
  muscle: string;
  equipment: string;
  beginner: boolean;
  collection: "ALL" | "SAVED" | "PLANNED";
}

/** Build membership once, not one generated schedule per catalogue result. */
export function plannedFinderIds(state: AppState, catalogue: FinderExercise[]): Set<string> {
  const active = state.programs.find((program) => program.id === state.activeProgramId);
  const ids = new Set<string>();
  const names = new Set<string>();
  if (active) {
    for (const day of Object.values(active.days))
      for (const item of day.items) {
        ids.add(item.id);
        names.add(normalisedPlanExerciseName(item.name));
      }
  } else {
    const schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
    for (const day of Object.values(schedule ?? {}))
      for (const id of day.exerciseIds) {
        ids.add(id);
        const exercise = getExercise(id, state.savedExercises);
        if (exercise) names.add(normalisedPlanExerciseName(exercise.name));
      }
  }
  return new Set(
    catalogue
      .filter(
        (exercise) => ids.has(exercise.id) || names.has(normalisedPlanExerciseName(exercise.name)),
      )
      .map((exercise) => exercise.id),
  );
}

export function findExercises(
  catalogue: FinderExercise[],
  filters: FinderFilters,
  plannedIds: ReadonlySet<string> = new Set(),
): FinderExercise[] {
  return catalogue
    .filter(
      (exercise) =>
        (filters.muscle === "ALL" || exercise.muscleGroup === filters.muscle) &&
        (filters.equipment === "ALL" ||
          normaliseExerciseSearch(exercise.equipment) ===
            normaliseExerciseSearch(filters.equipment)) &&
        (!filters.beginner || exercise.difficulty <= 2) &&
        (filters.collection !== "SAVED" || exercise.source === "SAVED") &&
        (filters.collection !== "PLANNED" || plannedIds.has(exercise.id)),
    )
    .map((exercise) => ({
      exercise,
      score: exerciseSearchScore(
        filters.query,
        exercise.name,
        [
          exercise.muscleGroup,
          exercise.equipment,
          ...exercise.primary_muscles,
          ...exercise.secondary_muscles,
        ].join(" "),
      ),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.exercise.name.localeCompare(b.exercise.name) ||
        a.exercise.id.localeCompare(b.exercise.id),
    )
    .map((item) => item.exercise);
}
