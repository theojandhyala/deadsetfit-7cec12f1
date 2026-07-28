import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { handleOAuthRequest, providerConfigured, type OAuthBrokerEnv } from "./oauth.server";

const env: OAuthBrokerEnv = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GOOGLE_OAUTH_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
  APPLE_OAUTH_CLIENT_ID: "org.deadsetfit.web",
};

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

async function signIdToken(claims: Record<string, unknown>) {
  const body = `${encodeSegment({ alg: "RS256", kid: "test-key", typ: "JWT" })}.${encodeSegment(claims)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(body),
  );
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

function idTokenClaims(provider: "google" | "apple", nonce: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: provider === "google" ? "https://accounts.google.com" : "https://appleid.apple.com",
    aud: provider === "google" ? env.GOOGLE_OAUTH_CLIENT_ID : env.APPLE_OAUTH_CLIENT_ID,
    sub: `${provider}-subject`,
    email: "lifter@example.com",
    email_verified: true,
    nonce,
    iat: now,
    exp: now + 3600,
  };
}

/** Routes each hop of the flow: provider JWKS, Google's token endpoint, and
 * Supabase session creation. */
function stubBackends(
  overrides: {
    providerGrantResponse?: Response;
    verifyStatus?: number;
    createUserResponse?: Response;
  } = {},
) {
  const calls: { url: string; body?: string; headers?: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const rawBody = init?.body;
    calls.push({
      url,
      // Google's token exchange posts URLSearchParams; Supabase posts JSON strings.
      body:
        typeof rawBody === "string"
          ? rawBody
          : rawBody instanceof URLSearchParams
            ? rawBody.toString()
            : undefined,
      headers: init?.headers as Record<string, string> | undefined,
    });

    if (
      url.includes("googleapis.com/oauth2/v3/certs") ||
      url.includes("appleid.apple.com/auth/keys")
    ) {
      return Response.json(jwks);
    }
    if (url.includes("oauth2.googleapis.com/token")) {
      // The code exchange must return a token whose nonce matches this attempt.
      return Response.json({ id_token: googleIdToken });
    }
    if (url.includes("grant_type=id_token")) {
      return (
        overrides.providerGrantResponse ??
        Response.json({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          token_type: "bearer",
        })
      );
    }
    if (url.includes("/auth/v1/admin/users")) {
      return overrides.createUserResponse ?? Response.json({ id: "user-1" });
    }
    if (url.includes("/auth/v1/admin/generate_link")) {
      return Response.json({ hashed_token: "hashed-token-1" });
    }
    if (url.includes("/auth/v1/verify")) {
      if (overrides.verifyStatus && overrides.verifyStatus >= 400) {
        return Response.json({ msg: "nope" }, { status: overrides.verifyStatus });
      }
      return Response.json({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "bearer",
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

let googleIdToken = "";

async function startAuthorize(provider: "google" | "apple", params: Record<string, string> = {}) {
  const url = new URL(`https://deadsetfit.org/api/auth/${provider}/start`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await handleOAuthRequest(new Request(url), env);
  expect(response?.status).toBe(302);
  return new URL(response!.headers.get("location")!);
}

