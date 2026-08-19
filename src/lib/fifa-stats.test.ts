import { describe, expect, it } from "vitest";
import { buildHeadlinePRs, buildPublicStats } from "./fifa-stats";
import type { AppState } from "./types";

function state(partial: Partial<AppState>): AppState {
  return { logs: [], programs: [], completedDates: [], ...partial } as AppState;
}

function squat(prs: ReturnType<typeof buildHeadlinePRs>) {
  return prs.find((pr) => pr.id === "squat")!;
}

describe("headline PRs distinguish measured from estimated", () => {
  it("marks a multi-rep manual PR as an estimate", () => {
    // 100kg x 5 becomes a 117kg estimated 1RM. The card showed "117" bare while
    // the PR list showed "100kg x 5" — same lift, two numbers, no explanation.
    const prs = buildHeadlinePRs(
      state({ manualPRs: { squat: { value: 100, reps: 5, date: "2026-07-01" } } }),
    );

    expect(squat(prs).value).toBe(117);
    expect(squat(prs).estimated).toBe(true);
  });

  it("does not mark a true single as an estimate", () => {
    const prs = buildHeadlinePRs(
      state({ manualPRs: { squat: { value: 150, reps: 1, date: "2026-07-01" } } }),
    );

    expect(squat(prs).value).toBe(150);
    expect(squat(prs).estimated).toBe(false);
  });

  it("treats a manual PR with no reps recorded as measured", () => {
    const prs = buildHeadlinePRs(
      state({ manualPRs: { squat: { value: 140, date: "2026-07-01" } } }),
    );

    expect(squat(prs).value).toBe(140);
    expect(squat(prs).estimated).toBe(false);
  });

  it("marks a logged multi-rep best set as an estimate", () => {
    const prs = buildHeadlinePRs(
      state({
        logs: [{ exerciseId: "squat", weight: 120, reps: 5, date: "2026-07-02" }] as never,
      }),
    );

    expect(squat(prs).estimated).toBe(true);
    expect(squat(prs).value).toBeGreaterThan(120);
  });

  it("follows whichever source actually won", () => {
    // A measured 200kg single beats the 117kg estimate, so the tile is not an
    // estimate even though an estimated value also exists.
    const prs = buildHeadlinePRs(
      state({
        manualPRs: { squat: { value: 200, reps: 1, date: "2026-07-01" } },
        logs: [{ exerciseId: "squat", weight: 100, reps: 5, date: "2026-07-02" }] as never,
      }),
    );

    expect(squat(prs).value).toBe(200);
    expect(squat(prs).estimated).toBe(false);
  });

  it("reports no estimate when there is no PR at all", () => {
    const prs = buildHeadlinePRs(state({}));

    expect(squat(prs).value).toBe(0);
    expect(squat(prs).estimated).toBe(false);
  });
});

describe("buildPublicStats badges", () => {
  function withSessions(count: number): AppState {
    const sessions = Array.from({ length: count }, (_, i) => ({
      id: `s${i}`,
      date: `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
      dayKey: "MON",
      label: "Push",
      programId: null,
      startedAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T10:00:00`,
      endedAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T11:00:00`,
      totalVolume: 100,
      prCount: 0,
      exercises: [],
    })) as AppState["sessions"];
    return state({ sessions });
  }

  it("publishes a badge summary a card can render", () => {
    const badges = buildPublicStats(withSessions(1)).badges;
    expect(badges?.total).toBeGreaterThanOrEqual(60);
    expect(badges?.earned).toBeGreaterThan(0);
    expect(badges?.top?.[0]).toHaveProperty("icon");
  });

  it("earns nothing on an empty account", () => {
    expect(buildPublicStats(state({})).badges?.earned).toBe(0);
    expect(buildPublicStats(state({})).badges?.top).toEqual([]);
  });

  it("shows at most six badges, rarest first", () => {
    const top = buildPublicStats(withSessions(60)).badges?.top ?? [];
    expect(top.length).toBeLessThanOrEqual(6);
    const rank: Record<string, number> = { LEGENDARY: 4, EPIC: 3, RARE: 2, COMMON: 1 };
    for (let i = 1; i < top.length; i++) {
      expect(rank[top[i - 1].rarity]).toBeGreaterThanOrEqual(rank[top[i].rarity]);
    }
  });
});
