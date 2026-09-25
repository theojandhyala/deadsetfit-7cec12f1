import { describe, expect, it } from "vitest";
import {
  activityPage,
  activityQuery,
  activitySummary,
  safeActivityImage,
  type ActivityPost,
} from "./profile-activity";
const id = "00000000-0000-4000-8000-000000000001";
describe("profile activity", () => {
  it("requires a valid athlete and validates both cursor fields", () => {
    expect(activityQuery.safeParse({ userId: id }).success).toBe(true);
    expect(activityQuery.safeParse({ userId: "bad" }).success).toBe(false);
    expect(
      activityQuery.safeParse({ userId: id, before: { id, createdAt: "2026-09-25T10:00:00Z" } })
        .success,
    ).toBe(true);
    expect(
      activityQuery.safeParse({ userId: id, before: { id, createdAt: "bad,or(query)" } }).success,
    ).toBe(false);
    expect(
      activityQuery.safeParse({ userId: id, before: { createdAt: "2026-09-25T10:00:00Z" } })
        .success,
    ).toBe(false);
  });
  it("uses the last visible row as cursor and doesn't drop the lookahead row", () => {
    const rows: ActivityPost[] = Array.from({ length: 13 }, (_, n) => ({
      id: String(n),
      user_id: id,
      content: "",
      kind: "text",
      metadata: {},
      image_url: null,
      created_at: "2026-09-25T10:00:00Z",
    }));
    expect(activityPage(rows).posts).toHaveLength(12);
    expect(activityPage(rows).next?.id).toBe("11");
    expect(activityPage(rows.slice(0, 12)).next).toBeNull();
    expect(activityPage([])).toEqual({ posts: [], next: null });
  });
  it("formats shared records without presenting them as verified lifting results", () => {
    expect(
      activitySummary({ kind: "pr", metadata: { lift: "Bench", weight: 80, reps: 5 } }),
    ).toEqual({ title: "Bench", detail: "80 kg × 5", label: "Shared PR" });
  });
  it("handles malformed and nonfinite metadata", () => {
    for (const metadata of [
      null,
      [],
      "bad",
      { lift: {}, weight: 100 },
      { lift: "Bench", weight: Infinity },
      { lift: "Bench", weight: -1 },
    ])
      expect(activitySummary({ kind: "pr", metadata }).detail).toBe("");
    expect(
      activitySummary({ kind: "pr", metadata: { lift: "Bench", weight: 80, reps: -1 } }).detail,
    ).toBe("80 kg");
  });
  it("has fallbacks for all post kinds", () => {
    for (const kind of ["text", "workout", "progress", "unknown"])
      expect(activitySummary({ kind, metadata: {} }).title).toBeTruthy();
  });
  it("permits only HTTPS images without credentials", () => {
    expect(safeActivityImage("https://example.com/photo.jpg")).toBe(
      "https://example.com/photo.jpg",
    );
    for (const url of [
      null,
      "bad",
      "javascript:alert(1)",
      "http://example.com/a",
      "https://secret@example.com/a",
      "data:image/svg+xml,abc",
    ])
      expect(safeActivityImage(url)).toBeNull();
  });
});
