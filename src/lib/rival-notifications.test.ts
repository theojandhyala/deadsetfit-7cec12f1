import { describe, expect, it } from "vitest";

import { buildRivalAlertDrafts } from "./rival-notifications";
import type { Duel } from "./social.functions";

const NOW = new Date(2026, 7, 26, 14, 0, 0);
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

function duel(overrides: Partial<Duel> = {}): Duel {
  return {
    id: "d1",
    metric: "volume",
    status: "active",
    role: "challenger",
    needsMyResponse: false,
    start_at: new Date(2026, 7, 20).toISOString(),
    end_at: hoursFromNow(24 * 7),
    ended: false,
    myScore: 10_000,
    theirScore: 10_000,
    winner: null,
    opponent: { id: "u2", username: "marcus", display_name: "Marcus", avatar_url: null },
    ...overrides,
  };
}

const at = (draft: { schedule?: unknown }) => (draft.schedule as { at: Date }).at;

describe("buildRivalAlertDrafts", () => {
  it("says nothing when there are no duels", () => {
    expect(buildRivalAlertDrafts([], {}, NOW)).toEqual([]);
  });

  it("says nothing when the scores are level and nothing is ending", () => {
    expect(buildRivalAlertDrafts([duel()], {}, NOW)).toEqual([]);
  });

  it("nudges when the rival is ahead", () => {
    const [draft] = buildRivalAlertDrafts([duel({ theirScore: 12_400 })], {}, NOW);
    expect(draft!.title).toBe("Marcus is ahead of you");
    expect(draft!.body).toContain("2,400 kg");
  });

  it("puts a deadline first when a duel is nearly over and you are losing", () => {
    const drafts = buildRivalAlertDrafts(
      [
        duel({ id: "far", theirScore: 20_000 }),
        duel({ id: "soon", theirScore: 11_000, end_at: hoursFromNow(30) }),
      ],
      {},
      NOW,
    );
    expect(drafts[0]!.title).toContain("h left against Marcus");
  });

  it("never schedules a warning after the duel it warns about has ended", () => {
    const [draft] = buildRivalAlertDrafts(
      [duel({ theirScore: 11_000, end_at: hoursFromNow(6) })],
      {},
      NOW,
    );
    expect(at(draft!).getTime()).toBeLessThan(NOW.getTime() + 6 * 3_600_000);
    expect(at(draft!).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("ignores a duel whose deadline has already passed", () => {
    expect(
      buildRivalAlertDrafts([duel({ theirScore: 99_000, end_at: hoursFromNow(-1) })], {}, NOW),
    ).toEqual([]);
  });

  it("chases an unanswered challenge", () => {
    const [draft] = buildRivalAlertDrafts(
      [duel({ status: "pending", needsMyResponse: true })],
      {},
      NOW,
    );
    expect(draft!.title).toBe("Marcus challenged you");
  });

  it("ignores a pending duel that is waiting on the other person", () => {
    expect(
      buildRivalAlertDrafts([duel({ status: "pending", needsMyResponse: false })], {}, NOW),
    ).toEqual([]);
  });

  it("warns when a comfortable lead has become a narrow one", () => {
    const [draft] = buildRivalAlertDrafts([duel({ myScore: 10_000, theirScore: 9_500 })], {}, NOW);
    expect(draft!.title).toBe("Marcus is closing in");
  });

  it("stays quiet about a lead that is not under threat", () => {
    expect(buildRivalAlertDrafts([duel({ myScore: 10_000, theirScore: 2_000 })], {}, NOW)).toEqual(
      [],
    );
  });

  it("ignores finished and declined duels", () => {
    for (const dead of [
      duel({ ended: true, theirScore: 99_000 }),
      duel({ status: "completed", theirScore: 99_000 }),
      duel({ status: "declined", theirScore: 99_000 }),
    ]) {
      expect(buildRivalAlertDrafts([dead], {}, NOW)).toEqual([]);
    }
  });

  it("writes each metric in its own units", () => {
    const sessions = buildRivalAlertDrafts(
      [duel({ metric: "sessions", myScore: 2, theirScore: 3 })],
      {},
      NOW,
    );
    expect(sessions[0]!.body).toContain("1 session");
    const prs = buildRivalAlertDrafts(
      [duel({ metric: "prs", myScore: 0, theirScore: 2 })],
      {},
      NOW,
    );
    expect(prs[0]!.body).toContain("2 PRs");
  });

  it("falls back to a username, then to a neutral name", () => {
    const noName = buildRivalAlertDrafts(
      [
        duel({
          theirScore: 11_000,
          opponent: { id: "u", username: "kez", display_name: null, avatar_url: null },
        }),
      ],
      {},
      NOW,
    );
    expect(noName[0]!.title).toContain("@kez");

    const anonymous = buildRivalAlertDrafts(
      [
        duel({
          theirScore: 11_000,
          opponent: { id: "u", username: null, display_name: null, avatar_url: null },
        }),
      ],
      {},
      NOW,
    );
    expect(anonymous[0]!.title).toContain("Your rival");
  });

  it("caps how many nudges one person can receive", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      duel({ id: `d${i}`, theirScore: 20_000 + i }),
    );
    expect(buildRivalAlertDrafts(many, {}, NOW).length).toBeLessThanOrEqual(4);
  });

  it("gives every nudge a distinct id so none overwrites another", () => {
    const many = Array.from({ length: 6 }, (_, i) => duel({ id: `d${i}`, theirScore: 20_000 }));
    const drafts = buildRivalAlertDrafts(many, {}, NOW);
    expect(new Set(drafts.map((d) => d.id)).size).toBe(drafts.length);
  });

  it("goes silent when the athlete turns it off", () => {
    expect(
      buildRivalAlertDrafts([duel({ theirScore: 99_000 })], { rivalAlertsEnabled: false }, NOW),
    ).toEqual([]);
  });

  it("lands a tap on the duels screen", () => {
    const drafts = buildRivalAlertDrafts([duel({ theirScore: 11_000 })], {}, NOW);
    expect(drafts.every((d) => d.extra?.path === "/challenges")).toBe(true);
  });
});
