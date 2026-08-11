/**
 * Plausibility limits for leaderboard stats.
 *
 * Direct spoofing is already closed: `saveProfile` refuses ranking columns and a
 * database trigger reverts any authenticated write to `grit_points` /
 * `public_stats` (verified against the live project — a PATCH with a real user
 * token returns 204 and changes nothing).
 *
 * The remaining hole is indirect. `saveUserState` derives those values from the
 * state blob the client uploads, and the blob contains manually entered PRs. So
 * nobody can post a grit number, but anyone can type a 500 kg squat and the
 * server will faithfully compute a top-of-table score from it. Since DEADSET's
 * Pro pitch is competition, a leaderboard anybody can type their way to the top
 * of is worse than no leaderboard.
 *
 * The rule here: implausible numbers do not rank. They are not deleted and the
 * lifter is not accused of anything — the entry is marked unverified and kept out
 * of the ranked table, which is honest about the one thing self-reported data can
 * never be.
 */

export type IntegrityFlag =
  | "pr_above_human_ceiling"
  | "pr_implausible_bodyweight_multiple"
  | "pr_jumped_too_fast"
  | "grit_jumped_too_fast"
  | "grit_exceeds_account_age"
  | "streak_exceeds_history";

/** Raw (drug-tested, no-suit) world records, rounded up generously. A lifter
 *  genuinely above these is a world-record holder and can be verified by hand;
 *  everyone else is typing. Values in kg. */
const LIFT_CEILINGS_KG: Record<string, number> = {
  squat: 525,
  bench: 360,
  deadlift: 550,
  ohp: 230,
  press: 230,
  row: 300,
  clean: 250,
  snatch: 200,
  frontsquat: 350,
  hipthrust: 700,
};

/** Even elite lifters sit well under these multiples of bodyweight. Deliberately
 *  loose so that light, strong lifters are never wrongly flagged. */
const BODYWEIGHT_MULTIPLE_CEILINGS: Record<string, number> = {
  squat: 4.5,
  bench: 3.2,
  deadlift: 5.5,
  ohp: 2.2,
  press: 2.2,
};

/** A PR is a hard-won thing. More than this much improvement in one sync is a
 *  typo or a fabrication, not a training result. */
const MAX_PR_JUMP_RATIO = 1.35;
/** Grit is earned per session; this is far above any honest single-sync gain.
 *  Only applied to accounts with an established baseline — a first sync or a
 *  fresh-device restore legitimately arrives with a whole history at once. */
const MAX_GRIT_JUMP = 250;

/** Grit per day the account has existed. Deliberately far above real training
 *  (30 honest sessions ≈ 450 grit, so ~15/day), because this exists to catch a
 *  brand-new account claiming a year of history — not to police keen lifters.
 *  Above roughly a month old it stops binding at all, since grit caps at 1000. */
const MAX_GRIT_PER_ACCOUNT_DAY = 40;

export type TopPR = { id?: string; value?: number; unit?: string };

export type LeaderboardStats = {
  topPRs?: TopPR[];
  streak?: number;
  weightKg?: number;
  [key: string]: unknown;
};

export type IntegrityVerdict = {
  /** Grit that may rank: the new value when plausible, else the previous one. */
  grit: number;
  /** Stats that may rank, with an `integrity` block appended. */
  stats: LeaderboardStats;
  flags: IntegrityFlag[];
  verified: boolean;
};

