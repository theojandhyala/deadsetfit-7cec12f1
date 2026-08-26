const WHOP_SCRIPT_URL = "https://t.whop.tw/s.js";
const WHOP_BUSINESS_ID = "biz_icSAzgz1KoiBSY";
const WHOP_SCRIPT_ID = "deadset-whop-pixel";

export const WHOP_CONSENT_KEY = "deadset_whop_consent_v1";

type WhopEventProperties = Record<string, string | number | boolean>;
type WhopQueuedCall = [number, ...unknown[]];

type WhopPixel = {
  q?: WhopQueuedCall[];
  t?: number;
  s?: string[];
  o?: string;
  track: (event: string, properties?: WhopEventProperties) => void;
  setScope: (...scope: string[]) => void;
  scope?: (...scope: string[]) => { track: WhopPixel["track"] };
};

declare global {
  interface Window {
    whop?: WhopPixel;
    __deadsetWhopInitialized?: boolean;
  }
}

export type WhopConsent = "granted" | "denied" | null;

export function getWhopConsent(): WhopConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(WHOP_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setWhopConsent(consent: Exclude<WhopConsent, null>): void {
  try {
    window.localStorage.setItem(WHOP_CONSENT_KEY, consent);
  } catch {
    // A privacy mode can block localStorage. The in-memory choice still applies
    // for this page, but the visitor will be asked again next time.
  }
}

function installWhopQueue(): WhopPixel {
  const queue: WhopQueuedCall[] = [];
  const whop: WhopPixel = {
    q: queue,
    t: Date.now(),
    s: [],
    o: "https://t.whop.tw",
    track(event, properties) {
      const args: unknown[] = [event];
      if (properties) args.push(properties);
      queue.push([Date.now(), ...args]);
    },
    setScope(...scope) {
      whop.s = scope.filter((value) => typeof value === "string");
      queue.push([Date.now(), "setScope", ...whop.s]);
    },
    scope(...scope) {
      return {
        track(event, properties) {
          const args: unknown[] = [event];
          if (properties) args.push(properties);
          queue.push([Date.now(), ...args, { __scope: scope }]);
        },
      };
    },
  };

  window.whop = whop;
  return whop;
}

export function initializeWhopPixel(): void {
  if (typeof window === "undefined" || window.__deadsetWhopInitialized) return;

  const whop = window.whop ?? installWhopQueue();
  whop.setScope(WHOP_BUSINESS_ID);

  if (!document.getElementById(WHOP_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = WHOP_SCRIPT_ID;
    script.async = true;
    script.src = WHOP_SCRIPT_URL;
    document.head.appendChild(script);
  }

  window.__deadsetWhopInitialized = true;
  // This is the page call included in Whop's official installer. It remains
  // consent-gated by WhopConsentBanner and is required before conversion
  // events can be associated with a browser session.
  whop.track("page");
  // Whop's campaign verifier separately requires this initialization event.
  whop.track("pixel");
}

export function trackWhopEvent(event: string, properties?: WhopEventProperties): void {
  if (getWhopConsent() !== "granted") return;
  initializeWhopPixel();
  window.whop?.track(event, properties);
}