/** Runs a full /start → provider → /callback round trip with real signatures. */
async function completeFlow(
  provider: "google" | "apple",
  startParams: Record<string, string> = { state: "client-state", flow: "web" },
  stubs: Parameters<typeof stubBackends>[0] = {},
) {
  const authorize = await startAuthorize(provider, startParams);
  const nonce = authorize.searchParams.get("nonce")!;
  const state = authorize.searchParams.get("state")!;
  const idToken = await signIdToken(idTokenClaims(provider, nonce));
  googleIdToken = idToken;

  const backends = stubBackends(stubs);
  const body = new URLSearchParams(
    provider === "google" ? { state, code: "auth-code" } : { state, id_token: idToken },
  );
  const response = await handleOAuthRequest(
    new Request(`https://deadsetfit.org/api/auth/${provider}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
    env,
  );
  return { response, authorize, ...backends };
}

function fragmentOf(response: Response | null) {
  return new URLSearchParams(new URL(response!.headers.get("location")!).hash.slice(1));
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OAuth broker", () => {
  it("sends Google to its consent screen with our own client and callback", async () => {
    const authorize = await startAuthorize("google", { state: "client-state", flow: "web" });

    expect(authorize.origin).toBe("https://accounts.google.com");
    expect(authorize.searchParams.get("client_id")).toBe(env.GOOGLE_OAUTH_CLIENT_ID);
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      "https://deadsetfit.org/api/auth/google/callback",
    );
    expect(authorize.searchParams.get("response_type")).toBe("code");
    expect(authorize.searchParams.get("scope")).toBe("openid email profile");
    expect(authorize.searchParams.get("nonce")).toBeTruthy();
    expect(authorize.searchParams.get("prompt")).toBe("select_account");
  });

  it("asks Apple for an id_token via form_post so no client secret is needed", async () => {
    const authorize = await startAuthorize("apple", { state: "client-state", flow: "web" });

    expect(authorize.origin).toBe("https://appleid.apple.com");
    expect(authorize.searchParams.get("client_id")).toBe("org.deadsetfit.web");
    expect(authorize.searchParams.get("response_type")).toBe("code id_token");
    expect(authorize.searchParams.get("response_mode")).toBe("form_post");
    expect(authorize.searchParams.get("scope")).toBe("name email");
  });

  it("uses the managed session path when a legacy service key belongs to another project", async () => {
    const mismatchedKey = `${encodeSegment({ alg: "HS256" })}.${encodeSegment({
      role: "service_role",
      ref: "different-project",
    })}.signature`;
    const fallbackEnv: OAuthBrokerEnv = {
      ...env,
      SUPABASE_SERVICE_ROLE_KEY: mismatchedKey,
      APPLE_OAUTH_CLIENT_ID: "",
    };
    const providerUrl = new URL("https://appleid.apple.com/auth/authorize");
    providerUrl.searchParams.set("redirect_uri", "https://oauth.lovable.app/callback");
    const fetchMock = vi.fn(async (_input: unknown) => {
      return new Response(null, {
        status: 302,
        headers: { Location: providerUrl.toString() },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/apple/start?state=client-state&flow=native"),
      fallbackEnv,
    );

    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(providerUrl.toString());
    const managedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(managedUrl.origin).toBe("https://oauth.lovable.app");
    expect(managedUrl.searchParams.get("project_id")).toBe("de41f7e5-5faf-4590-b8e8-72f7acefa0d6");
    expect(managedUrl.searchParams.get("provider")).toBe("apple");
    expect(managedUrl.searchParams.get("redirect_uri")).toBe(
      "https://deadsetfit.org/auth/native-callback",
    );
    expect(managedUrl.searchParams.get("state")).toBe("client-state");
  });

  it("mints a session from the verified provider token without an admin key", async () => {
    const { response, calls } = await completeFlow("apple");

    const urls = calls.map((call) => call.url);
    expect(urls).toContain("https://project.supabase.co/auth/v1/token?grant_type=id_token");
    expect(urls.some((url) => url.includes("/auth/v1/admin/"))).toBe(false);

    const grantCall = calls.find((call) => call.url.includes("grant_type=id_token"))!;
    expect(grantCall.headers?.apikey).toBe("publishable-key");
    expect(JSON.parse(grantCall.body!)).toEqual({
      provider: "apple",
      id_token: expect.any(String),
      nonce: expect.any(String),
    });

    const fragment = fragmentOf(response);
    expect(fragment.get("access_token")).toBe("access");
    expect(fragment.get("refresh_token")).toBe("refresh");
    expect(fragment.get("state")).toBe("client-state");
  });

  it("exchanges a Google code for an id_token before verifying it", async () => {
    const { response, calls, authorize } = await completeFlow("google");

    const tokenCall = calls.find((call) => call.url.includes("oauth2.googleapis.com/token"))!;
    const form = new URLSearchParams(tokenCall.body!);
    expect(form.get("code")).toBe("auth-code");
    expect(form.get("client_secret")).toBe("google-client-secret");
    expect(form.get("redirect_uri")).toBe("https://deadsetfit.org/api/auth/google/callback");

    const grantCall = calls.find((call) => call.url.includes("grant_type=id_token"))!;
    const rawNonce = JSON.parse(grantCall.body!).nonce as string;
    const nonceDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawNonce));
    const hashedNonce = Array.from(new Uint8Array(nonceDigest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    expect(authorize.searchParams.get("nonce")).toBe(hashedNonce);
    expect(fragmentOf(response).get("access_token")).toBe("access");
  });

  it("treats an existing email as a link, not a failure", async () => {
    const { response } = await completeFlow(
      "apple",
      { state: "client-state", flow: "web" },
      {
        providerGrantResponse: Response.json(
          { msg: "Unacceptable audience in id_token" },
          { status: 400 },
        ),
        createUserResponse: Response.json(
          { msg: "A user with this email address has already been registered" },
          { status: 422 },
        ),
      },
    );

    expect(fragmentOf(response).get("access_token")).toBe("access");
  });

  it("returns the native flow through the HTTPS deep-link bridge", async () => {
    const { response } = await completeFlow("apple", { state: "client-state", flow: "native" });

    const location = new URL(response!.headers.get("location")!);
    expect(`${location.origin}${location.pathname}`).toBe(
      "https://deadsetfit.org/auth/native-callback",
    );
  });

  it("ignores a return origin we do not own", async () => {
    const { response } = await completeFlow("apple", {
      state: "client-state",
      flow: "web",
      origin: "https://evil.example",
    });

    expect(new URL(response!.headers.get("location")!).origin).toBe("https://deadsetfit.org");
  });

  it("keeps a localhost return origin for development", async () => {
    const { response } = await completeFlow("apple", {
      state: "client-state",
      flow: "web",
      origin: "http://localhost:5173",
    });

    expect(new URL(response!.headers.get("location")!).origin).toBe("http://localhost:5173");
  });

  it("rejects an id_token whose nonce belongs to another attempt", async () => {
    const authorize = await startAuthorize("apple", { state: "client-state", flow: "web" });
    const idToken = await signIdToken(idTokenClaims("apple", "nonce-from-elsewhere"));
    stubBackends();

    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/apple/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          state: authorize.searchParams.get("state")!,
          id_token: idToken,
        }),
      }),
      env,
    );

    expect(fragmentOf(response).get("error_description")).toContain("could not be verified");
  });

  it("surfaces a failed session mint without leaking internals", async () => {
    const { response } = await completeFlow(
      "apple",
      { state: "client-state", flow: "web" },
      {
        providerGrantResponse: Response.json({ msg: "provider rejected token" }, { status: 400 }),
        verifyStatus: 500,
      },
    );

    const description = fragmentOf(response).get("error_description")!;
    expect(description).toContain("could not be completed");
    expect(description).not.toContain("magiclink");
  });

  it("rejects a forged state instead of minting a session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleOAuthRequest(
      new Request(
        "https://deadsetfit.org/api/auth/google/callback?code=auth-code&state=forged.signature",
      ),
      env,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(fragmentOf(response).get("error_description")).toContain("could not be verified");
  });

  it("surfaces a cancelled sign-in as a readable message", async () => {
    const authorize = await startAuthorize("apple", { state: "client-state", flow: "web" });
    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/apple/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          state: authorize.searchParams.get("state")!,
          error: "user_cancelled_authorize",
        }),
      }),
      env,
    );

    expect(fragmentOf(response).get("error_description")).toBe("Sign in was cancelled.");
  });

  it("reports which providers are configured", async () => {
    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/providers"),
      { ...env, APPLE_OAUTH_CLIENT_ID: "" },
    );

    await expect(response!.json()).resolves.toEqual({ google: true, apple: true });
    expect(providerConfigured("google", { ...env, GOOGLE_OAUTH_CLIENT_SECRET: "" })).toBe(true);
  });

  it("keeps managed sign-in ready without a service-role key", () => {
    expect(providerConfigured("apple", { ...env, SUPABASE_SERVICE_ROLE_KEY: "" })).toBe(true);
  });

  it("answers a HEAD readiness check with the same redirect", async () => {
    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/google/start?state=test", { method: "HEAD" }),
      env,
    );

    expect(response?.status).toBe(302);
    expect(new URL(response!.headers.get("location")!).origin).toBe("https://accounts.google.com");
  });

  it("falls back when a provider is missing its first-party client id", async () => {
    const providerUrl = "https://appleid.apple.com/auth/authorize";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { Location: providerUrl } })),
    );
    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/apple/start?state=test"),
      { ...env, APPLE_OAUTH_CLIENT_ID: "" },
    );

    expect(response?.headers.get("location")).toBe(providerUrl);
  });

  it("leaves unknown /api/auth paths to the worker", async () => {
    await expect(
      handleOAuthRequest(new Request("https://deadsetfit.org/api/auth/github/start"), env),
    ).resolves.toBeNull();
  });
});
