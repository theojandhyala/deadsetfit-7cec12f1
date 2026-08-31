import { TIERS, type StrengthTier } from "./strength-grades";

/**
 * Who is worth following, and why.
 *
 * Suggestions were the top thirty accounts by grit points, sliced to ten. That
 * is the same handful of names shown to everybody, forever, and it compounds:
 * the biggest accounts get suggested, gain followers, gain grit, and stay on
 * top. An athlete with an Elite bench and three weeks in the app never
 * surfaces, because grit rewards time served rather than anything anyone would
 * actually want to watch.
 *
 * This ranks on what makes somebody worth following in a strength app — a
 * standout lift, a streak nobody else is holding, real recent training — and
 * every suggestion carries the reason it was picked. "Elite chest" is a reason
 * to tap; a name and a number is not.
 *
 * Pure and deterministic, so the ordering can be tested rather than eyeballed
 * against live data.
 */

export type DiscoveryReasonKind = "strength" | "streak" | "active" | "records" | "rising";

export interface DiscoveryCandidate {
  id: string;
  username?: string | null;
  gritPoints?: number | null;
  /** Days trained consecutively, from public stats. */
  streak?: number | null;
  /** Sessions logged in the trailing week, from public stats. */
  sessionsThisWeek?: number | null;
  totalWorkouts?: number | null;
  totalPRs?: number | null;
  /** Best graded muscle, if any is graded at all. */
  best?: { muscle: string; tier: StrengthTier } | null;
}

export interface DiscoveryReason {
  kind: DiscoveryReasonKind;
  /** Short label shown on the row: "Elite chest", "31-day streak". */
  label: string;
}

export interface RankedAthlete {
  id: string;
  score: number;
  reason: DiscoveryReason;
}

/** Position on the strength ladder; -1 when unrecognised. */
function tierRank(tier: string | null | undefined): number {
  return tier ? TIERS.indexOf(tier as StrengthTier) : -1;
}

const titleCase = (muscle: string) => muscle.charAt(0) + muscle.slice(1).toLowerCase();
const tierName = (tier: StrengthTier) => tier.replace("_", " ").toLowerCase();

/**
 * The single strongest claim this athlete has on somebody's attention.
 *
 * Ordered by how much it would make a stranger stop. An Intermediate grade is
 * deliberately not a reason — most people are Intermediate, so surfacing it
 * says nothing and makes the list feel padded.
 */
export function reasonFor(candidate: DiscoveryCandidate): DiscoveryReason | null {
  const best = candidate.best;
  const rank = tierRank(best?.tier);
  // Advanced and up. Below that it is not a standout.
  if (best && rank >= TIERS.indexOf("ADVANCED")) {
    return { kind: "strength", label: `${tierName(best.tier)} ${titleCase(best.muscle)}` };
  }

  const streak = candidate.streak ?? 0;
  if (streak >= 14) {
    return { kind: "streak", label: `${streak}-day streak` };
  }

  const weekly = candidate.sessionsThisWeek ?? 0;
  if (weekly >= 4) {
    return { kind: "active", label: `${weekly} sessions this week` };
  }

  const prs = candidate.totalPRs ?? 0;
  if (prs >= 10) {
    return { kind: "records", label: `${prs} personal records` };
  }

  // Somebody training consistently without a headline yet. Worth showing,
  // because a list of only elite athletes is discouraging to a beginner.
  if ((candidate.totalWorkouts ?? 0) >= 4 && streak >= 3) {
    return { kind: "rising", label: "Training consistently" };
  }

  return null;
}

const KIND_WEIGHT: Record<DiscoveryReasonKind, number> = {
  strength: 100,
  streak: 70,
  active: 55,
  records: 45,
  rising: 25,
};

/** How strongly this athlete earns a place, given the reason they earned it. */
function scoreFor(candidate: DiscoveryCandidate, reason: DiscoveryReason): number {
  const base = KIND_WEIGHT[reason.kind];
  switch (reason.kind) {
    case "strength":
      return base + tierRank(candidate.best?.tier) * 6;
    case "streak":
      return base + Math.min(30, (candidate.streak ?? 0) / 2);
    case "active":
      return base + Math.min(20, (candidate.sessionsThisWeek ?? 0) * 3);
    case "records":
      return base + Math.min(20, (candidate.totalPRs ?? 0) / 2);
    default:
      return base;
  }
}

/**
 * Rank candidates, and do not let one kind of reason fill the list.
 *
 * Without the cap, every slot goes to strength — it outscores everything else
 * by design — and the result is ten Elite athletes, which is both boring and
 * discouraging for the beginner it is shown to. Capping each reason means the
 * list has a strong lifter, somebody on a long streak, and somebody just
 * putting the work in.
 *
 * `perReasonCap` is a soft cap: it yields to `limit`. On a small or young
 * server there may not be enough variety to fill the list within it, and three
 * good suggestions padded with nothing is worse than eight where five happen
 * to be strong lifters.
 */
export function rankAthletes(
  candidates: DiscoveryCandidate[],
  limit = 10,
  perReasonCap = 4,
): RankedAthlete[] {
  const scored: RankedAthlete[] = [];
  for (const candidate of candidates) {
    const reason = reasonFor(candidate);
    if (!reason) continue;
    scored.push({ id: candidate.id, score: scoreFor(candidate, reason), reason });
  }

  // Ties broken by id so the order is stable across calls rather than
  // depending on however the database happened to return the rows.
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const used: Partial<Record<DiscoveryReasonKind, number>> = {};
  const picked: RankedAthlete[] = [];
  for (const entry of scored) {
    const count = used[entry.reason.kind] ?? 0;
    if (count >= perReasonCap) continue;
    used[entry.reason.kind] = count + 1;
    picked.push(entry);
    if (picked.length >= limit) break;
  }

  // If the caps left the list short, backfill in pure score order rather than
  // returning three suggestions on a small server.
  if (picked.length < limit) {
    const taken = new Set(picked.map((entry) => entry.id));
    for (const entry of scored) {
      if (taken.has(entry.id)) continue;
      picked.push(entry);
      if (picked.length >= limit) break;
    }
  }

  return picked;
}
