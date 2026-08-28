/**
 * Where a link from outside the app should land.
 *
 * Live Activities, widgets and the Watch all open DEADSET with a URL. Until
 * now nothing in the app read them, so tapping the Dynamic Island mid-workout
 * dropped you wherever you happened to have left the app — which, during a
 * session, is the one moment a person taps it expecting to get back to the set
 * they are on.
 *
 * The scheme is the bundle id, registered in Info.plist as
 * `org.deadsetfit.app`. Hosts are deliberately coarse: a widget that outlives
 * a release must not be able to name a route that no longer exists.
 */

/** The custom scheme registered by the iOS app. */
export const APP_SCHEME = "org.deadsetfit.app";

/**
 * Deep-link targets, by host.
 *
 * Kept as a closed map rather than "use the path as a route" on purpose. A
 * Live Activity is baked into a build that can sit on a Lock Screen for weeks;
 * letting one hand an arbitrary path to the router is how a stale widget takes
 * somebody to a 404 — or somewhere they should not be.
 */
const ROUTES: Record<string, string> = {
  "workout-live": "/workout/live",
  strength: "/strength",
  train: "/train",
  progress: "/progress",
};

/**
 * The in-app path a deep link asks for, or null if it is not one of ours.
 *
 * Returns null rather than throwing: this runs on every URL the OS hands the
 * app, including the OAuth callbacks handled elsewhere, and an unrecognised
 * link is normal rather than exceptional.
 */
export function routeForDeepLink(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // `new URL` keeps the trailing colon on the protocol.
  if (url.protocol !== `${APP_SCHEME}:`) return null;
  // A custom scheme with no authority ("scheme:///path") parses with an empty
  // host and the target in the path instead, so accept either shape.
  const host = url.hostname || url.pathname.replace(/^\/+/, "").split("/")[0] || "";
  return ROUTES[host.toLowerCase()] ?? null;
}

/** The URL a widget or Live Activity should carry to reach a given target. */
export function deepLinkFor(target: keyof typeof ROUTES | string): string {
  return `${APP_SCHEME}://${target}`;
}
