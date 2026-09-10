import { estimate1RM } from "./calc";
import { countsForRecords } from "./set-tracking";
import { calendarDaysUntil } from "./weekly-consistency";
import {
  gradeExercise,
  STANDARDS,
  strengthStandardKind,
  type ExerciseGrade,
  type StrengthReport,
} from "./strength-grades";
import type { AppState, CompletedSet, Exercise, MuscleGroup } from "./types";

export type PerformanceMetric = "LOAD" | "REPS" | "HOLD" | "DISTANCE";
export type PerformanceLibrary = Array<
  Pick<Exercise, "id" | "name"> & Partial<Pick<Exercise, "muscleGroup">>
>;
export type EvidenceSource = "WORKOUT" | "LEGACY" | "CHECK_IN";
export interface PerformanceEvidence {
  date: string;
  source: EvidenceSource;
  metric: PerformanceMetric;
  value: number;
  set: CompletedSet;
}
export interface PerformanceRecord {
  metric: PerformanceMetric;
  best: PerformanceEvidence;
  evidence: PerformanceEvidence[];
  /** Best comparable effort on each of the most recent six completed training dates. */
  recent: PerformanceEvidence[];
  delta: number | null;
  trainingDays: number;
}
export interface ExercisePerformance {
  exerciseId: string;
  name: string;
  muscle?: MuscleGroup;
  records: PerformanceRecord[];
}

function validDate(date: string, today: string): string | null {
  if (typeof date !== "string") return null;
  const day = date.slice(0, 10);
  const age = calendarDaysUntil(day, today);
  return age !== null && age >= 0 ? day : null;
}

function measured(set: CompletedSet): { metric: PerformanceMetric; value: number } | null {
  if (!countsForRecords(set)) return null;
  if (!Number.isFinite(set.weight) || set.weight < 0) return null;
  if (set.mode === "duration") {
    return Number.isFinite(set.seconds) && (set.seconds ?? 0) > 0
      ? { metric: "HOLD", value: set.seconds! }
      : null;
  }
  if (set.mode === "distance") {
    return Number.isFinite(set.meters) && (set.meters ?? 0) > 0
      ? { metric: "DISTANCE", value: set.meters! }
      : null;
  }
  if (!Number.isInteger(set.reps) || set.reps <= 0) return null;
  const value = set.weight > 0 ? estimate1RM(set.weight, set.reps) : set.reps;
  return Number.isFinite(value) && value > 0
    ? { metric: set.weight > 0 ? "LOAD" : "REPS", value }
    : null;
}

