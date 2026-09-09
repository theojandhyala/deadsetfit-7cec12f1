import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AppState } from "./types";
const store = vi.hoisted(() => ({ state: {} as Partial<AppState>, set: vi.fn() }));
vi.mock("./storage", () => ({
  getState: () => store.state,
  setState: (update: (s: Partial<AppState>) => Partial<AppState>) => {
    store.set();
    store.state = update(store.state);
  },
}));
import { captureAttribution } from "./attribution";
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  store.state = { profile: {} as AppState["profile"] };
  store.set.mockClear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal("window", {
    location: {
      href: "https://deadsetfit.com/?utm_source=tiktok&utm_campaign=first&utm_content=post1",
    },
  });
  vi.stubGlobal("document", { referrer: "" });
});
afterEach(() => vi.unstubAllGlobals());
it("preserves first touch while recording a new campaign independently", () => {
  captureAttribution();
  window.location.href = "https://deadsetfit.com/?utm_source=instagram&utm_campaign=second";
  captureAttribution();
  expect(store.state.signupSource?.campaignId).toBe("first");
  expect(store.state.lastMarketingTouch?.campaignId).toBe("second");
  window.location.href = "https://deadsetfit.com/";
  captureAttribution();
  expect(store.state.lastMarketingTouch?.campaignId).toBe("second");
});
it("does not replace a known account source with another device source", () => {
  store.state.signupSource = { source: "youtube", capturedAt: "2026-08-01T00:00:00Z" };
  captureAttribution();
  expect(store.state.signupSource.source).toBe("youtube");
});
it("recovers from corrupt stored attribution and never throws on blocked storage", () => {
  values.set("deadset_attribution_v1", "{broken");
  captureAttribution();
  expect(store.state.signupSource?.source).toBe("tiktok");
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  });
  expect(() => captureAttribution()).not.toThrow();
});
it("holds attribution until a profile exists", () => {
  store.state = {};
  captureAttribution();
  expect(store.set).not.toHaveBeenCalled();
  store.state = { profile: {} as AppState["profile"] };
  captureAttribution();
  expect(store.state.signupSource?.campaignId).toBe("first");
});
