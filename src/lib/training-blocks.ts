import {
  measurePerformanceSet,
  type PerformanceLibrary,
  type PerformanceMetric,
} from "./performance-lab";
import { calendarDaysUntil } from "./weekly-consistency";
import type { AppState } from "./types";

export type BlockDays = 7 | 28 | 84;
export type ChangeKind = "IMPROVED" | "UNCHANGED" | "LOWER" | "NEW" | "PREVIOUS_ONLY";
export interface BlockSummary {
  start: string;
  end: string;
  sessions: number;
  trainingDays: number;
  workingSets: number;
  volumeKg: number;
  holdSeconds: number;
  distanceMeters: number;
  exercises: number;
}
export interface LiftChange {
  exerciseId: string;
  name: string;
  muscle?: string;
  metric: PerformanceMetric;
  previous: number | null;
  current: number | null;
  delta: number | null;
  change: ChangeKind;
  previousDays: number;
  currentDays: number;
}
const DAY = 86_400_000;
const iso = (n: number) => new Date(n).toISOString().slice(0, 10);

export function compareTrainingBlocks(
  state: AppState,
  library: PerformanceLibrary,
  today: string,
  days: BlockDays,
) {
  if (calendarDaysUntil(today, today) !== 0 || ![7, 28, 84].includes(days))
    throw new RangeError("Invalid comparison window");
  const end = Date.parse(today + "T00:00:00Z");
  const empty = (offset: number): BlockSummary => ({
    start: iso(end - (offset + days - 1) * DAY),
    end: iso(end - offset * DAY),
    sessions: 0,
    trainingDays: 0,
    workingSets: 0,
    volumeKg: 0,
    holdSeconds: 0,
    distanceMeters: 0,
    exercises: 0,
  });
  const current = empty(0),
    previous = empty(days);
  const periods = [current, previous];
  const dates = [new Set<string>(), new Set<string>()],
    movements = [new Set<string>(), new Set<string>()];
  const bests = [
    new Map<string, { value: number; dates: Set<string> }>(),
    new Map<string, { value: number; dates: Set<string> }>(),
  ];
  const definitions = new Map(library.map((e) => [e.id, e]));
  const identities = new Map<
    string,
    Pick<LiftChange, "exerciseId" | "name" | "muscle" | "metric">
  >();
  const seen = new Set<string>();
  for (const session of state.sessions) {
    if (!session.endedAt || seen.has(session.id)) continue;
    seen.add(session.id);
    if (typeof session.date !== "string") continue;
    const date = session.date.slice(0, 10),
      age = calendarDaysUntil(date, today);
    if (age === null || age < 0 || age >= days * 2) continue;
    const index = age < days ? 0 : 1,
      summary = periods[index];
    let usable = false;
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        const measurement = measurePerformanceSet(set);
        if (!measurement) continue;
        usable = true;
        summary.workingSets++;
        movements[index].add(exercise.exerciseId);
        if (measurement.metric === "LOAD") summary.volumeKg += set.weight * set.reps;
        if (measurement.metric === "HOLD") summary.holdSeconds += measurement.value;
        if (measurement.metric === "DISTANCE") summary.distanceMeters += measurement.value;
        const key = JSON.stringify([exercise.exerciseId, measurement.metric]);
        identities.set(key, {
          exerciseId: exercise.exerciseId,
          name: definitions.get(exercise.exerciseId)?.name ?? exercise.name,
          muscle: definitions.get(exercise.exerciseId)?.muscleGroup,
          metric: measurement.metric,
        });
        const existing = bests[index].get(key);
        if (existing) {
          existing.value = Math.max(existing.value, measurement.value);
          existing.dates.add(date);
        } else bests[index].set(key, { value: measurement.value, dates: new Set([date]) });
      }
    }
    if (usable) {
      summary.sessions++;
      dates[index].add(date);
    }
  }
  periods.forEach((period, i) => {
    period.trainingDays = dates[i].size;
    period.exercises = movements[i].size;
    period.volumeKg = Math.round(period.volumeKg * 100) / 100;
  });
  const changes: LiftChange[] = [...identities]
    .map(([key, identity]) => {
      const a = bests[0].get(key),
        b = bests[1].get(key);
      const delta = a && b ? a.value - b.value : null;
      const change: ChangeKind = !a
        ? "PREVIOUS_ONLY"
        : !b
          ? "NEW"
          : Math.abs(delta!) < 0.01
            ? "UNCHANGED"
            : delta! > 0
              ? "IMPROVED"
              : "LOWER";
      return {
        ...identity,
        current: a?.value ?? null,
        previous: b?.value ?? null,
        delta,
        change,
        currentDays: a?.dates.size ?? 0,
        previousDays: b?.dates.size ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.metric.localeCompare(b.metric));
  return {
    current,
    previous,
    changes,
    improved: changes.filter((c) => c.change === "IMPROVED").length,
    comparable: changes.filter((c) => c.current !== null && c.previous !== null).length,
  };
}
