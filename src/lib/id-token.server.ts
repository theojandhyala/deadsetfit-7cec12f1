/**
 * Verifies Google/Apple OpenID Connect id_tokens inside the worker.
 *
 * The broker used to hand the raw id_token to Supabase's `grant_type=id_token`
 * endpoint and let GoTrue validate it. That requires our OAuth client id to be
 * allowlisted in the Supabase project's provider config — a dashboard we do not
 * control (the project is Lovable-managed), which rejected our own client with
 * "Unacceptable audience in id_token". Verifying here removes that dependency:
 * the only Supabase credential involved is the service-role key we already hold.
 *
 * Because we now own the verification, every check GoTrue would have done has to
 * happen here: RS256 signature against the provider's published JWKS, issuer,
 * audience, expiry, and the nonce minted at /start.
 */

export type VerifiedIdentity = {
  provider: "google" | "apple";
  /** The provider's stable user id (`sub`). */
  subject: string;
  email: string;
  name?: string;
  picture?: string;
};

type Jwks = { keys: JsonWebKey[] };

const PROVIDER_CONFIG = {
  google: {
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
  },
  apple: {
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
  },
} as const;

/** Tolerance for provider/worker clock drift. */
const CLOCK_SKEW_SECONDS = 60;
const JWKS_CACHE_SECONDS = 3600;

export class IdTokenError extends Error {}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJson(segment: string) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as Record<string, unknown>;
}

async function providerKey(provider: "google" | "apple", kid: string) {
  const { jwksUrl } = PROVIDER_CONFIG[provider];
  // Providers rotate keys, so the JWKS is fetched rather than pinned; Cloudflare
  // caches it at the edge so this is not a round trip per sign-in.
  const response = await fetch(jwksUrl, {
    cf: { cacheTtl: JWKS_CACHE_SECONDS, cacheEverything: true },
  } as RequestInit);
  if (!response.ok) throw new IdTokenError(`${provider} JWKS fetch failed (${response.status})`);

  const { keys } = (await response.json()) as Jwks;
  const jwk = keys.find((key) => (key as { kid?: string }).kid === kid);
  if (!jwk) throw new IdTokenError(`${provider} signing key ${kid} is not published`);

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function claimAsString(claims: Record<string, unknown>, name: string) {
  const value = claims[name];
  return typeof value === "string" ? value : undefined;
}

/** Apple sends email_verified as the string "true"; Google sends a boolean. */
function emailIsVerified(claims: Record<string, unknown>) {
  const value = claims.email_verified;
  return value === true || value === "true";
}

export async function verifyIdToken(options: {
  provider: "google" | "apple";
  idToken: string;
  audience: string;
  nonce: string;
}): Promise<VerifiedIdentity> {
  const { provider, idToken, audience, nonce } = options;
  const [headerSegment, payloadSegment, signatureSegment] = idToken.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new IdTokenError("id_token is not a JWT");
  }

  const header = decodeJson(headerSegment);
  if (header.alg !== "RS256") throw new IdTokenError(`unexpected id_token alg ${header.alg}`);
  const kid = claimAsString(header, "kid");
  if (!kid) throw new IdTokenError("id_token header has no kid");

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    await providerKey(provider, kid),
    base64UrlToBytes(signatureSegment),
    new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
  );
  if (!verified) throw new IdTokenError("id_token signature is invalid");

  const claims = decodeJson(payloadSegment);
  const issuer = claimAsString(claims, "iss") ?? "";
  if (!(PROVIDER_CONFIG[provider].issuers as readonly string[]).includes(issuer)) {
    throw new IdTokenError(`unexpected id_token issuer ${issuer}`);
  }

  // `aud` may be a single string or an array; the token must be for our client.
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) {
    throw new IdTokenError("id_token was issued for a different client");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = typeof claims.exp === "number" ? claims.exp : 0;
  if (expiry + CLOCK_SKEW_SECONDS < now) throw new IdTokenError("id_token has expired");
  const issuedAt = typeof claims.iat === "number" ? claims.iat : 0;
  if (issuedAt - CLOCK_SKEW_SECONDS > now) throw new IdTokenError("id_token is not yet valid");

  // Binds this token to the /start that began the flow — without it a token
  // minted for another session could be replayed at our callback.
  if (claimAsString(claims, "nonce") !== nonce) {
    throw new IdTokenError("id_token nonce does not match this sign-in attempt");
  }

  const subject = claimAsString(claims, "sub");
  const email = claimAsString(claims, "email")?.trim().toLowerCase();
  if (!subject) throw new IdTokenError("id_token has no subject");
  if (!email) throw new IdTokenError("id_token has no email");
  // Identity is matched to a DEADSET account by email, so an unverified address
  // would let a provider account claim someone else's account.
  if (!emailIsVerified(claims)) throw new IdTokenError("provider email is not verified");

  return {
    provider,
    subject,
    email,
    name: claimAsString(claims, "name"),
    picture: claimAsString(claims, "picture"),
  };
}
