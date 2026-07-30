export type GritAnimationKind = "grit" | "pr" | "rank" | "streak" | "quest";

export type GritAnimationEvent = {
  id: string;
  amount: number;
  label?: string;
  kind: GritAnimationKind;
  rankPoints?: number;
  previousRankLabel?: string;
};

const EVENT_NAME = "deadset:grit-earned";

export function emitGritEarned(
  amount: number,
  label = "GRIT EARNED",
  kind: GritAnimationKind = "grit",
  details?: Pick<GritAnimationEvent, "rankPoints" | "previousRankLabel">,
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
