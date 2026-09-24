import { describe, expect, it } from "vitest";
import { keyboardInset } from "./keyboard-layout";

describe("auth keyboard layout", () => {
  it("adds only space hidden by the keyboard", () => {
    expect(keyboardInset(844, 500, 0)).toBe(344);
    expect(keyboardInset(844, 500, 100)).toBe(244);
  });
  it("does not double count an already resized viewport", () => {
    expect(keyboardInset(500, 500, 0)).toBe(0);
  });
  it("ignores browser chrome and pinch zoom", () => {
    expect(keyboardInset(844, 800, 0)).toBe(0);
    expect(keyboardInset(844, 400, 0, 2)).toBe(0);
  });
  it("rejects malformed geometry", () => {
    expect(keyboardInset(844, NaN, 0)).toBe(0);
    expect(keyboardInset(844, 900, 0)).toBe(0);
  });
});
