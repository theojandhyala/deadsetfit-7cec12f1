/**
 * First-party OAuth broker for Google and Apple sign-in.
 *
 * DEADSET owns the public start endpoint and sends the browser directly to the
 * selected provider. The direct path uses our Google OAuth client / Apple
 * Services ID and returns to
 * https://deadsetfit.org/api/auth/<provider>/callback.
 *
 * The session is minted here rather than through Supabase's `grant_type=id_token`
 * endpoint: that grant only accepts client ids allowlisted in the Supabase
 * project's provider config, and this project is Lovable-managed, so that config
 * is not ours to change (it rejected our own client with "Unacceptable audience
 * in id_token"). Instead the worker verifies the provider's id_token itself (see
 * id-token.server.ts) and uses the service-role key to create/lock onto the user
 * and redeem an admin magic link, which never leaves the server.
 *
 * Lovable-managed Supabase projects do not expose their service-role key. When
 * the configured legacy key belongs to another project (or first-party provider
 * credentials are unavailable), the start endpoint hands the attempt to the
 * project's managed OAuth broker instead. The public entry point remains
 * deadsetfit.org and the broker returns the finished Supabase session to our
 * normal web/native callbacks.
 *
 * The first-party browser round trip is stateless: everything the callback
 * needs (client state, flow, nonce, return origin) rides in an HMAC-signed
 * `state` value. Apple posts its callback cross-site, where a SameSite cookie
 * would not be sent, so a signed state is the only workable carrier.
 */

import { verifyIdToken, type VerifiedIdentity } from "./id-token.server";

export type OAuthProvider = "google" | "apple";

export interface OAuthBrokerEnv {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  APPLE_OAUTH_CLIENT_ID?: string;
  OAUTH_STATE_SECRET?: string;
  LOVABLE_OAUTH_PROJECT_ID?: string;
}

/** The provider-registered redirect host. Must match the Google "Authorized
 *  redirect URI" and the Apple Services ID return URL exactly, so it is fixed
 *  rather than derived from the incoming request (www., previews, etc.). */
const BROKER_ORIGIN = "https://deadsetfit.org";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const ALLOWED_RETURN_ORIGINS = [BROKER_ORIGIN, "https://www.deadsetfit.org"];

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const MANAGED_OAUTH_URL = "https://oauth.lovable.app/initiate";
const DEFAULT_LOVABLE_PROJECT_ID = "de41f7e5-5faf-4590-b8e8-72f7acefa0d6";

type OAuthFlow = "web" | "native";

type SignedState = {
  /** The client's own state value, echoed back for its localStorage check. */
  cs: string;
  flow: OAuthFlow;
  nonce: string;
  origin: string;
  iat: number;
};

/** An error whose message is safe to show the signed-in-out user. */
class OAuthFailure extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

function providerLabel(provider: OAuthProvider) {
  return provider === "google" ? "Google" : "Apple";
}

function randomHex(bytes: number) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i];
  return result === 0;
}

async function stateKey(env: OAuthBrokerEnv) {
  // A dedicated secret is preferred; the service-role key is a strong fallback
  // so sign-in keeps working without a second secret to rotate. HMAC never
  // exposes key material.
  const secret = env.OAUTH_STATE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new OAuthFailure("Sign in is not configured.", "no state secret");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signState(state: SignedState, env: OAuthBrokerEnv) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(state)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await stateKey(env),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

function unverifiedState(detail: string) {
  return new OAuthFailure("The sign-in response could not be verified. Please try again.", detail);
}

async function verifyState(value: string | null, env: OAuthBrokerEnv): Promise<SignedState> {
  const [payload, signature] = (value ?? "").split(".");
  if (!payload || !signature) throw unverifiedState("state is missing or malformed");
  const key = await stateKey(env);

  // A tampered state can fail as a bad signature or as undecodable bytes —
  // both mean the same thing to the caller.
  let state: SignedState;
  try {
    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    );
    if (!timingSafeEqual(fromBase64Url(signature), expected)) {
      throw unverifiedState("state signature mismatch");
    }
    state = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as SignedState;
  } catch (error) {
    throw error instanceof OAuthFailure ? error : unverifiedState("state could not be decoded");
  }

  if (!state.nonce || Date.now() - state.iat > STATE_MAX_AGE_MS) {
    throw new OAuthFailure("That sign-in attempt expired. Please try again.");
  }
  return {
    ...state,
    flow: state.flow === "native" ? "native" : "web",
    origin: resolveReturnOrigin(state.origin),
  };
}

