import { describe, it, expect } from "vitest";

import { CREW_CODE_PATTERN, crewInviteUrl } from "./crew-invite";

describe("CREW_CODE_PATTERN", () => {
  it("accepts a six-character code from the unambiguous alphabet", () => {
    expect(CREW_CODE_PATTERN.test("HJ4K9P")).toBe(true);
  });

  it("rejects the characters that get misheard", () => {
    for (const bad of ["IJKLMN", "OJKLMN", "0JKLMN", "1JKLMN"]) {
      expect(CREW_CODE_PATTERN.test(bad), bad).toBe(false);
    }
  });

  it("rejects the wrong length", () => {
    expect(CREW_CODE_PATTERN.test("HJ4K9")).toBe(false);
    expect(CREW_CODE_PATTERN.test("HJ4K9PQ")).toBe(false);
  });

  it("rejects lowercase, so a captured code is always normalised first", () => {
    expect(CREW_CODE_PATTERN.test("hj4k9p")).toBe(false);
  });
});

describe("crewInviteUrl", () => {
  it("builds a shareable link", () => {
    expect(crewInviteUrl("HJ4K9P")).toBe("https://deadsetfit.org/?crew=HJ4K9P");
  });

  it("uppercases the code", () => {
    expect(crewInviteUrl("hj4k9p")).toBe("https://deadsetfit.org/?crew=HJ4K9P");
  });
});
