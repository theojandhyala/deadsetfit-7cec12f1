import { describe, it, expect } from "vitest";

import { INVITE_ALPHABET, generateInviteCode, rankCrews } from "./crews";

describe("generateInviteCode", () => {
  it("is six characters from the unambiguous alphabet", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
    for (const ch of code) expect(INVITE_ALPHABET).toContain(ch);
  });

  it("never emits characters that get misheard", () => {
    for (const ch of "IO01") expect(INVITE_ALPHABET).not.toContain(ch);
  });

  it("maps every byte value into the alphabet", () => {
    const code = generateInviteCode((n) => new Uint8Array(n).fill(255));
    expect(code).toHaveLength(6);
    for (const ch of code) expect(INVITE_ALPHABET).toContain(ch);
  });
});

describe("rankCrews", () => {
  const crews = [
    { id: "a", name: "Iron House", tag: "IRON" },
    { id: "b", name: "Big Gym", tag: "BIG" },
    { id: "c", name: "Ghost Town", tag: "GHOST" },
  ];

  it("ranks on average so a small strong crew beats a big weak one", () => {
    const members = new Map([
      ["a", ["a1", "a2"]],
      ["b", ["b1", "b2", "b3", "b4"]],
    ]);
    const grit = new Map([
      ["a1", 900],
      ["a2", 900],
      ["b1", 100],
      ["b2", 100],
      ["b3", 100],
      ["b4", 100],
    ]);
    const ranked = rankCrews(crews, members, grit);
    expect(ranked.map((c) => c.id)).toEqual(["a", "b"]);
    expect(ranked[0].avgGrit).toBe(900);
    expect(ranked[1].totalGrit).toBe(400);
  });

  it("drops crews with no members", () => {
    const ranked = rankCrews(crews, new Map([["a", ["a1"]]]), new Map([["a1", 10]]));
    expect(ranked.map((c) => c.id)).toEqual(["a"]);
  });

  it("breaks an average tie on total grit", () => {
    const members = new Map([
      ["a", ["a1"]],
      ["b", ["b1", "b2"]],
    ]);
    const grit = new Map([
      ["a1", 500],
      ["b1", 500],
      ["b2", 500],
    ]);
    expect(rankCrews(crews, members, grit).map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("treats a member with no profile as zero rather than crashing", () => {
    const ranked = rankCrews(crews, new Map([["a", ["ghost"]]]), new Map());
    expect(ranked[0].avgGrit).toBe(0);
    expect(ranked[0].members).toBe(1);
  });

  it("honours the limit", () => {
    const members = new Map([
      ["a", ["a1"]],
      ["b", ["b1"]],
    ]);
    const grit = new Map([
      ["a1", 10],
      ["b1", 5],
    ]);
    expect(rankCrews(crews, members, grit, 1).map((c) => c.id)).toEqual(["a"]);
  });
});
