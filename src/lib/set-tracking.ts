import type { CompletedSet, Exercise, WorkoutSession } from "@/lib/types";

/**
 * How a movement is measured. Load × reps is the default, but holds and
 * carries are measured in time, and conditioning in distance. Logging a plank
 * as "45 reps" pollutes the rep history and hands out bogus PRs, so those
 * movements get their own units.
 */
export type TrackingMode = "WEIGHT" | "DURATION" | "DISTANCE";

const DURATION_NAMES =
  /\b(plank|hold|hang|l-?sit|wall ?sit|isometric|farmer|carry|carries|dead ?hang|bird ?dog|superman)\b/i;
// "Row" alone is a back exercise, so rowing only counts as conditioning when
// it names the machine ("rowing", "rower", "row erg"). Same care for "walk"
// and "sled", which appear in lunge and push variations.
const DISTANCE_NAMES =
  /\b(run|running|jog|jogging|sprint|sprints|treadmill|rowing|rower|row ?erg|cycling|bike|airbike|assault ?bike|echo ?bike|ski ?erg|elliptical|stair ?master|swim|swimming)\b/i;
const DURATION_REPS = /(\d+\s*)(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/i;

/**
 * Resolve how one movement should be logged. An explicit `tracking` field on
 * the exercise always wins; otherwise it is inferred from the prescription
 * (the library already writes things like "45-60s") and then the name.
 */
export function trackingModeFor(
  exercise: Pick<Exercise, "name" | "tracking"> | undefined,
  plannedReps?: string,
): TrackingMode {
  if (exercise?.tracking) return exercise.tracking;
  if (plannedReps && DURATION_REPS.test(plannedReps)) return "DURATION";
  const name = exercise?.name ?? "";
  if (DISTANCE_NAMES.test(name)) return "DISTANCE";
  if (DURATION_NAMES.test(name)) return "DURATION";
  return "WEIGHT";
}

/** Seconds implied by a prescription such as "45-60s" or "2 min". Top of range. */
export function parseDurationTarget(reps: string | undefined): number | null {
  if (!reps) return null;
  const match = DURATION_REPS.exec(reps);
  if (!match) return null;
  const unit = match[2]!.toLowerCase();
  const perUnit = unit.startsWith("m") && unit !== "s" ? 60 : 1;
  // "45-60s" should target the top of the range, not the bottom.
  const numbers = reps.match(/\d+/g)?.map(Number) ?? [];
  const value = numbers.length ? Math.max(...numbers) : Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value * perUnit) : null;
}

/** "1:05", "45s", "12:00" — always readable at a glance mid-set. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** Metres under a kilometre, kilometres above it. */
export function formatDistance(meters: number): string {
  const value = Math.max(0, Math.round(meters));
  if (value < 1000) return `${value} m`;
  return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 2)} km`;
}

/** One logged set, written the way its own units read. */
export function formatSet(set: CompletedSet, requiresWeight = true): string {
  if (set.mode === "duration") {
    const time = formatDuration(set.seconds ?? 0);
    return set.weight > 0 ? `${set.weight} kg · ${time}` : time;
  }
  if (set.mode === "distance") {
    const distance = formatDistance(set.meters ?? 0);
    return set.seconds ? `${distance} · ${formatDuration(set.seconds)}` : distance;
  }
  if (set.weight > 0) return `${set.weight} kg × ${set.reps}`;
  return requiresWeight ? `Set weight · ${set.reps} reps` : `${set.reps} reps`;
}

/**
 * Does this set count toward the plan's working sets?
 *
 * Warm-ups obviously do not. Drop sets do not either — they hang off a working
 * set rather than being one. A set taken to failure *is* a working set that
 * happens to carry a marker, so it counts: it is the set you planned, done as
 * hard as it goes.
 */
export function isWorkingSet(set: Pick<CompletedSet, "kind">): boolean {
  return set.kind !== "warmup" && set.kind !== "drop";
}

/**
 * Is this set eligible to set a record?
 *
 * Warm-ups and drop sets are not — neither is a genuine attempt at the load.
 * A set to failure is: benching 100 × 8 to failure when your best was 100 × 7
 * is a record by any honest reading, and refusing it would quietly punish the
 * athletes training hardest.
 */
export function countsForRecords(set: Pick<CompletedSet, "kind">): boolean {
  return set.kind !== "warmup" && set.kind !== "drop";
}

/** Sets that measure time or distance never carry load × reps volume. */
export function setVolume(set: CompletedSet): number {
  if (set.mode || set.kind === "warmup") return 0;
  return set.weight * set.reps;
}

export interface TimedBests {
  /** Longest hold logged, in seconds. */
  seconds: number;
  /** Furthest single set logged, in metres. */
  meters: number;
}

/**
 * Best time-based and distance-based efforts for one movement across finished
 * sessions. Warm-ups and drop sets are excluded, exactly as weight PRs are.
 */
export function timedBestsFor(
  sessions: WorkoutSession[],
  exerciseId: string,
  excludeSessionId?: string,
): TimedBests {
  let seconds = 0;
  let meters = 0;
  for (const session of sessions) {
    if (session.id === excludeSessionId) continue;
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        if (!countsForRecords(set)) continue;
        if (set.mode === "duration") seconds = Math.max(seconds, set.seconds ?? 0);
        if (set.mode === "distance") meters = Math.max(meters, set.meters ?? 0);
      }
    }
  }
  return { seconds, meters };
}

/** A hold or a carry sets a record by lasting longer than any before it. */
export function isTimedPersonalRecord(
  set: Pick<CompletedSet, "mode" | "seconds" | "meters" | "kind">,
  bests: TimedBests,
): boolean {
  if (!countsForRecords(set)) return false;
  if (set.mode === "duration") return (set.seconds ?? 0) > bests.seconds;
  if (set.mode === "distance") return (set.meters ?? 0) > bests.meters;
  return false;
}
