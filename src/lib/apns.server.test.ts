import { describe, expect, it, vi } from "vitest";
import { apnsConfigured, createApnsJwt, sendApns, type ApnsEnvironment } from "./apns.server";

async function testEnvironment(): Promise<ApnsEnvironment> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const bytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(bytes).toString("base64")}\n-----END PRIVATE KEY-----`;
  return {
    APNS_TEAM_ID: "TEAM123456",
    APNS_KEY_ID: "KEY1234567",
    APNS_PRIVATE_KEY: pem,
    APNS_TOPIC: "org.deadsetfit.app",
  };
}

describe("APNs rival delivery", () => {
  it("requires all private signing credentials", () => {
    expect(apnsConfigured({ APNS_TEAM_ID: "team" })).toBe(false);
    expect(
      apnsConfigured({ APNS_TEAM_ID: "team", APNS_KEY_ID: "key", APNS_PRIVATE_KEY: "pem" }),
    ).toBe(true);
  });

  it("creates an ES256 provider token with the expected claims", async () => {
    const token = await createApnsJwt(await testEnvironment(), 1_700_000_000_000);
    const [header, claims, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "KEY1234567",
    });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: "TEAM123456",
      iat: 1_700_000_000,
    });
    expect(signature.length).toBeGreaterThan(20);
  });

  it("marks an APNs 410 token for deletion and keeps challenge deep-link data", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.path).toBe("/challenges");
      expect(body.duelId).toBe("duel-1");
      return new Response(JSON.stringify({ reason: "Unregistered" }), { status: 410 });
    });
    const result = await sendApns(
      await testEnvironment(),
      "a".repeat(64),
      { title: "Rival trained", body: "Open the duel.", path: "/challenges", duelId: "duel-1" },
      fetcher as typeof fetch,
    );
    expect(result).toMatchObject({ delivered: false, deadToken: true, status: 410 });
  });
});
