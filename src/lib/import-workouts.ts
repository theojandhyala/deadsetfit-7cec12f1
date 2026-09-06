import { allExercises } from "./exercises";
import type { DayKey, Exercise, WorkoutSession, WorkoutSessionExercise } from "./types";

function csvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function firstColumn(headers: string[], candidates: string[]) {
  const keys = new Set(candidates.map(normalized));
  return headers.findIndex((header) => keys.has(normalized(header)));
}

function value(row: string[], index: number) {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

function isoDate(raw: string): string | null {
  const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const uk = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function dayKey(day: string): DayKey {
  return (["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as DayKey[])[
    new Date(`${day}T12:00:00`).getDay()
  ];
}

function stableId(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `csv-${(hash >>> 0).toString(36)}`;
}

function exerciseMatch(name: string, savedExercises: Exercise[]) {
  const key = normalized(name);
  return allExercises(savedExercises).find(
    (exercise) => normalized(exercise.name) === key || normalized(exercise.id) === key,
  );
}

export interface WorkoutImportResult {
  sessions: WorkoutSession[];
  skippedRows: number;
  source: "DEADSET" | "HEVY" | "STRONG" | "GENERIC";
}

/** Parse DEADSET, Hevy, Strong, or a simple date/workout/exercise CSV locally. */
export function parseWorkoutCsv(input: string, savedExercises: Exercise[] = []): WorkoutImportResult {
  const rows = csvRows(input.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("The CSV has no workout rows.");
  const headers = rows[0];
  const dateIndex = firstColumn(headers, ["date", "start_time", "start time"]);
  const workoutIndex = firstColumn(headers, ["workout", "workout name", "title"]);
  const exerciseIndex = firstColumn(headers, ["exercise", "exercise name", "exercise_title"]);
  const repsIndex = firstColumn(headers, ["reps", "repetitions"]);
  const weightIndex = firstColumn(headers, ["weight_kg", "weight kg", "weight", "weight_lb"]);
  const rpeIndex = firstColumn(headers, ["rpe"]);
  const typeIndex = firstColumn(headers, ["set_type", "set type", "type"]);
  if (dateIndex < 0 || exerciseIndex < 0 || repsIndex < 0) {
    throw new Error("CSV needs date, exercise and reps columns.");
  }

  const headerKeys = headers.map(normalized);
  const source: WorkoutImportResult["source"] = headerKeys.includes("exercisetitle")
    ? "HEVY"
    : headerKeys.includes("workoutname") && headerKeys.includes("setorder")
      ? "STRONG"
      : headerKeys.includes("weightkg") && headerKeys.includes("pr")
        ? "DEADSET"
        : "GENERIC";
  const pounds = weightIndex >= 0 && /lb/i.test(headers[weightIndex]);
  const grouped = new Map<string, WorkoutSession>();
  let skippedRows = 0;

  for (const row of rows.slice(1)) {
    const day = isoDate(value(row, dateIndex));
    const exerciseName = value(row, exerciseIndex);
    const reps = Math.floor(Number(value(row, repsIndex)));
    if (!day || !exerciseName || !Number.isFinite(reps) || reps <= 0) {
      skippedRows += 1;
      continue;
    }
    const label = value(row, workoutIndex) || "Imported workout";
    const groupKey = `${day}:${label}`;
    let session = grouped.get(groupKey);
    if (!session) {
      session = {
        id: stableId(groupKey),
        date: day,
        dayKey: dayKey(day),
        label,
        programId: null,
        startedAt: `${day}T12:00:00.000Z`,
        endedAt: `${day}T13:00:00.000Z`,
        exercises: [],
        totalVolume: 0,
        prCount: 0,
      };
      grouped.set(groupKey, session);
    }
    const match = exerciseMatch(exerciseName, savedExercises);
    const exerciseId = match?.id ?? `imported-${stableId(exerciseName).slice(4)}`;
    let exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise) {
      exercise = {
        exerciseId,
        name: match?.name ?? exerciseName,
        primary_muscles: match ? [match.muscleGroup] : [],
        targetSets: 0,
        targetReps: String(reps),
        sets: [],
      } satisfies WorkoutSessionExercise;
      session.exercises.push(exercise);
    }
    const rawWeight = Number(value(row, weightIndex)) || 0;
    const weight = pounds ? Math.round((rawWeight / 2.2046226218) * 4) / 4 : rawWeight;
    const rpe = Number(value(row, rpeIndex));
    const rawType = value(row, typeIndex).toLowerCase();
    const kind = rawType.includes("warm")
      ? ("warmup" as const)
      : rawType.includes("drop")
        ? ("drop" as const)
        : undefined;
    exercise.sets.push({
      weight: Math.max(0, weight),
      reps,
      ...(Number.isFinite(rpe) && rpe >= 1 && rpe <= 10 ? { rpe } : {}),
      ...(kind ? { kind } : {}),
    });
    exercise.targetSets = exercise.sets.filter((set) => !set.kind).length;
    if (!kind) session.totalVolume += Math.max(0, weight) * reps;
  }

  const sessions = [...grouped.values()].filter((session) => session.exercises.length > 0);
  if (!sessions.length) throw new Error("No valid workout sets were found in that CSV.");
  return { sessions, skippedRows, source };
}
