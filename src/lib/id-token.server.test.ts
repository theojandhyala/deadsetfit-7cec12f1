import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { IdTokenError, verifyIdToken } from "./id-token.server";

const AUDIENCE = "1099444116122-deadset.apps.googleusercontent.com";
const NONCE = "nonce-from-start";

let keyPair: CryptoKeyPair;
let jwks: { keys: (JsonWebKey & { kid: string })[] };

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSegment(value: unknown) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Signs a real RS256 JWT so the signature path is exercised, not stubbed. */
async function signIdToken(
  claims: Record<string, unknown>,
  options: { kid?: string; alg?: string; key?: CryptoKey } = {},
) {
  const header = { alg: options.alg ?? "RS256", kid: options.kid ?? "test-key", typ: "JWT" };
  const body = `${encodeSegment(header)}.${encodeSegment(claims)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    options.key ?? keyPair.privateKey,
    new TextEncoder().encode(body),
  );
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

function googleClaims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    sub: "google-subject-1",
    email: "Theo@Example.com",
    email_verified: true,
    name: "Theo Jandhyala",
    picture: "https://example.com/avatar.png",
    nonce: NONCE,
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

beforeAll(async () => {
  keyPair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  jwks = { keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }] };
});

function stubJwks(payload: unknown = jwks, ok = true) {
  const fetchMock = vi.fn(async (_input: unknown) =>
    ok ? Response.json(payload) : new Response("nope", { status: 500 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("id_token verification", () => {
  it("accepts a properly signed Google token and normalises the identity", async () => {
    const fetchMock = stubJwks();
    const identity = await verifyIdToken({
      provider: "google",
      idToken: await signIdToken(googleClaims()),
      audience: AUDIENCE,
      nonce: NONCE,
    });

    expect(identity).toEqual({
      provider: "google",
      subject: "google-subject-1",
      email: "theo@example.com",
      name: "Theo Jandhyala",
      picture: "https://example.com/avatar.png",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://www.googleapis.com/oauth2/v3/certs");
  });

  it("accepts Apple's string-valued email_verified and its own issuer", async () => {
    stubJwks();
    const identity = await verifyIdToken({
      provider: "apple",
      idToken: await signIdToken(
        googleClaims({
          iss: "https://appleid.apple.com",
          aud: "org.deadsetfit.web",
          email_verified: "true",
          name: undefined,
        }),
      ),
      audience: "org.deadsetfit.web",
      nonce: NONCE,
    });

    expect(identity.provider).toBe("apple");
    expect(identity.email).toBe("theo@example.com");
  });

  it("rejects a token signed by a key the provider does not publish", async () => {
    stubJwks();
    const attacker = (await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    await expect(
      verifyIdToken({
        provider: "google",
        idToken: await signIdToken(googleClaims(), { key: attacker.privateKey }),
        audience: AUDIENCE,
        nonce: NONCE,
      }),
    ).rejects.toThrow(/signature is invalid/);
  });

  it("rejects a token minted for a different client", async () => {
    stubJwks();
    await expect(
      verifyIdToken({
        provider: "google",
        idToken: await signIdToken(
          googleClaims({ aud: "someone-else.apps.googleusercontent.com" }),
        ),
        audience: AUDIENCE,
        nonce: NONCE,
      }),
    ).rejects.toThrow(/different client/);
  });

  it("rejects a replayed token whose nonce is from another attempt", async () => {
    stubJwks();
    await expect(
      verifyIdToken({
        provider: "google",
        idToken: await signIdToken(googleClaims({ nonce: "some-other-nonce" })),
        audience: AUDIENCE,
        nonce: NONCE,
      }),
    ).rejects.toThrow(/nonce does not match/);
  });

  it("rejects an unverified provider email", async () => {
    stubJwks();
    await expect(
      verifyIdToken({
        provider: "google",
        idToken: await signIdToken(googleClaims({ email_verified: false })),
        audience: AUDIENCE,
        nonce: NONCE,
      }),
    ).rejects.toThrow(/not verified/);
  });

  it("rejects an expired token", async () => {
    stubJwks();
    const now = Math.floor(Date.now() / 1000);
    await expect(
      verifyIdToken({
        provider: "google",
        idToken: await signIdToken(googleClaims({ iat: now - 7200, exp: now - 3600 })),
        audience: AUDIENCE,
        nonce: NONCE,
      }),
    ).rejects.toThrow(/expired/);
  });

  it("rejects a foreign issuer", async () => {
    stubJwks();
    await expect(
      verifyIdToken({
        provider: "google",
        idToken: await signIdToken(googleClaims({ iss: "https://evil.example" })),
        audience: AUDIENCE,
        nonce: NONCE,
      }),
    ).rejects.toThrow(/issuer/);
  });

  it("refuses an unsigned (alg=none) token", async () => {
    stubJwks();
    const header = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "none" })));
    const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(googleClaims())));

    await expect(
      verifyIdToken({
        provider: "google",
        idToken: `${header}.${payload}.`,
        audience: AUDIENCE,
        nonce: NONCE,
      }),
    ).rejects.toThrow(IdTokenError);
  });

  it("surfaces a JWKS outage instead of trusting the token", async () => {
    stubJwks(undefined, false);
    await expect(
      verifyIdToken({
        provider: "google",
        idToken: await signIdToken(googleClaims()),
        audience: AUDIENCE,
        nonce: NONCE,
      }),
    ).rejects.toThrow(/JWKS fetch failed/);
  });
});
