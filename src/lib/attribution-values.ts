/** Campaign identifiers only; never retain query strings or referrer paths. */
export type AttributionTouch = {
  source: string;
  medium?: string;
  campaignId?: string;
  contentId?: string;
  accountId?: string;
  referrer?: string;
  landing?: string;
  capturedAt: string;
};
const identifier = (value: string | null): string | undefined =>
  value && /^[a-zA-Z0-9._-]{1,80}$/.test(value) ? value : undefined;
const within = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
export function attributionFromUrl(
  url: string,
  referrer: string,
  capturedAt: string,
): AttributionTouch {
  const location = new URL(url);
  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    /* No usable referrer. */
  }
  const source =
    identifier(location.searchParams.get("utm_source")) ??
    identifier(location.searchParams.get("ref"));
  const domains: [string, string][] = [
    ["tiktok.com", "tiktok"],
    ["instagram.com", "instagram"],
    ["youtube.com", "youtube"],
    ["youtu.be", "youtube"],
    ["google.com", "google"],
    ["google.co.uk", "google"],
    ["t.co", "x"],
    ["twitter.com", "x"],
    ["x.com", "x"],
    ["facebook.com", "facebook"],
    ["snapchat.com", "snapchat"],
    ["reddit.com", "reddit"],
  ];
  const inferred =
    !host || within(host, "deadsetfit.com")
      ? "direct"
      : (domains.find(([domain]) => within(host, domain))?.[1] ?? "referral");
  return {
    source: source?.toLowerCase() ?? inferred,
    medium: identifier(location.searchParams.get("utm_medium")),
    campaignId: identifier(location.searchParams.get("utm_campaign")),
    contentId: identifier(location.searchParams.get("utm_content")),
    accountId: identifier(location.searchParams.get("ds_account")),
    referrer: host ? host.slice(0, 200) : undefined,
    landing: location.pathname.slice(0, 100),
    capturedAt,
  };
}
/** Organic/direct visits do not overwrite a known marketing touch. */
export function isCampaignTouch(touch: AttributionTouch): boolean {
  return Boolean(
    touch.campaignId ||
    touch.contentId ||
    touch.accountId ||
    !["direct", "referral"].includes(touch.source),
  );
}
