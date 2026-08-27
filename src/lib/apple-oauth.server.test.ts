import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appleOAuthConfigured,
  createAppleClientSecret,
  exchangeAppleAuthorizationCode,
  revokeAppleRefreshToken,
} from "./apple-oauth.server";

async function testEnv() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----`;
  return {
    env: {
      APPLE_OAUTH_CLIENT_ID: "org.deadsetfit.web",
      APPLE_TEAM_ID: "89JWMU95AH",
      APPLE_KEY_ID: "3W269K687N",
      APPLE_PRIVATE_KEY: pem,
    },
    publicKey: pair.publicKey,
  };
}

function fromBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

describe("Apple OAuth lifecycle", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("creates a verifiable ES256 client secret with the required Apple claims", async () => {
    const { env, publicKey } = await testEnv();
    const jwt = await createAppleClientSecret(env, 1_800_000_000_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(fromBase64Url(header).toString())).toMatchObject({
      alg: "ES256",
      kid: "3W269K687N",
    });
    expect(JSON.parse(fromBase64Url(claims).toString())).toMatchObject({
      iss: "89JWMU95AH",
      sub: "org.deadsetfit.web",
      aud: "https://appleid.apple.com",
      iat: 1_800_000_000,
      exp: 1_800_000_300,
    });
    await expect(
      crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        fromBase64Url(signature),
        new TextEncoder().encode(`${header}.${claims}`),
      ),
    ).resolves.toBe(true);
  });

  it("exchanges the authorization code and revokes the resulting credential", async () => {
    const { env } = await testEnv();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ refresh_token: "apple-refresh" })))
      .mockResolvedValueOnce(new Response("{}"));

    await expect(
      exchangeAppleAuthorizationCode(
        "one-time-code",
        "https://deadsetfit.org/api/auth/apple/callback",
        env,
      ),
    ).resolves.toBe("apple-refresh");
    await revokeAppleRefreshToken("apple-refresh", env);

    const tokenBody = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(fetchMock.mock.calls[0][0]).toBe("https://appleid.apple.com/auth/token");
    expect(tokenBody.get("grant_type")).toBe("authorization_code");
    expect(tokenBody.get("code")).toBe("one-time-code");
    const revokeBody = fetchMock.mock.calls[1][1]?.body as URLSearchParams;
    expect(fetchMock.mock.calls[1][0]).toBe("https://appleid.apple.com/auth/revoke");
    expect(revokeBody.get("token")).toBe("apple-refresh");
    expect(revokeBody.get("token_type_hint")).toBe("refresh_token");
  });

  it("requires the complete first-party Apple server configuration", async () => {
    const { env } = await testEnv();
    expect(appleOAuthConfigured(env)).toBe(true);
    expect(appleOAuthConfigured({ ...env, APPLE_PRIVATE_KEY: "" })).toBe(false);
  });
});
