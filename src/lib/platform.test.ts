import { afterEach, describe, expect, it, vi } from "vitest";

import { getRuntimePlatform, isNativeApp, isNativeIos } from "./platform";

function setCapacitorBridge(platform: string, native: boolean) {
  vi.stubGlobal("window", {
    Capacitor: {
      getPlatform: () => platform,
      isNativePlatform: () => native,
    },
  });
}

describe("runtime platform detection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats an installed iOS shell as native iOS", () => {
    setCapacitorBridge("ios", true);

    expect(getRuntimePlatform()).toBe("ios");
    expect(isNativeApp()).toBe(true);
    expect(isNativeIos()).toBe(true);
  });

  it("does not mistake an iOS-looking web runtime for the installed app", () => {
    setCapacitorBridge("ios", false);

    expect(getRuntimePlatform()).toBe("ios");
    expect(isNativeApp()).toBe(false);
    expect(isNativeIos()).toBe(false);
  });

  it("recognises future Android shells without labelling them iOS", () => {
    setCapacitorBridge("android", true);

    expect(getRuntimePlatform()).toBe("android");
    expect(isNativeApp()).toBe(true);
    expect(isNativeIos()).toBe(false);
  });

  it("falls back safely when the Capacitor bridge is absent", () => {
    vi.stubGlobal("window", {});

    expect(getRuntimePlatform()).toBe("web");
    expect(isNativeApp()).toBe(false);
    expect(isNativeIos()).toBe(false);
  });
});
