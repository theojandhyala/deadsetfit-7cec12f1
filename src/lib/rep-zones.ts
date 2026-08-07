import type { Goal, WorkoutSession } from "./types";

// Rep-zone mix — where the working sets actually land on the rep spectrum,
// judged against the athlete's stated goal. The Volume Optimizer answers
// "enough sets per muscle?"; this answers "are those sets the right KIND?".

export type RepZone = "STRENGTH" | "BUILD" | "ENDURANCE";

export interface RepZoneMix {
  totalSets: number;
  /** Integer percentages; always sum to 100. */
  pct: Record<RepZone, number>;
  dominant: RepZone;
  targetZone: RepZone;
  aligned: boolean;
  advice: string;
}

const ZONE_LABEL: Record<RepZone, string> = {
  STRENGTH: "1–5 reps",
  BUILD: "6–12 reps",
  ENDURANCE: "13+ reps",
};

function zoneOf(reps: number): RepZone {
  if (reps <= 5) return "STRENGTH";
  if (reps <= 12) return "BUILD";
  return "ENDURANCE";
}

/**
 * Cutting and maintaining still want the 6–12 hypertrophy zone — heavy-enough
 * work is what tells the body to keep muscle in a deficit. Only an explicitly
 * athletic goal shifts the target toward low-rep strength expression.
 */
function targetFor(goal: Goal): RepZone {
  return goal === "ATHLETIC" ? "STRENGTH" : "BUILD";
}

const MIN_SETS = 20;
const DAY_MS = 86_400_000;

export function repZoneMix(
  sessions: WorkoutSession[],
  goal: Goal,
  todayIso: string,
  windowDays = 28,
): RepZoneMix | null {
  const since = new Date(`${todayIso}T00:00:00Z`).getTime() - windowDays * DAY_MS;
  const counts: Record<RepZone, number> = { STRENGTH: 0, BUILD: 0, ENDURANCE: 0 };
  let total = 0;

  for (const s of sessions ?? []) {
    if (!s.endedAt) continue;
    const at = new Date(`${s.date}T00:00:00Z`).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (set.kind === "warmup" || set.reps <= 0) continue;
        counts[zoneOf(set.reps)] += 1;
        total += 1;
      }
    }
  }

  if (total < MIN_SETS) return null;

  const pct: Record<RepZone, number> = {
    STRENGTH: Math.round((counts.STRENGTH / total) * 100),
    BUILD: Math.round((counts.BUILD / total) * 100),
    ENDURANCE: 0,
  };
  pct.ENDURANCE = 100 - pct.STRENGTH - pct.BUILD;

  const dominant = (Object.keys(counts) as RepZone[]).reduce((a, b) =>
    counts[b] > counts[a] ? b : a,
  );
  const targetZone = targetFor(goal);
  const aligned = dominant === targetZone;

  const advice = aligned
    ? `Your set mix is on target for your goal — most work lands in the ${ZONE_LABEL[targetZone]} zone.`
    : `Most of your sets land in the ${ZONE_LABEL[dominant]} zone, but your goal is best served by ${ZONE_LABEL[targetZone]} work — shift a few sets there over the next weeks.`;

  return { totalSets: total, pct, dominant, targetZone, aligned, advice };
}

export const REP_ZONE_LABEL = ZONE_LABEL;