/** Tokens land in the return URL's fragment, so only origins we own may be
 *  named — an unchecked value here would be a token-leaking open redirect. */
function resolveReturnOrigin(requested: string | null | undefined): string {
  if (!requested) return BROKER_ORIGIN;
  let url: URL;
  try {
    url = new URL(requested);
  } catch {
    return BROKER_ORIGIN;
  }
  if (ALLOWED_RETURN_ORIGINS.includes(url.origin)) return url.origin;
  // Local development against the production broker.
  if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    return url.origin;
  }
  return BROKER_ORIGIN;
}

function clientId(provider: OAuthProvider, env: OAuthBrokerEnv) {
  const id = provider === "google" ? env.GOOGLE_OAUTH_CLIENT_ID : env.APPLE_OAUTH_CLIENT_ID;
  if (!id?.trim()) {
    throw new OAuthFailure(
      `${providerLabel(provider)} sign-in is temporarily unavailable. Use email for now.`,
      `${provider} client id is not configured`,
    );
  }
  return id.trim();
}

function decodeJwtPayload(value: string) {
  try {
    const payload = value.split(".")[1];
    if (!payload) return null;
    return JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      ref?: string;
      role?: string;
    };
  } catch {
    return null;
  }
}

function configuredProjectRef(env: OAuthBrokerEnv) {
  try {
    return new URL(env.SUPABASE_URL ?? "").hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

/** Legacy service-role JWTs include the project ref. Reject a key that can
 * never authenticate against the configured project before a user enters the
 * provider flow. Modern sb_secret_ keys are opaque and are validated by
 * Supabase when used. */
function serviceRoleCanBelongToProject(env: OAuthBrokerEnv) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return false;
  if (!key.startsWith("eyJ")) return true;
  const payload = decodeJwtPayload(key);
  const projectRef = configuredProjectRef(env);
  return payload?.role === "service_role" && !!projectRef && payload.ref === projectRef;
}

function firstPartyProviderConfigured(provider: OAuthProvider, env: OAuthBrokerEnv) {
  const supabaseReady = Boolean(
    env.SUPABASE_URL?.trim() &&
    env.SUPABASE_PUBLISHABLE_KEY?.trim() &&
    serviceRoleCanBelongToProject(env),
  );
  const stateReady = Boolean(
    env.OAUTH_STATE_SECRET?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  if (!supabaseReady || !stateReady) return false;
  if (provider === "google") {
    return Boolean(env.GOOGLE_OAUTH_CLIENT_ID?.trim() && env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
  }
  return Boolean(env.APPLE_OAUTH_CLIENT_ID?.trim());
}

function managedProjectId(env: OAuthBrokerEnv) {
  return env.LOVABLE_OAUTH_PROJECT_ID?.trim() || DEFAULT_LOVABLE_PROJECT_ID;
}

export function providerConfigured(provider: OAuthProvider, env: OAuthBrokerEnv) {
  return firstPartyProviderConfigured(provider, env) || Boolean(managedProjectId(env));
}

function callbackUri(provider: OAuthProvider) {
  return `${BROKER_ORIGIN}/api/auth/${provider}/callback`;
}

function authorizationUrl(provider: OAuthProvider, state: string, nonce: string, id: string) {
  if (provider === "google") {
    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", callbackUri("google"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  const url = new URL(APPLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", callbackUri("apple"));
  // Asking for an id_token here means the broker never needs Apple's
  // six-month client-secret JWT: the callback already carries a verifiable
  // identity token. form_post is required by Apple whenever name/email or an
  // id_token is requested.
  url.searchParams.set("response_type", "code id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  return url.toString();
}

async function googleIdToken(code: string, env: OAuthBrokerEnv) {
  const secret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!secret) {
    throw new OAuthFailure(
      "Google sign-in is temporarily unavailable. Use email for now.",
      "GOOGLE_OAUTH_CLIENT_SECRET is not configured",
    );
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId("google", env),
      client_secret: secret,
      redirect_uri: callbackUri("google"),
      grant_type: "authorization_code",
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    id_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!response.ok || !payload.id_token) {
    throw new OAuthFailure(
      "Google sign-in could not be completed. Please try again.",
      payload.error_description || payload.error || `google token HTTP ${response.status}`,
    );
  }
  return payload.id_token;
}

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
};

function supabaseEnv(env: OAuthBrokerEnv) {
  const url = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !publishableKey || !serviceRoleKey) {
    throw new OAuthFailure("Sign in is not configured.", "Supabase env is missing");
  }
  return { url, publishableKey, serviceRoleKey };
}

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    msg?: string;
    message?: string;
    error_description?: string;
    error?: string;
    error_code?: string;
  };
  return (
    payload.msg ||
    payload.message ||
    payload.error_description ||
    payload.error_code ||
    payload.error ||
    `HTTP ${response.status}`
  );
}

