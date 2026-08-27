import { describe, expect, it, vi } from "vitest";
import {
  authModeFromUrl,
  buildOAuthStartUrl,
  createOAuthState,
  emailAuthRedirectUrl,
  hasOAuthResult,
  NATIVE_AUTH_BRIDGE,
  OAUTH_BROKER_ORIGIN,
  oauthProvidersUrl,
  parseOAuthCallback,
} from "./oauth";

describe("first-party OAuth", () => {
  it("starts Google sign-in on our own domain", () => {
    const url = new URL(
      buildOAuthStartUrl("google", {
        state: "state-123",
        flow: "web",
        origin: "https://deadsetfit.org",
      }),
    );

    expect(url.origin).toBe("https://deadsetfit.org");
    expect(url.pathname).toBe("/api/auth/google/start");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("flow")).toBe("web");
    expect(url.searchParams.get("origin")).toBe("https://deadsetfit.org");
  });

  it("never routes sign-in through a third-party broker", () => {
    const url = buildOAuthStartUrl("apple", {
      state: "state-123",
      flow: "web",
      origin: "https://deadsetfit.org",
    });

    expect(OAUTH_BROKER_ORIGIN).toBe("https://deadsetfit.org");
    expect(url).not.toContain("lovable");
    expect(oauthProvidersUrl()).toBe("https://deadsetfit.org/api/auth/providers");
  });

  it("uses the native flow for the iPhone shell", () => {
    const url = new URL(
      buildOAuthStartUrl("apple", {
        state: "native-state",
        flow: "native",
        origin: "https://deadsetfit.org",
      }),
    );

    expect(url.pathname).toBe("/api/auth/apple/start");
    expect(url.searchParams.get("flow")).toBe("native");
  });

  it("targets a local broker override during development", () => {
    const url = new URL(
      buildOAuthStartUrl("google", {
        state: "state-123",
        flow: "web",
        origin: "http://localhost:5173",
        brokerOrigin: "http://localhost:8788/",
      }),
    );

    expect(url.origin).toBe("http://localhost:8788");
    expect(url.searchParams.get("origin")).toBe("http://localhost:5173");
  });

  it("reads token callbacks from either the query or fragment", () => {
    const fragment = parseOAuthCallback(
      "https://deadsetfit.org/auth/#access_token=access&refresh_token=refresh&state=abc",
    );
    const query = parseOAuthCallback(
      "org.deadsetfit.app://auth/callback?access_token=access&refresh_token=refresh&state=abc",
    );

    expect(fragment).toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
      state: "abc",
    });
    expect(query).toMatchObject(fragment);
    expect(hasOAuthResult(fragment)).toBe(true);
  });

  it("reads PKCE codes and provider errors", () => {
    expect(parseOAuthCallback("https://deadsetfit.org/auth/?code=pkce-code").code).toBe(
      "pkce-code",
    );
    expect(
      parseOAuthCallback(
        "https://deadsetfit.org/auth/?error=access_denied&error_description=Cancelled",
      ).error,
    ).toBe("Cancelled");
  });

  it("creates an unpredictable state value", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, index) => {
          bytes[index] = index;
        });
        return bytes;
      },
    });

    expect(createOAuthState()).toHaveLength(48);
    vi.unstubAllGlobals();
  });

  it("opens the requested login or signup mode", () => {
    expect(authModeFromUrl("capacitor://localhost/auth/index.html?mode=signin")).toBe("signin");
    expect(authModeFromUrl("capacitor://localhost/auth/index.html?mode=signup")).toBe("signup");
    expect(authModeFromUrl("capacitor://localhost/auth/index.html")).toBe("signup");
    expect(authModeFromUrl("not a url")).toBe("signup");
  });

  it("returns native email confirmation and recovery through the app bridge", () => {
    expect(emailAuthRedirectUrl(true, "capacitor://localhost")).toBe(NATIVE_AUTH_BRIDGE);
  });

  it("returns web email flows to the website auth page", () => {
    expect(emailAuthRedirectUrl(false, "https://deadsetfit.org/")).toBe(
      "https://deadsetfit.org/auth/",
    );
  });
});
