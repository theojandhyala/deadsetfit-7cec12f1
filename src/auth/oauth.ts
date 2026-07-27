export type OAuthProvider = "google" | "apple";

/** The broker lives on our own domain (see src/lib/oauth.server.ts), so every
 *  screen in the sign-in flow — Google's, Apple's, ours — says deadsetfit.org. */
export const OAUTH_BROKER_ORIGIN = "https://deadsetfit.org";

export type OAuthCallback = {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  error: string | null;
  state: string | null;
  type: string | null;
};

export function createOAuthState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The native shell and localhost both talk to the deployed broker: the
 *  provider-registered redirect URI only ever points at deadsetfit.org. */
export function oauthBrokerOrigin(override?: string) {
  const configured = typeof override === "string" ? override.trim().replace(/\/$/, "") : "";
  return configured || OAUTH_BROKER_ORIGIN;
}

export function buildOAuthStartUrl(
  provider: OAuthProvider,
  options: { state: string; flow: "web" | "native"; origin: string; brokerOrigin?: string },
) {
  const url = new URL(`${oauthBrokerOrigin(options.brokerOrigin)}/api/auth/${provider}/start`);
  url.searchParams.set("state", options.state);
  url.searchParams.set("flow", options.flow);
  url.searchParams.set("origin", options.origin);
  return url.toString();
}

export function oauthProvidersUrl(brokerOrigin?: string) {
  return `${oauthBrokerOrigin(brokerOrigin)}/api/auth/providers`;
}

export function parseOAuthCallback(value: string): OAuthCallback {
  const url = new URL(value);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const read = (key: string) => url.searchParams.get(key) ?? hash.get(key);

  return {
    accessToken: read("access_token"),
    refreshToken: read("refresh_token"),
    code: read("code"),
    error: read("error_description") ?? read("error"),
    state: read("state"),
    type: read("type"),
  };
}

export function hasOAuthResult(callback: OAuthCallback) {
  return Boolean(
    callback.error || callback.code || (callback.accessToken && callback.refreshToken),
  );
}
