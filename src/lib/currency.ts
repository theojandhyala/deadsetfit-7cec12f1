// Detect buyer country via Cloudflare trace and map to a supported currency.
export type SupportedCurrency = "usd" | "gbp";

const GBP_COUNTRIES = new Set(["GB", "IM", "JE", "GG"]);

let cachedCountry: string | null = null;

export async function detectCountry(): Promise<string | null> {
  if (cachedCountry) return cachedCountry;
  try {
    const res = await fetch("https://www.cloudflare.com/cdn-cgi/trace", { cache: "no-store" });
    const text = await res.text();
    const match = text.match(/loc=([A-Z]{2})/);
    cachedCountry = match?.[1] ?? null;
    return cachedCountry;
  } catch {
    return null;
  }
}

export function currencyForCountry(country: string | null): SupportedCurrency {
  if (country && GBP_COUNTRIES.has(country.toUpperCase())) return "gbp";
  return "usd";
}

export const CURRENCY_META: Record<
  SupportedCurrency,
  { symbol: string; monthly: string; yearly: string }
> = {
  usd: { symbol: "$", monthly: "$5.99", yearly: "$39.99" },
  gbp: { symbol: "£", monthly: "£5.99", yearly: "£39.99" },
};

export function priceIdFor(plan: "monthly" | "yearly", currency: SupportedCurrency): string {
  if (currency === "gbp") return plan === "yearly" ? "pro_yearly_gbp" : "pro_monthly_gbp";
  return plan === "yearly" ? "pro_yearly" : "pro_monthly";
}