/** Creates the account on first sign-in. An existing address is not an error:
 *  the identity is matched to it, which is why the id_token's email must be
 *  provider-verified before we get here. */
async function ensureUser(identity: VerifiedIdentity, env: OAuthBrokerEnv) {
  const { url, serviceRoleKey } = supabaseEnv(env);
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email: identity.email,
      email_confirm: true,
      user_metadata: {
        full_name: identity.name,
        avatar_url: identity.picture,
        [`${identity.provider}_sub`]: identity.subject,
      },
      app_metadata: { provider: identity.provider, providers: [identity.provider] },
    }),
  });
  if (response.ok) return;

  const detail = await readError(response);
  if (/already|registered|exists/i.test(detail)) return;
  throw new OAuthFailure(
    `${providerLabel(identity.provider)} sign-in could not be completed. Please try again or use email.`,
    `admin create user: ${detail}`,
  );
}

/** Mints a real Supabase session without the provider's own grant: an admin
 *  magic link is generated (never emailed) and immediately redeemed here. */
async function sessionForEmail(
  provider: OAuthProvider,
  email: string,
  env: OAuthBrokerEnv,
): Promise<SupabaseSession> {
  const { url, publishableKey, serviceRoleKey } = supabaseEnv(env);

  const linkResponse = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!linkResponse.ok) {
    throw new OAuthFailure(
      `${providerLabel(provider)} sign-in could not be completed. Please try again or use email.`,
      `generate_link: ${await readError(linkResponse)}`,
    );
  }
  const { hashed_token: hashedToken } = (await linkResponse.json()) as { hashed_token?: string };
  if (!hashedToken) {
    throw new OAuthFailure(
      `${providerLabel(provider)} sign-in could not be completed. Please try again or use email.`,
      "generate_link returned no hashed_token",
    );
  }

  const verifyResponse = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
    body: JSON.stringify({ type: "magiclink", token_hash: hashedToken }),
  });
  const session = (await verifyResponse.json().catch(() => ({}))) as Partial<SupabaseSession>;
  if (!verifyResponse.ok || !session.access_token || !session.refresh_token) {
    throw new OAuthFailure(
      `${providerLabel(provider)} sign-in could not be completed. Please try again or use email.`,
      `verify magiclink: HTTP ${verifyResponse.status}`,
    );
  }
  return session as SupabaseSession;
}

async function supabaseSession(
  provider: OAuthProvider,
  idToken: string,
  nonce: string,
  env: OAuthBrokerEnv,
): Promise<SupabaseSession> {
  let identity: VerifiedIdentity;
  try {
    identity = await verifyIdToken({
      provider,
      idToken,
      audience: clientId(provider, env),
      nonce,
    });
  } catch (error) {
    if (error instanceof OAuthFailure) throw error;
    throw new OAuthFailure(
      `${providerLabel(provider)} sign-in could not be verified. Please try again.`,
      error instanceof Error ? error.message : "id_token verification failed",
    );
  }

  await ensureUser(identity, env);
  return sessionForEmail(provider, identity.email, env);
}

function returnUrl(state: SignedState, fragment: URLSearchParams) {
  const path = state.flow === "native" ? "/auth/native-callback" : "/auth/";
  return `${state.origin}${path}#${fragment.toString()}`;
}

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

async function managedAuthorizationUrl(
  provider: OAuthProvider,
  clientState: string,
  flow: OAuthFlow,
  env: OAuthBrokerEnv,
) {
  const callback =
    flow === "native" ? `${BROKER_ORIGIN}/auth/native-callback` : `${BROKER_ORIGIN}/auth/`;
  const url = new URL(MANAGED_OAUTH_URL);
  url.searchParams.set("project_id", managedProjectId(env));
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("state", clientState);
  if (provider === "google") url.searchParams.set("prompt", "select_account");

  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location");
  const expectedHost = provider === "google" ? "accounts.google.com" : "appleid.apple.com";
  const providerUrl = (() => {
    try {
      return location ? new URL(location) : null;
    } catch {
      return null;
    }
  })();
  if (response.status < 300 || response.status >= 400 || providerUrl?.hostname !== expectedHost) {
    throw new OAuthFailure(
      `${providerLabel(provider)} sign-in is temporarily unavailable. Use email for now.`,
      `managed broker returned HTTP ${response.status}`,
    );
  }
  return providerUrl.toString();
}

