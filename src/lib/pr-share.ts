import type { PRShareDetails } from "./grit-events";
import { formatWeightValue, type WeightUnit } from "./units";

/** Trim trailing zeros: 100 → "100", 102.5 → "102.5". */
export function fmtLoad(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

export type PRHeadline = {
  /** The hero number on the card — kilos lifted, or reps for bodyweight lifts. */
  value: string;
  /** Unit beneath the hero number. */
  unit: string;
  /** Rep context for loaded lifts; null when the reps *are* the record. */
  repLine: string | null;
  /** The brag, when there was a previous record to beat. */
  delta: string | null;
  /** The record this one broke, for the card's stat strip. */
  previousBest: string | null;
  /** Plain-language line for share sheets and alt text. */
  caption: string;
};

function plural(n: number, word: string) {
  return `${word}${n === 1 ? "" : "S"}`;
}

/**
 * Everything the PR card renders, derived once so the canvas and the share
 * text can never disagree.
 *
 * Bodyweight records are a rep count (pull-ups: 12 reps beats 10); loaded
 * lifts are a load in kilos, with the reps as supporting context. This mirrors
 * `isPersonalRecord`, which awards on load when there is load and on reps
 * otherwise.
 */
export function prHeadline(pr: PRShareDetails, weightUnit: WeightUnit = "kg"): PRHeadline {
  const isBodyweight = !!pr.bodyweight || pr.weight <= 0;
  // Loads are stored in kilograms; the card is the most public thing this app
  // produces, so it shows the athlete's own unit rather than the storage one.
  const show = (kg: number) => (isBodyweight ? fmtLoad(kg) : formatWeightValue(kg, weightUnit));
  const loadUnit = weightUnit.toUpperCase();
  const headlineValue = isBodyweight ? pr.reps : pr.weight;
  const unit = isBodyweight ? plural(pr.reps, "REP") : loadUnit;

  const beaten = pr.previousBest != null && pr.previousBest > 0 ? pr.previousBest : null;
  const rawDelta = beaten != null ? headlineValue - beaten : null;
  // A non-positive delta means the record and the beaten value disagree — show
  // no brag rather than "+0" or a negative one.
  const delta =
    rawDelta != null && rawDelta > 0
      ? `+${show(rawDelta)}${isBodyweight ? " REPS" : loadUnit} ON MY BEST`
      : null;

  return {
    value: show(headlineValue),
    unit,
    previousBest: beaten != null ? `${show(beaten)}${isBodyweight ? "" : loadUnit}` : null,
    repLine: isBodyweight || pr.reps <= 0 ? null : `× ${pr.reps} ${plural(pr.reps, "REP")}`,
    delta,
    caption: isBodyweight
      ? `${pr.reps} reps on ${pr.exercise} — new PR`
      : pr.reps > 0
        ? `${show(pr.weight)}${weightUnit} × ${pr.reps} on ${pr.exercise} — new PR`
        : // Records recalled from the PR wall carry a load but not always reps.
          `${show(pr.weight)}${weightUnit} on ${pr.exercise} — new PR`,
  };
}