function liftKey(id: string | undefined): string {
  return (id ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

function ceilingFor(id: string | undefined): number | undefined {
  const key = liftKey(id);
  if (LIFT_CEILINGS_KG[key] !== undefined) return LIFT_CEILINGS_KG[key];
  // Ids like "bench_1rm" or "squatTop" still resolve to their lift.
  const match = Object.keys(LIFT_CEILINGS_KG).find((lift) => key.includes(lift));
  return match ? LIFT_CEILINGS_KG[match] : undefined;
}

function multipleCeilingFor(id: string | undefined): number | undefined {
  const key = liftKey(id);
  const match = Object.keys(BODYWEIGHT_MULTIPLE_CEILINGS).find(
    (lift) => key === lift || key.includes(lift),
  );
  return match ? BODYWEIGHT_MULTIPLE_CEILINGS[match] : undefined;
}

function previousPR(previous: LeaderboardStats | undefined, id: string | undefined): number {
  const match = (previous?.topPRs ?? []).find((pr) => liftKey(pr?.id) === liftKey(id));
  return Number(match?.value ?? 0);
}

/**
 * Judges freshly derived stats against the last accepted ones.
 *
 * `previousStats`/`previousGrit` are what the account already had — the last
 * values that passed this check — so a fabricated jump is measured against
 * honest history rather than against itself.
 */
export function assessLeaderboardStats(options: {
  grit: number;
  stats: LeaderboardStats;
  previousGrit?: number;
  previousStats?: LeaderboardStats;
  completedDates?: string[];
  /** How long the account has existed. A history longer than the account is the
   *  one thing self-reported training data cannot explain away. */
  accountAgeDays?: number;
}): IntegrityVerdict {
  const { grit, stats, previousGrit = 0, previousStats, completedDates, accountAgeDays } = options;
  const flags: IntegrityFlag[] = [];
  const bodyWeight = Number(stats.weightKg ?? previousStats?.weightKg ?? 0);

  for (const pr of stats.topPRs ?? []) {
    const value = Number(pr?.value ?? 0);
    if (!Number.isFinite(value) || value <= 0) continue;

    const ceiling = ceilingFor(pr?.id);
    if (ceiling !== undefined && value > ceiling) {
      flags.push("pr_above_human_ceiling");
      continue;
    }

    const multiple = multipleCeilingFor(pr?.id);
    if (multiple !== undefined && bodyWeight > 0 && value / bodyWeight > multiple) {
      flags.push("pr_implausible_bodyweight_multiple");
      continue;
    }

    // A first-ever PR has nothing to compare against; only growth is rate-limited.
    const before = previousPR(previousStats, pr?.id);
    if (before > 0 && value > before * MAX_PR_JUMP_RATIO) {
      flags.push("pr_jumped_too_fast");
    }
  }

  // Only rate-limit growth for accounts that already have a baseline: a first
  // sync, or a restore onto a new device, legitimately delivers a whole training
  // history in one request and must not be treated as a spike.
  //
  // "Has a baseline" means stats were actually derived before — not merely that a
  // row exists (`public_stats` defaults to `{}`, so a bare presence test would
  // flag every brand-new account's first honest sync). It must ALSO not mean
  // "has PRs": a PR-less account would otherwise be exempt from the grit rate
  // limit forever, and could jump 0 → 1000 in one fabricated-streak sync.
  // (previousGrit alone is NOT a baseline: legacy accounts carried grit_points
  // from before server derivation existed, and their first derived sync is a
  // restore. Any actual prior derivation always wrote overall/streak.)
  const established =
    (previousStats?.topPRs ?? []).some((pr) => Number(pr?.value ?? 0) > 0) ||
    Number(previousStats?.streak ?? 0) > 0 ||
    previousStats?.overall != null;
  if (established && grit > previousGrit + MAX_GRIT_JUMP) flags.push("grit_jumped_too_fast");

  if (accountAgeDays !== undefined) {
    const ceiling = (Math.max(0, accountAgeDays) + 1) * MAX_GRIT_PER_ACCOUNT_DAY;
    if (grit > ceiling) flags.push("grit_exceeds_account_age");
  }

  // A streak cannot exceed the number of days actually logged — nor the age of
  // the account itself (+2 days of timezone slack). Days can only be completed
  // through the app, so a 67-day streak on a 31-day-old account is fabricated
  // even on a first sync, where the jump rate-limit doesn't apply.
  const streak = Number(stats.streak ?? 0);
  if (completedDates && streak > completedDates.length) flags.push("streak_exceeds_history");
  if (accountAgeDays !== undefined && streak > Math.max(0, accountAgeDays) + 2) {
    flags.push("streak_exceeds_history");
  }

  const unique = [...new Set(flags)];
  const verified = unique.length === 0;

  return {
    // A flagged sync holds the previous standing rather than taking the lower of
    // the two: refusing the inflated number is the point, but an honest lifter
    // caught by a false positive should not also lose grit they already earned.
    grit: verified ? grit : previousGrit,
    // Stats are still stored when unverified — the lifter keeps seeing their own
    // numbers — they simply do not rank.
    stats: { ...stats, integrity: { verified, flags: unique } },
    flags: unique,
    verified,
  };
}

/** True when an entry may appear in a ranked table. Entries saved before this
 *  check existed have no integrity block and are trusted, so introducing it
 *  cannot silently empty the leaderboard. */
export function rankable(stats: unknown): boolean {
  const integrity = (stats as { integrity?: { verified?: boolean } } | null)?.integrity;
  if (!integrity || integrity.verified === undefined) return true;
  return integrity.verified === true;
}
