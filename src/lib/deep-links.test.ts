import { describe, expect, it } from "vitest";

import { APP_SCHEME, deepLinkFor, routeForDeepLink } from "./deep-links";

describe("routeForDeepLink", () => {
  it("routes the Live Activity to the live workout", () => {
    expect(routeForDeepLink(`${APP_SCHEME}://workout-live`)).toBe("/workout/live");
  });

  it("accepts the authority-less shape a custom scheme can arrive in", () => {
    // iOS hands "scheme:///workout-live" through unchanged when a URL is built
    // without an authority; `new URL` then parses an empty host.
    expect(routeForDeepLink(`${APP_SCHEME}:///workout-live`)).toBe("/workout/live");
  });

  it("ignores case in the host", () => {
    expect(routeForDeepLink(`${APP_SCHEME}://Workout-Live`)).toBe("/workout/live");
  });

  it("ignores links belonging to another scheme", () => {
    expect(routeForDeepLink("https://deadsetfit.org/workout-live")).toBeNull();
    expect(routeForDeepLink("otherapp://workout-live")).toBeNull();
  });

  it("does not throw on the malformed URLs the OS can hand over", () => {
    expect(routeForDeepLink("")).toBeNull();
    expect(routeForDeepLink("not a url")).toBeNull();
  });

  it("refuses a host it does not know", () => {
    // A Live Activity can sit on a Lock Screen for weeks after the build that
    // made it. An unknown host must be dropped, never passed to the router.
    expect(routeForDeepLink(`${APP_SCHEME}://admin`)).toBeNull();
    expect(routeForDeepLink(`${APP_SCHEME}://../../etc/passwd`)).toBeNull();
  });

  it("round-trips every link the native side is told to build", () => {
    for (const target of ["workout-live", "strength", "train", "progress"]) {
      expect(routeForDeepLink(deepLinkFor(target))).not.toBeNull();
    }
  });
});