function successRedirect(state: SignedState, provider: OAuthProvider, session: SupabaseSession) {
  const fragment = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type ?? "bearer",
    provider,
  });
  if (session.expires_in) fragment.set("expires_in", String(session.expires_in));
  if (state.cs) fragment.set("state", state.cs);
  return redirect(returnUrl(state, fragment));
}

function failureRedirect(state: SignedState | null, error: unknown, context: string) {
  const message =
    error instanceof OAuthFailure
      ? error.message
      : "Sign in could not be completed. Please try again.";
  console.error(`oauth ${context}`, error instanceof OAuthFailure ? error.detail : error);

  const fragment = new URLSearchParams({ error: "server_error", error_description: message });
  if (state?.cs) fragment.set("state", state.cs);
  const target = state
    ? returnUrl(state, fragment)
    : `${BROKER_ORIGIN}/auth/#${fragment.toString()}`;
  return redirect(target);
}

async function handleStart(provider: OAuthProvider, url: URL, env: OAuthBrokerEnv) {
  const state: SignedState = {
    cs: (url.searchParams.get("state") ?? "").slice(0, 128),
    flow: url.searchParams.get("flow") === "native" ? "native" : "web",
    nonce: randomHex(24),
    origin: resolveReturnOrigin(url.searchParams.get("origin")),
    iat: Date.now(),
  };

  try {
    if (!firstPartyProviderConfigured(provider, env)) {
      return redirect(await managedAuthorizationUrl(provider, state.cs, state.flow, env));
    }
    const id = clientId(provider, env);
    return redirect(authorizationUrl(provider, await signState(state, env), state.nonce, id));
  } catch (error) {
    return failureRedirect(state, error, `${provider} start`);
  }
}

/** Apple posts its callback as a form; Google returns via query string. */
async function callbackParams(request: Request, url: URL) {
  if (request.method !== "POST") return url.searchParams;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) return url.searchParams;
  return new URLSearchParams(await request.text());
}

async function handleCallback(provider: OAuthProvider, request: Request, env: OAuthBrokerEnv) {
  const url = new URL(request.url);
  const params = await callbackParams(request, url);
  let state: SignedState | null = null;

  try {
    state = await verifyState(params.get("state"), env);

    const providerError = params.get("error_description") || params.get("error");
    if (providerError) {
      throw new OAuthFailure("Sign in was cancelled.", providerError.slice(0, 200));
    }

    let idToken = params.get("id_token");
    if (!idToken && provider === "google") {
      const code = params.get("code");
      if (!code) throw new OAuthFailure("Sign in returned without a code. Please try again.");
      idToken = await googleIdToken(code, env);
    }
    if (!idToken) {
      throw new OAuthFailure(
        `${providerLabel(provider)} sign-in could not be completed. Please try again.`,
        "callback carried no id_token",
      );
    }

    return successRedirect(
      state,
      provider,
      await supabaseSession(provider, idToken, state.nonce, env),
    );
  } catch (error) {
    return failureRedirect(state, error, `${provider} callback`);
  }
}

function providersResponse(env: OAuthBrokerEnv) {
  return Response.json(
    { google: providerConfigured("google", env), apple: providerConfigured("apple", env) },
    {
      headers: {
        "Cache-Control": "no-store",
        // Read cross-origin by the native shell and by localhost during dev.
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

/** Routes every /api/auth/* request. Returns null when nothing matches so the
 *  worker can fall through to its own 404. */
export async function handleOAuthRequest(
  request: Request,
  env: OAuthBrokerEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/api/auth/providers") return providersResponse(env);

  const match = /^\/api\/auth\/(google|apple)\/(start|callback)$/.exec(url.pathname);
  if (!match) return null;
  const provider = match[1] as OAuthProvider;

  if (match[2] === "start") {
    // HEAD is allowed so a `curl -I` readiness check sees the same redirect.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    return handleStart(provider, url, env);
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  return handleCallback(provider, request, env);
}
