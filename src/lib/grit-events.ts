export type GritAnimationKind = "grit" | "pr" | "rank" | "streak" | "quest";

/** Everything the PR share card needs, captured at the moment the set landed. */
export type PRShareDetails = {
  exercise: string;
  weight: number;
  reps: number;
  /**
   * The record that was just beaten — kilos for loaded lifts, reps for
   * bodyweight ones. Absent when this is the athlete's first record on the
   * movement (there is nothing to beat, so the card shows no delta).
   */
  previousBest?: number;
  /** Bodyweight lift: the record is the rep count, not the load. */
  bodyweight?: boolean;
};

export type GritAnimationEvent = {
  id: string;
  amount: number;
  label?: string;
  kind: GritAnimationKind;
  rankPoints?: number;
  previousRankLabel?: string;
  pr?: PRShareDetails;
};

const EVENT_NAME = "deadset:grit-earned";

export function emitGritEarned(
  amount: number,
  label = "GRIT EARNED",
  kind: GritAnimationKind = "grit",
  details?: Pick<GritAnimationEvent, "rankPoints" | "previousRankLabel" | "pr">,
) {
  if (typeof window === "undefined" || amount <= 0) return;
  window.dispatchEvent(
    new CustomEvent<GritAnimationEvent>(EVENT_NAME, {
      detail: {
        id: crypto.randomUUID(),
        amount: Math.round(amount),
        label,
        kind,
        ...details,
      },
    }),
  );
}

export function onGritEarned(listener: (event: GritAnimationEvent) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<GritAnimationEvent>).detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
