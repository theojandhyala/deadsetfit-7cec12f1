const TIKTOK_ORIGIN = "https://www.tiktok.com";
const TIKTOK_API_ORIGIN = "https://open.tiktokapis.com";
const CALLBACK_URL = "https://deadsetfit.org/api/tiktok/callback";
const TOKEN_COOKIE = "deadset_tiktok";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export interface TikTokEnv {
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_SANDBOX_CLIENT_KEY?: string;
  TIKTOK_SANDBOX_CLIENT_SECRET?: string;
  TIKTOK_STATE_SECRET?: string;
}

type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  scope?: string;
};

type State = { iat: number; nonce: string; sandbox?: boolean };

class TikTokError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function required(value: string | undefined, name: string) {
  if (!value?.trim()) throw new TikTokError(`${name} is not configured.`, 503);
  return value.trim();
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromBase64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i += 1) different |= a[i] ^ b[i];
  return different === 0;
}

async function secretKey(env: TikTokEnv, usage: KeyUsage[], algorithm: "HMAC" | "AES-GCM") {
  const secret = required(env.TIKTOK_STATE_SECRET, "TIKTOK_STATE_SECRET");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey(
    "raw",
    digest,
    algorithm === "HMAC" ? { name: "HMAC", hash: "SHA-256" } : { name: "AES-GCM" },
    false,
    usage,
  );
}

async function signState(state: State, env: TikTokEnv) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify(state)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await secretKey(env, ["sign"], "HMAC"),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

async function verifyState(value: string | null, env: TikTokEnv) {
  const [payload, suppliedSignature] = (value ?? "").split(".");
  if (!payload || !suppliedSignature)
    throw new TikTokError("The TikTok authorization response is invalid.");
  const expected = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await secretKey(env, ["sign"], "HMAC"),
      new TextEncoder().encode(payload),
    ),
  );
  if (!sameBytes(bytesFromBase64url(suppliedSignature), expected))
    throw new TikTokError("The TikTok authorization response could not be verified.");
  let state: State;
  try {
    state = JSON.parse(new TextDecoder().decode(bytesFromBase64url(payload))) as State;
  } catch {
    throw new TikTokError("The TikTok authorization response is invalid.");
  }
  if (!state.nonce || !Number.isFinite(state.iat) || Date.now() - state.iat > STATE_MAX_AGE_MS) {
    throw new TikTokError("The TikTok authorization request expired. Please try again.");
  }
  return state;
}

function credentials(env: TikTokEnv, sandbox: boolean) {
  if (!sandbox) {
    return {
      clientKey: required(env.TIKTOK_CLIENT_KEY, "TIKTOK_CLIENT_KEY"),
      clientSecret: required(env.TIKTOK_CLIENT_SECRET, "TIKTOK_CLIENT_SECRET"),
    };
  }
  return {
    clientKey: required(env.TIKTOK_SANDBOX_CLIENT_KEY, "TIKTOK_SANDBOX_CLIENT_KEY"),
    clientSecret: required(env.TIKTOK_SANDBOX_CLIENT_SECRET, "TIKTOK_SANDBOX_CLIENT_SECRET"),
  };
}

async function sealTokens(tokens: TokenSet, env: TikTokEnv) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    await secretKey(env, ["encrypt"], "AES-GCM"),
    new TextEncoder().encode(JSON.stringify(tokens)),
  );
  return `${base64url(nonce)}.${base64url(new Uint8Array(ciphertext))}`;
}

async function unsealTokens(value: string | undefined, env: TikTokEnv): Promise<TokenSet> {
  if (!value) throw new TikTokError("Connect TikTok before publishing.", 401);
  const [nonce, ciphertext] = value.split(".");
  if (!nonce || !ciphertext)
    throw new TikTokError("Your TikTok connection is invalid. Connect again.", 401);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesFromBase64url(nonce) },
      await secretKey(env, ["decrypt"], "AES-GCM"),
      bytesFromBase64url(ciphertext),
    );
    const token = JSON.parse(new TextDecoder().decode(plaintext)) as TokenSet;
    if (!token.access_token) throw new Error("no access token");
    return token;
  } catch {
    throw new TikTokError("Your TikTok connection is invalid. Connect again.", 401);
  }
}

function cookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((entry) => entry.trim().split(/=(.*)/s, 2))
      .filter(([key]) => key),
  );
}

