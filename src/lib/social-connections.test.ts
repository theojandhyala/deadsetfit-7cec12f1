import { describe, expect, it } from "vitest";
import {
  connectionPageRows,
  connectionQuery,
  followCommand,
  followLabel,
} from "./social-connections";

const profile = (id: string) => ({
  id,
  username: id,
  display_name: id,
  avatar_url: null,
  bio: null,
});
describe("social connections", () => {
  it("preserves newest-first edge order and ignores duplicate or deleted users", () => {
    expect(
      connectionPageRows(
        ["c", "a", "b", "c", "deleted"],
        [profile("a"), profile("b"), profile("c")],
        "me",
        new Set(),
        new Set(),
        new Set(),
      ).map((r) => r.id),
    ).toEqual(["c", "a", "b"]);
  });
  it("never returns a blocked athlete through a profile join", () => {
    expect(
      connectionPageRows(
        ["a", "b"],
        [profile("a"), profile("b")],
        "me",
        new Set(["b"]),
        new Set(["b"]),
        new Set(["b"]),
      ),
    ).toHaveLength(1);
  });
  it("computes relationships to the viewer, not to the list owner", () => {
    const rows = connectionPageRows(
      ["a", "b", "me"],
      [profile("a"), profile("b"), profile("me")],
      "me",
      new Set(),
      new Set(["a"]),
      new Set(["a", "b"]),
    );
    expect(rows[0]).toMatchObject({ following: true, followsMe: true, isMe: false });
    expect(rows[1]).toMatchObject({ following: false, followsMe: true });
    expect(rows[2].isMe).toBe(true);
  });
  it("labels one-way, mutual and follow-back states honestly", () => {
    expect(followLabel(false, false)).toBe("Follow");
    expect(followLabel(false, true)).toBe("Follow back");
    expect(followLabel(true, false)).toBe("Following");
    expect(followLabel(true, true)).toBe("Following");
  });
  it("validates UUIDs, bounded integer pages and direction", () => {
    const query = { userId: "00000000-0000-4000-8000-000000000001", direction: "followers" };
    expect(connectionQuery.parse(query).offset).toBe(0);
    for (const offset of [-1, 0.5, 100001, Infinity, "0"])
      expect(connectionQuery.safeParse({ ...query, offset }).success).toBe(false);
    expect(connectionQuery.safeParse({ ...query, userId: "anything" }).success).toBe(false);
    expect(connectionQuery.safeParse({ ...query, direction: "private" }).success).toBe(false);
  });
  it("requires an explicit boolean desired follow state", () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    expect(followCommand.parse({ userId, following: false }).following).toBe(false);
    expect(followCommand.safeParse({ userId, following: "false" }).success).toBe(false);
    expect(followCommand.safeParse({ userId }).success).toBe(false);
  });
});
