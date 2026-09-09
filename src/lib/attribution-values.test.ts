import { describe, expect, it } from "vitest";
import { attributionFromUrl, isCampaignTouch } from "./attribution-values";
const at = "2026-09-09T12:00:00Z";
describe("campaign attribution", () => {
  it("captures bounded campaign, content and account IDs", () => {
    expect(
      attributionFromUrl(
        "https://deadsetfit.com/?utm_source=TikTok&utm_medium=organic&utm_campaign=first100&utm_content=post_42&ds_account=main",
        "",
        at,
      ),
    ).toMatchObject({
      source: "tiktok",
      medium: "organic",
      campaignId: "first100",
      contentId: "post_42",
      accountId: "main",
    });
  });
  it("does not classify lookalike domains as trusted social platforms", () => {
    expect(
      attributionFromUrl("https://deadsetfit.com", "https://not-tiktok.com/a", at).source,
    ).toBe("referral");
    expect(attributionFromUrl("https://deadsetfit.com", "https://m.tiktok.com/a", at).source).toBe(
      "tiktok",
    );
  });
  it("strips sensitive referrer paths, query strings and invalid campaign values", () => {
    const touch = attributionFromUrl(
      "https://deadsetfit.com/?utm_campaign=person%40example.com&token=secret",
      "https://google.com/search?q=private",
      at,
    );
    expect(touch.campaignId).toBeUndefined();
    expect(touch.referrer).toBe("google.com");
    expect(JSON.stringify(touch)).not.toContain("secret");
    expect(JSON.stringify(touch)).not.toContain("private");
  });
  it("does not treat a direct visit as a replacement marketing touch", () => {
    expect(isCampaignTouch(attributionFromUrl("https://deadsetfit.com", "", at))).toBe(false);
    expect(
      isCampaignTouch(attributionFromUrl("https://deadsetfit.com?utm_campaign=test", "", at)),
    ).toBe(true);
  });
});