/** Read-only record book. Never merges exercise IDs, creates sessions, or writes a preview. */
export function buildPerformanceLedger(
  state: AppState,
  library: PerformanceLibrary,
  today: string,
): ExercisePerformance[] {
  const definitions = new Map(library.map((item) => [item.id, item]));
  const evidence = new Map<string, PerformanceEvidence[]>();
  const names = new Map<string, string>();
  const seenSessions = new Set<string>();
  const workoutSignatures = new Set<string>();
  function add(id: string, date: string, set: CompletedSet, source: EvidenceSource) {
    const day = validDate(date, today);
    const measurement = measured(set);
    if (!day || !measurement) return;
    const signature = [
      id,
      day,
      measurement.metric,
      set.weight,
      set.reps,
      set.seconds,
      set.meters,
    ].join("|");
    // Legacy mirroring must not count a workout twice. Real repeated working sets remain visible.
    if (source === "LEGACY" && workoutSignatures.has(signature)) return;
    if (source === "WORKOUT") workoutSignatures.add(signature);
    const bucket = evidence.get(id) ?? [];
    bucket.push({ date: day, set: { ...set }, source, ...measurement });
    evidence.set(id, bucket);
  }
  for (const session of state.sessions) {
    if (!session.endedAt || seenSessions.has(session.id)) continue;
    seenSessions.add(session.id);
    for (const exercise of session.exercises) {
      names.set(exercise.exerciseId, exercise.name);
      for (const set of exercise.sets) add(exercise.exerciseId, session.date, set, "WORKOUT");
    }
  }
  for (const log of state.logs) {
    add(log.exerciseId, log.date, { weight: log.weight, reps: log.reps }, "LEGACY");
  }
  for (const [id, record] of Object.entries(state.manualPRs ?? {})) {
    if (!record || !Number.isFinite(record.value) || record.value <= 0) continue;
    const kind = strengthStandardKind(id, definitions.get(id)?.muscleGroup);
    const set: CompletedSet =
      kind === "SECONDS"
        ? { weight: 0, reps: 0, mode: "duration", seconds: record.value }
        : kind === "REPS"
          ? { weight: 0, reps: record.value }
          : { weight: record.value, reps: record.reps ?? 1 };
    add(id, record.date, set, "CHECK_IN");
  }
  return [...evidence]
    .map(([exerciseId, rows]) => {
      const records: PerformanceRecord[] = [];
      for (const metric of ["LOAD", "REPS", "HOLD", "DISTANCE"] as const) {
        const entries = rows
          .filter((row) => row.metric === metric)
          .sort((a, b) => b.date.localeCompare(a.date));
        if (!entries.length) continue;
        // Prefer a workout over a self-reported reference when tied on value.
        const best = [...entries].sort(
          (a, b) =>
            b.value - a.value ||
            Number(b.source === "WORKOUT") - Number(a.source === "WORKOUT") ||
            b.date.localeCompare(a.date),
        )[0];
        const byDay = new Map<string, PerformanceEvidence>();
        for (const entry of entries.filter((row) => row.source === "WORKOUT")) {
          if (!byDay.has(entry.date) || byDay.get(entry.date)!.value < entry.value)
            byDay.set(entry.date, entry);
        }
        const recent = [...byDay.values()].slice(0, 6);
        records.push({
          metric,
          best,
          evidence: entries,
          recent,
          trainingDays: byDay.size,
          delta: recent.length >= 2 ? recent[0].value - recent[1].value : null,
        });
      }
      return {
        exerciseId,
        name: definitions.get(exerciseId)?.name ?? names.get(exerciseId) ?? exerciseId,
        muscle: definitions.get(exerciseId)?.muscleGroup ?? STANDARDS[exerciseId]?.muscle,
        records,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function recordForGrade(
  exercise: ExercisePerformance | undefined,
  grade: ExerciseGrade,
): PerformanceRecord | undefined {
  const metric: PerformanceMetric =
    grade.kind === "RATIO" ? "LOAD" : grade.kind === "SECONDS" ? "HOLD" : "REPS";
  return exercise?.records.find((record) => record.metric === metric);
}

export function rankRoadmap(report: StrengthReport, muscle?: MuscleGroup): ExerciseGrade[] {
  return report.muscles
    .flatMap((item) => item.exercises)
    .filter((grade) => !muscle || grade.muscle === muscle)
    .sort((a, b) => {
      const gap = (grade: ExerciseGrade) =>
        grade.nextAt === null ? Infinity : Math.max(0, (grade.nextAt - grade.value) / grade.nextAt);
      return gap(a) - gap(b) || a.name.localeCompare(b.name);
    });
}

export function evidenceMatchesGrade(
  record: PerformanceRecord | undefined,
  grade: ExerciseGrade,
): boolean {
  return Boolean(record && Math.abs(record.best.value - grade.value) < 0.11);
}

export function standardDescription(id: string): string {
  return STANDARDS[id]
    ? "DEADSET exercise-specific benchmark"
    : "Approximate muscle-group benchmark";
}

export type PreviewResult =
  | { ok: false; error: string }
  | { ok: true; value: number; grade: ExerciseGrade | null };

/** Deliberately bounded calculator, not a recommendation or saved result. */
export function previewPerformance(args: {
  exerciseId: string;
  name: string;
  muscle?: MuscleGroup;
  metric: PerformanceMetric;
  value: number;
  reps?: number;
  bodyweightKg: number;
  gender?: string | null;
}): PreviewResult {
  const { value, metric, reps = 1 } = args;
  if (!Number.isFinite(value) || value <= 0)
    return { ok: false, error: "Enter a number greater than zero." };
  if (metric === "LOAD" && (!Number.isInteger(reps) || reps < 1 || reps > 12))
    return { ok: false, error: "Use 1–12 whole reps for this estimated-max preview." };
  if (metric === "REPS" && !Number.isInteger(value))
    return { ok: false, error: "Enter a whole number of reps." };
  const measuredValue = metric === "LOAD" ? estimate1RM(value, reps) : value;
  if (!Number.isFinite(measuredValue))
    return { ok: false, error: "That number is too large to preview." };
  const bests = {
    e1rmKg: metric === "LOAD" ? measuredValue : 0,
    reps: metric === "REPS" ? value : 0,
    seconds: metric === "HOLD" ? value : 0,
  };
  const grade =
    metric === "DISTANCE" || args.bodyweightKg <= 0 || !Number.isFinite(args.bodyweightKg)
      ? null
      : gradeExercise(
          args.exerciseId,
          args.name,
          bests,
          args.bodyweightKg,
          args.gender,
          args.muscle,
        );
  return { ok: true, value: measuredValue, grade };
}

/** Accept a decimal point or decimal comma, but never partially parse junk or exponents. */
export function parsePreviewNumber(raw: string): number {
  const text = raw.trim().replace(",", ".");
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
}
