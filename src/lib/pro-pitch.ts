import { calculateStreak } from "./calc";
import { GRADED_MUSCLES } from "./strength-grades";
import type { AppState } from "./types";
import { formatVolume, unitOf } from "./units";

/**
 * What to say to this athlete about Pro, right now.
 *
 * The banner used to say the same sentence to everybody — "Training Autopilot,
 * Streak Armor, head-to-head challenges and deep analytics" — which is a
 * feature list in a private vocabulary. It means nothing on day one and
 * nothing on day two hundred.
 *
 * Every pitch here is built from a number the athlete already earned. "You
 * have logged 23 sessions" is theirs; "deep analytics" is ours. The first is
 * evidence that the thing being sold has something to work with, and it is the
 * difference between an advert and a reason.
 *
 * Rule-based and computed on-device, like everything else that decides what a
 * person is told: no model, no per-user cost.
 */

export interface ProPitch {
  /** Stable id, so a dismissal can be remembered per pitch rather than forever. */
  id: string;
  eyebrow: string;
  headline: string;
  /** What Pro does with the number in the headline. */
  detail: string;
}

/** Facts the pitches are chosen from. Extracted once so ordering stays cheap. */
interface PitchFacts {
  streak: number;
  sessions: number;
  prs: number;
  gradedMuscles: number;
  totalVolumeKg: number;
  checkIns: number;
}

function facts(state: AppState): PitchFacts {
  const finished = state.sessions.filter((session) => session.endedAt);
  // Sessions record the muscles a movement works, not a single group, so a
  // compound counts toward each area it actually trained.
  const graded = new Set<string>();
  for (const session of finished) {
    for (const exercise of session.exercises ?? []) {
      for (const muscle of exercise.primary_muscles ?? []) {
        const upper = muscle.toUpperCase();
        if ((GRADED_MUSCLES as readonly string[]).includes(upper)) graded.add(upper);
      }
    }
  }
  return {
    streak: calculateStreak(state.completedDates),
    sessions: finished.length,
    prs: finished.reduce((total, session) => total + (session.prCount || 0), 0),
    gradedMuscles: graded.size,
    totalVolumeKg: finished.reduce((total, session) => total + (session.totalVolume || 0), 0),
    checkIns: (state.checkIns ?? []).length,
  };
}

/**
 * The strongest pitch this athlete's own data supports.
 *
 * Ordered by how much the number proves. A fourteen-day streak is a stronger
 * reason to protect a streak than a two-day one, so it is checked first; the
 * generic pitch is last and only reached by somebody with no history at all,
 * where there is genuinely nothing personal to say yet.
 */
export function proPitch(state: AppState): ProPitch {
  const f = facts(state);
  const unit = unitOf(state);

  if (f.streak >= 5) {
    return {
      id: "streak",
      eyebrow: "YOUR STREAK",
      headline: `${f.streak} days without missing`,
      detail: "Streak Armor covers the one day life gets in the way, so this does not reset.",
    };
  }

  if (f.gradedMuscles > 0 && f.gradedMuscles < GRADED_MUSCLES.length) {
    const missing = GRADED_MUSCLES.length - f.gradedMuscles;
    return {
      id: "strength-map",
      eyebrow: "YOUR STRENGTH MAP",
      headline: `${f.gradedMuscles} of ${GRADED_MUSCLES.length} muscles graded`,
      detail: `Pro grades every lift behind the other ${missing}, and shows which one is holding you back.`,
    };
  }

  if (f.prs >= 3) {
    return {
      id: "records",
      eyebrow: "YOUR RECORDS",
      headline: `${f.prs} personal records`,
      detail: "Pro projects the date the next one lands, and flags a lift before it stalls.",
    };
  }

  if (f.sessions >= 8) {
    return {
      id: "sessions",
      eyebrow: "YOUR HISTORY",
      headline: `${f.sessions} sessions logged`,
      detail: "Pro turns them into a weekly review: what moved, what stalled, what to change.",
    };
  }

  if (f.totalVolumeKg >= 20_000) {
    return {
      id: "tonnage",
      eyebrow: "YOUR TONNAGE",
      headline: `${formatVolume(f.totalVolumeKg, unit)} moved`,
      detail: "Pro breaks it down by muscle and week, so you can see where the work actually went.",
    };
  }

  if (f.checkIns >= 2) {
    return {
      id: "photos",
      eyebrow: "YOUR PROGRESS",
      headline: `${f.checkIns} check-ins banked`,
      detail: "Pro tracks the change against your logged lifts, not just the calendar.",
    };
  }

  return {
    id: "start",
    eyebrow: "DEADSET PRO",
    headline: "Every lift, graded",
    detail:
      "The full Strength Map, a weekly review of what actually moved, and records projected before you hit them.",
  };
}