function cookie(value: string) {
  return `${TOKEN_COOKIE}=${value}; Path=/api/tiktok; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
}

function jsonError(error: unknown) {
  const known =
    error instanceof TikTokError ? error : new TikTokError("TikTok request failed.", 500);
  return Response.json(
    { error: known.message },
    { status: known.status, headers: { "Cache-Control": "no-store" } },
  );
}

async function tiktokApi(path: string, accessToken: string, body: unknown) {
  const response = await fetch(`${TIKTOK_API_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    data?: unknown;
    error?: { code?: string; message?: string };
  };
  if (!response.ok || (payload.error?.code && payload.error.code !== "ok")) {
    throw new TikTokError(
      payload.error?.message || "TikTok rejected the request.",
      response.status >= 500 ? 502 : 400,
    );
  }
  return payload.data;
}

function photoUrls(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 35 ||
    !value.every((url) => typeof url === "string")
  ) {
    throw new TikTokError("Provide between 1 and 35 photo URLs.");
  }
  return value.map((raw) => {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      (url.hostname !== "deadsetfit.org" && !url.hostname.endsWith(".deadsetfit.org"))
    ) {
      throw new TikTokError("Photo URLs must use Deadset's verified HTTPS domain.");
    }
    return url.toString();
  });
}

export async function handleTikTokRequest(
  request: Request,
  env: TikTokEnv,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/tiktok/")) return undefined;
  try {
    if (url.pathname === "/api/tiktok/connect" && request.method === "GET") {
      const sandbox = url.searchParams.get("sandbox") === "1";
      const nonce = base64url(crypto.getRandomValues(new Uint8Array(24)));
      const state = await signState({ iat: Date.now(), nonce, sandbox }, env);
      const authorize = new URL("/v2/auth/authorize/", TIKTOK_ORIGIN);
      authorize.searchParams.set("client_key", credentials(env, sandbox).clientKey);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
      authorize.searchParams.set("redirect_uri", CALLBACK_URL);
      authorize.searchParams.set("state", state);
      return Response.redirect(authorize.toString(), 302);
    }
    if (url.pathname === "/api/tiktok/callback" && request.method === "GET") {
      if (url.searchParams.get("error"))
        throw new TikTokError(
          url.searchParams.get("error_description") || "TikTok authorization was declined.",
        );
      const state = await verifyState(url.searchParams.get("state"), env);
      const { clientKey, clientSecret } = credentials(env, state.sandbox === true);
      const form = new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: required(url.searchParams.get("code") ?? undefined, "TikTok authorization code"),
        grant_type: "authorization_code",
        redirect_uri: CALLBACK_URL,
      });
      const response = await fetch(`${TIKTOK_API_ORIGIN}/v2/oauth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const tokens = (await response.json()) as TokenSet & {
        error?: string;
        error_description?: string;
      };
      if (!response.ok || !tokens.access_token)
        throw new TikTokError(
          tokens.error_description || "TikTok did not return an access token.",
          502,
        );
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/tiktok?connected=1",
          "Set-Cookie": cookie(await sealTokens(tokens, env)),
        },
      });
    }
    const token = await unsealTokens(cookies(request)[TOKEN_COOKIE], env);
    if (url.pathname === "/api/tiktok/creator-info" && request.method === "GET") {
      return Response.json(
        await tiktokApi("/v2/post/publish/creator_info/query/", token.access_token, {}),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (url.pathname === "/api/tiktok/photo-post" && request.method === "POST") {
      const body = (await request.json()) as Record<string, unknown>;
      if (body.confirmed !== true)
        throw new TikTokError("Explicit creator confirmation is required before publishing.");
      const postMode = body.post_mode === "MEDIA_UPLOAD" ? "MEDIA_UPLOAD" : "DIRECT_POST";
      const photos = photoUrls(body.photo_images);
      const source_info = {
        source: "PULL_FROM_URL",
        photo_images: photos,
        photo_cover_index: Number.isInteger(body.photo_cover_index)
          ? Number(body.photo_cover_index)
          : 0,
      };
      if (source_info.photo_cover_index < 0 || source_info.photo_cover_index >= photos.length)
        throw new TikTokError("The cover index must point to a photo.");
      const post_info: Record<string, unknown> = {
        title: typeof body.title === "string" ? body.title.slice(0, 90) : undefined,
        description:
          typeof body.description === "string" ? body.description.slice(0, 4000) : undefined,
      };
      if (postMode === "DIRECT_POST") {
        if (typeof body.privacy_level !== "string")
          throw new TikTokError("Choose a TikTok privacy level before direct posting.");
        post_info.privacy_level = body.privacy_level;
        post_info.disable_comment = body.disable_comment === true;
        post_info.auto_add_music = body.auto_add_music === true;
        post_info.brand_content_toggle = body.brand_content_toggle === true;
        post_info.brand_organic_toggle = body.brand_organic_toggle === true;
      }
      return Response.json(
        await tiktokApi("/v2/post/publish/content/init/", token.access_token, {
          media_type: "PHOTO",
          post_mode: postMode,
          post_info,
          source_info,
        }),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return jsonError(error);
  }
}
