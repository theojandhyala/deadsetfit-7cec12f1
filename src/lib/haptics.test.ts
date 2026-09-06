import { beforeEach, describe, expect, it, vi } from "vitest";

const state: { hapticsEnabled?: boolean } = {};
const impact = vi.fn((_options: { style: string }) => Promise.resolve());
const notification = vi.fn((_options: { type: string }) => Promise.resolve());
const selection = vi.fn(() => Promise.resolve());
const pattern = vi.fn((_options: { steps: Array<{ style: string; delayMs: number }> }) =>
  Promise.resolve(),
);
let native = true;

vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({ impact, notification, selection, pattern }),
}));
vi.mock("./platform", () => ({ isNativeIos: () => native }));
vi.mock("./storage", () => ({ getState: () => state }));

const {
  hapticsEnabled,
  hapticSetLogged,
  hapticSpecialSet,
  hapticPersonalRecord,
  hapticRestOver,
  hapticUndo,
  hapticSelection,
  hapticSetupComplete,
} = await import("./haptics");

beforeEach(() => {
  vi.clearAllMocks();
  delete state.hapticsEnabled;
  native = true;
  vi.stubGlobal("navigator", { vibrate: vi.fn() });
});

describe("the preference", () => {
  it("is on when the athlete has never expressed one", () => {
    expect(hapticsEnabled()).toBe(true);
  });

  it("is off only when explicitly disabled", () => {
    state.hapticsEnabled = false;
    expect(hapticsEnabled()).toBe(false);
    state.hapticsEnabled = true;
    expect(hapticsEnabled()).toBe(true);
  });

  it("silences every haptic when off", () => {
    state.hapticsEnabled = false;
    hapticSetLogged();
    hapticPersonalRecord();
    hapticRestOver();
    hapticSelection();
    expect(impact).not.toHaveBeenCalled();
    expect(pattern).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
    expect(selection).not.toHaveBeenCalled();
  });
});

describe("the vocabulary", () => {
  it("gives a logged set and a warm-up different weights", () => {
    hapticSetLogged();
    hapticSpecialSet();
    expect(impact.mock.calls.map(([options]) => options.style)).toEqual(["medium", "light"]);
  });

  it("makes a PR a sequence, not a single tap", () => {
    hapticPersonalRecord();
    expect(impact).not.toHaveBeenCalled();
    expect(pattern).toHaveBeenCalledTimes(1);
    expect(pattern.mock.calls[0]![0].steps.length).toBeGreaterThan(1);
  });

  it("sends rest-over through the notification engine", () => {
    hapticRestOver();
    expect(notification).toHaveBeenCalledWith({ type: "success" });
  });

  it("confirms a completed setup with a success notification", () => {
    hapticSetupComplete();
    expect(notification).toHaveBeenCalledWith({ type: "success" });
  });

  it("distinguishes undo from logging", () => {
    hapticUndo();
    expect(impact).toHaveBeenCalledWith({ style: "rigid" });
  });
});

describe("off native iOS", () => {
  beforeEach(() => {
    native = false;
  });

  it("never calls the native plugin", () => {
    hapticSetLogged();
    hapticPersonalRecord();
    hapticRestOver();
    expect(impact).not.toHaveBeenCalled();
    expect(pattern).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it("falls back to navigator.vibrate", () => {
    hapticSetLogged();
    expect(navigator.vibrate).toHaveBeenCalled();
  });

  it("survives a browser with no vibrate at all", () => {
    vi.stubGlobal("navigator", {});
    expect(() => hapticSetLogged()).not.toThrow();
  });

  it("survives a browser that throws from vibrate", () => {
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("not allowed");
      },
    });
    expect(() => hapticRestOver()).not.toThrow();
  });
});
