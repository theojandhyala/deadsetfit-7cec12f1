import { afterEach, describe, expect, it, vi } from "vitest";
import { handleOAuthRequest, providerConfigured, type OAuthBrokerEnv } from "./oauth.server";

const env: OAuthBrokerEnv = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GOOGLE_OAUTH_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
  APPLE_OAUTH_CLIENT_ID: "org.deadsetfit.web",
};

function startRequest(provider: string, params: Record<string, string> = {}) {
  const url = new URL(`https://deadsetfit.org/api/auth/${provider}/start`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url);
}

async function startLocation(provider: string, params: Record<string, string> = {}) {
  const response = await handleOAuthRequest(startRequest(provider, params), env);
  expect(response?.status).toBe(302);
  return new URL(response!.headers.get("location")!);
}

/** Replays a /start into its matching callback so the signed state is real. */
async function callbackFor(
  provider: "google" | "apple",
  startParams: Record<string, string>,
  callbackParams: Record<string, string>,
) {
  const authorize = await startLocation(provider, startParams);
  const body = new URLSearchParams({
    state: authorize.searchParams.get("state")!,
    ...callbackParams,
  });
  return handleOAuthRequest(
    new Request(`https://deadsetfit.org/api/auth/${provider}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
    env,
  );
}

function fragmentOf(response: Response | null) {
  return new URLSearchParams(new URL(response!.headers.get("location")!).hash.slice(1));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OAuth broker", () => {
  it("sends Google to its consent screen with our own client and callback", async () => {
    const authorize = await startLocation("google", { state: "client-state", flow: "web" });

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
    const authorize = await startLocation("apple", { state: "client-state", flow: "web" });

    expect(authorize.origin).toBe("https://appleid.apple.com");
    expect(authorize.searchParams.get("client_id")).toBe("org.deadsetfit.web");
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      "https://deadsetfit.org/api/auth/apple/callback",
    );
    expect(authorize.searchParams.get("response_type")).toBe("code id_token");
    expect(authorize.searchParams.get("response_mode")).toBe("form_post");
    expect(authorize.searchParams.get("scope")).toBe("name email");
  });

  it("returns an Apple session to the web app with the client's state", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "bearer",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await callbackFor(
      "apple",
      { state: "client-state", flow: "web" },
      { id_token: "apple-id-token" },
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/token?grant_type=id_token");
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.provider).toBe("apple");
    expect(body.id_token).toBe("apple-id-token");
    expect(body.nonce).toBeTruthy();

    const location = new URL(response!.headers.get("location")!);
    expect(`${location.origin}${location.pathname}`).toBe("https://deadsetfit.org/auth/");
    const fragment = fragmentOf(response);
    expect(fragment.get("access_token")).toBe("access");
    expect(fragment.get("refresh_token")).toBe("refresh");
    expect(fragment.get("state")).toBe("client-state");
  });

  it("exchanges a Google code for an id_token before creating the session", async () => {
    const fetchMock = vi.fn(async (input: string) =>
      String(input).includes("oauth2.googleapis.com")
        ? Response.json({ id_token: "google-id-token" })
        : Response.json({ access_token: "access", refresh_token: "refresh" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await callbackFor(
      "google",
      { state: "client-state", flow: "web" },
      { code: "auth-code" },
    );

    const tokenRequest = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(tokenRequest[0]).toBe("https://oauth2.googleapis.com/token");
    const form = new URLSearchParams(String(tokenRequest[1].body));
    expect(form.get("code")).toBe("auth-code");
    expect(form.get("client_secret")).toBe("google-client-secret");
    expect(form.get("redirect_uri")).toBe("https://deadsetfit.org/api/auth/google/callback");
    expect(fragmentOf(response).get("access_token")).toBe("access");
  });

  it("returns the native flow through the HTTPS deep-link bridge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ access_token: "access", refresh_token: "refresh" })),
    );

    const response = await callbackFor(
      "apple",
      { state: "client-state", flow: "native" },
      { id_token: "apple-id-token" },
    );

    const location = new URL(response!.headers.get("location")!);
    expect(`${location.origin}${location.pathname}`).toBe(
      "https://deadsetfit.org/auth/native-callback",
    );
  });

  it("ignores a return origin we do not own", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ access_token: "access", refresh_token: "refresh" })),
    );

    const response = await callbackFor(
      "apple",
      { state: "client-state", flow: "web", origin: "https://evil.example" },
      { id_token: "apple-id-token" },
    );

    expect(new URL(response!.headers.get("location")!).origin).toBe("https://deadsetfit.org");
  });

  it("keeps a localhost return origin for development", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ access_token: "access", refresh_token: "refresh" })),
    );

    const response = await callbackFor(
      "apple",
      { state: "client-state", flow: "web", origin: "http://localhost:5173" },
      { id_token: "apple-id-token" },
    );

    expect(new URL(response!.headers.get("location")!).origin).toBe("http://localhost:5173");
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
    const fragment = fragmentOf(response);
    expect(fragment.get("error_description")).toContain("could not be verified");
  });

  it("surfaces a cancelled sign-in as a readable message", async () => {
    const response = await callbackFor(
      "apple",
      { state: "client-state", flow: "web" },
      { error: "user_cancelled_authorize" },
    );

    expect(fragmentOf(response).get("error_description")).toBe("Sign in was cancelled.");
  });

  it("reports which providers are configured", async () => {
    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/providers"),
      { ...env, APPLE_OAUTH_CLIENT_ID: "" },
    );

    await expect(response!.json()).resolves.toEqual({ google: true, apple: false });
    expect(providerConfigured("google", { ...env, GOOGLE_OAUTH_CLIENT_SECRET: "" })).toBe(false);
  });

  it("does not claim a provider is ready without a state secret", () => {
    expect(
      providerConfigured("apple", {
        ...env,
        SUPABASE_SERVICE_ROLE_KEY: "",
        OAUTH_STATE_SECRET: "",
      }),
    ).toBe(false);
  });

  it("answers a HEAD readiness check with the same redirect", async () => {
    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/google/start?state=test", { method: "HEAD" }),
      env,
    );

    expect(response?.status).toBe(302);
    expect(new URL(response!.headers.get("location")!).origin).toBe("https://accounts.google.com");
  });

  it("also reports a provider missing its own client id", async () => {
    const response = await handleOAuthRequest(
      new Request("https://deadsetfit.org/api/auth/apple/start?state=test"),
      { ...env, APPLE_OAUTH_CLIENT_ID: "" },
    );

    const fragment = fragmentOf(response);
    expect(fragment.get("error_description")).toContain("temporarily unavailable");
    expect(fragment.get("state")).toBe("test");
  });

  it("leaves unknown /api/auth paths to the worker", async () => {
    await expect(
      handleOAuthRequest(new Request("https://deadsetfit.org/api/auth/github/start"), env),
    ).resolves.toBeNull();
  });
});
