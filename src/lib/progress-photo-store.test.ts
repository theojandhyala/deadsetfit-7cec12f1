import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({}) } } }));

const { dataUrlToBlob, isStoredPhoto, resolveCheckInSrc } = await import("./progress-photo-store");

describe("dataUrlToBlob", () => {
  it("decodes a base64 data URL to bytes", async () => {
    // "hi" in base64.
    const blob = dataUrlToBlob("data:image/jpeg;base64,aGk=");
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe("image/jpeg");
    expect(await blob!.text()).toBe("hi");
  });

  it("decodes a plain (non-base64) data URL", async () => {
    const blob = dataUrlToBlob("data:text/plain,hello%20there");
    expect(await blob!.text()).toBe("hello there");
  });

  it("returns null rather than throwing on anything that is not a data URL", () => {
    // These reach the migration pass straight off a user's device, where a
    // truncated or corrupted entry must skip rather than abort the whole run.
    expect(dataUrlToBlob("")).toBeNull();
    expect(dataUrlToBlob("https://example.com/a.jpg")).toBeNull();
    expect(dataUrlToBlob("data:image/jpeg;base64,!!!not-base64!!!")).toBeNull();
  });
});

describe("isStoredPhoto", () => {
  it("distinguishes stored objects from inline bytes", () => {
    expect(isStoredPhoto({ photoPath: "user/abc.jpg" })).toBe(true);
    expect(isStoredPhoto({ photoPath: undefined })).toBe(false);
  });
});

describe("resolveCheckInSrc", () => {
  it("returns inline bytes for a legacy check-in", async () => {
    // The whole point of keeping the field readable: photos taken before the
    // move to storage must not disappear.
    await expect(
      resolveCheckInSrc({
        date: "2026-01-01T00:00:00Z",
        photoDataUrl: "data:image/jpeg;base64,aGk=",
      }),
    ).resolves.toBe("data:image/jpeg;base64,aGk=");
  });

  it("returns null when a check-in carries no image at all", async () => {
    await expect(resolveCheckInSrc({ date: "2026-01-01T00:00:00Z" })).resolves.toBeNull();
  });
});
