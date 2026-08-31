import { describe, expect, it } from "vitest";

import { rankAthletes, reasonFor, type DiscoveryCandidate } from "./athlete-discovery";

const athlete = (id: string, patch: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  id,
  ...patch,
});

describe("reasonFor", () => {
  it("leads with a standout lift", () => {
    const reason = reasonFor(athlete("a", { best: { muscle: "CHEST", tier: "ELITE" } }));
    expect(reason).toEqual({ kind: "strength", label: "elite Chest" });
  });

  it("does not treat Intermediate as a standout", () => {
    // Most people are Intermediate. Surfacing it says nothing about them and
    // makes the list feel padded.
    const reason = reasonFor(athlete("a", { best: { muscle: "BACK", tier: "INTERMEDIATE" } }));
    expect(reason?.kind).not.toBe("strength");
  });

  it("falls through to a streak worth noticing", () => {
    expect(reasonFor(athlete("a", { streak: 31 }))).toEqual({
      kind: "streak",
      label: "31-day streak",
    });
    // A three-day streak is not a reason to follow a stranger.
    expect(reasonFor(athlete("a", { streak: 3 }))?.kind).not.toBe("streak");
  });

  it("recognises somebody training hard this week", () => {
    expect(reasonFor(athlete("a", { sessionsThisWeek: 5 }))).toEqual({
      kind: "active",
      label: "5 sessions this week",
    });
  });

  it("recognises a record collector", () => {
    expect(reasonFor(athlete("a", { totalPRs: 14 }))?.kind).toBe("records");
  });

  it("keeps a place for somebody just putting the work in", () => {
    // A list of only elite athletes is discouraging to the beginner it is
    // shown to.
    expect(reasonFor(athlete("a", { totalWorkouts: 6, streak: 4 }))).toEqual({
      kind: "rising",
      label: "Training consistently",
    });
  });

  it("has nothing to say about an empty account", () => {
    expect(reasonFor(athlete("a"))).toBeNull();
    expect(reasonFor(athlete("a", { gritPoints: 99_999 }))).toBeNull();
  });
});

describe("rankAthletes", () => {
  it("drops anyone with no reason at all", () => {
    const ranked = rankAthletes([athlete("empty"), athlete("b", { streak: 20 })]);
    expect(ranked.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("puts a stronger lift above a weaker one", () => {
    const ranked = rankAthletes([
      athlete("advanced", { best: { muscle: "LEGS", tier: "ADVANCED" } }),
      athlete("world", { best: { muscle: "LEGS", tier: "WORLD_CLASS" } }),
    ]);
    expect(ranked[0]!.id).toBe("world");
  });

  it("does not let one kind of reason fill the list", () => {
    // Strength outscores everything by design, so without a cap the result is
    // ten Elite athletes — boring, and discouraging to a beginner.
    const strong = Array.from({ length: 10 }, (_, i) =>
      athlete(`s${i}`, { best: { muscle: "CHEST", tier: "ELITE" } }),
    );
    const others = [
      athlete("streaky", { streak: 40 }),
      athlete("busy", { sessionsThisWeek: 6 }),
      athlete("records", { totalPRs: 22 }),
      athlete("rising", { totalWorkouts: 9, streak: 5 }),
    ];
    const ranked = rankAthletes([...strong, ...others], 8, 4);
    const kinds = ranked.map((entry) => entry.reason.kind);
    // Enough variety exists to fill the list inside the cap, so it holds.
    expect(kinds.filter((kind) => kind === "strength")).toHaveLength(4);
    expect(new Set(kinds).size).toBe(5);
  });

  it("breaks the cap rather than returning a short list", () => {
    // The cap is soft. On a small or young server there may not be enough
    // variety to fill the list within it, and three good suggestions padded
    // with nothing is worse than eight where five happen to be strong lifters.
    const strong = Array.from({ length: 10 }, (_, i) =>
      athlete(`s${i}`, { best: { muscle: "CHEST", tier: "ELITE" } }),
    );
    const ranked = rankAthletes([...strong, athlete("streaky", { streak: 40 })], 8, 4);
    expect(ranked).toHaveLength(8);
    expect(ranked.filter((entry) => entry.reason.kind === "strength").length).toBeGreaterThan(4);
  });

  it("backfills rather than returning a short list on a small server", () => {
    const strong = Array.from({ length: 6 }, (_, i) =>
      athlete(`s${i}`, { best: { muscle: "CHEST", tier: "ELITE" } }),
    );
    const ranked = rankAthletes(strong, 6, 2);
    expect(ranked).toHaveLength(6);
  });

  it("never returns the same athlete twice when backfilling", () => {
    const strong = Array.from({ length: 5 }, (_, i) =>
      athlete(`s${i}`, { best: { muscle: "CHEST", tier: "ELITE" } }),
    );
    const ranked = rankAthletes(strong, 5, 1);
    expect(new Set(ranked.map((entry) => entry.id)).size).toBe(ranked.length);
  });

  it("is stable rather than depending on row order", () => {
    const pool = [
      athlete("b", { streak: 20 }),
      athlete("a", { streak: 20 }),
      athlete("c", { streak: 20 }),
    ];
    const first = rankAthletes(pool).map((entry) => entry.id);
    const second = rankAthletes([...pool].reverse()).map((entry) => entry.id);
    expect(first).toEqual(second);
  });

  it("ignores grit entirely", () => {
    // The whole point: time served in the app is not a reason to follow
    // somebody, and ranking on it is what froze the list.
    const ranked = rankAthletes([
      athlete("grinder", { gritPoints: 999_999, totalWorkouts: 2 }),
      athlete("newcomer", { best: { muscle: "ARMS", tier: "ELITE" } }),
    ]);
    expect(ranked[0]!.id).toBe("newcomer");
  });

  it("respects the limit", () => {
    const pool = Array.from({ length: 40 }, (_, i) => athlete(`a${i}`, { streak: 20 + i }));
    expect(rankAthletes(pool, 10)).toHaveLength(10);
  });
});
