import { describe, expect, it } from "vitest";

import { athleteSearchRank, normalizeAthleteSearchQuery } from "./athlete-search";

describe("normalizeAthleteSearchQuery", () => {
  it("accepts the advertised @username syntax without deleting underscores", () => {
    expect(normalizeAthleteSearchQuery("  @qa_beta_lifter  ")).toBe("qa_beta_lifter");
  });

  it("removes ILIKE percent wildcards and control characters", () => {
    expect(normalizeAthleteSearchQuery("@be%nch\npress")).toBe("benchpress");
  });

  it("collapses display-name whitespace and caps the server query", () => {
    expect(normalizeAthleteSearchQuery("  Theo    Jandhyala ")).toBe("Theo Jandhyala");
    expect(normalizeAthleteSearchQuery("a".repeat(50))).toHaveLength(40);
  });
});

describe("athleteSearchRank", () => {
  it("puts an exact username ahead of partial and display-name matches", () => {
    const exact = athleteSearchRank({ username: "theo", display_name: "Other" }, "THEO");
    const prefix = athleteSearchRank({ username: "theolifts", display_name: "Other" }, "theo");
    const display = athleteSearchRank({ username: "athlete", display_name: "Theo" }, "theo");
    expect(exact).toBeLessThan(prefix);
    expect(prefix).toBeLessThan(display);
  });
});
