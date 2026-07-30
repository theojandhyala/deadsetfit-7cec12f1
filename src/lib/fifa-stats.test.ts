import { describe, expect, it } from "vitest";
import { buildHeadlinePRs } from "./fifa-stats";
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
