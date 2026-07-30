export type PaywallFeature =
  | "streak-armor"
  | "advanced-analytics"
  | "featured-programs"
  | "custom-programs"
  // "leagues" and "h2h" were removed when duels and the full ladder became free.
  | "reminders"
  | "recovery"
  | "nutrition"
  | "photos"
  | "challenges"
  | "progression"
  | "report";

export type PaywallEvent = {
  id: string;
  feature: PaywallFeature;
};

const EVENT_NAME = "deadset:paywall";

export function openPaywall(feature: PaywallFeature) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PaywallEvent>(EVENT_NAME, {
      detail: { id: crypto.randomUUID(), feature },
    }),
  );
}

export function onPaywall(listener: (event: PaywallEvent) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<PaywallEvent>).detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
