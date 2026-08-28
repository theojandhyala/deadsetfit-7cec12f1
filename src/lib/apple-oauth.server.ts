type AppleOAuthEnv = {
  APPLE_OAUTH_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
};

const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_TOKEN_URL = `${APPLE_AUDIENCE}/auth/token`;
const APPLE_REVOKE_URL = `${APPLE_AUDIENCE}/auth/revoke`;

function required(env: AppleOAuthEnv, key: keyof AppleOAuthEnv) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJson(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function privateKeyBytes(pem: string) {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function appleOAuthConfigured(env: AppleOAuthEnv) {
  return Boolean(
    env.APPLE_OAUTH_CLIENT_ID?.trim() &&
    env.APPLE_TEAM_ID?.trim() &&
    env.APPLE_KEY_ID?.trim() &&
    env.APPLE_PRIVATE_KEY?.trim(),
  );
}

export async function createAppleClientSecret(env: AppleOAuthEnv, now = Date.now()) {
  const clientId = required(env, "APPLE_OAUTH_CLIENT_ID");
  const issuedAt = Math.floor(now / 1000);
  const header = encodeJson({ alg: "ES256", kid: required(env, "APPLE_KEY_ID"), typ: "JWT" });
  const claims = encodeJson({
    iss: required(env, "APPLE_TEAM_ID"),
    iat: issuedAt,
    exp: issuedAt + 300,
    aud: APPLE_AUDIENCE,
    sub: clientId,
  });
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(required(env, "APPLE_PRIVATE_KEY")),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function appleRequest(url: string, fields: Record<string, string>, env: AppleOAuthEnv) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required(env, "APPLE_OAUTH_CLIENT_ID"),
      client_secret: await createAppleClientSecret(env),
      ...fields,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    refresh_token?: string;
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || `Apple OAuth HTTP ${response.status}`);
  return payload;
}

export async function exchangeAppleAuthorizationCode(
  code: string,
  redirectUri: string,
  env: AppleOAuthEnv,
) {
  const payload = await appleRequest(
    APPLE_TOKEN_URL,
    { code, redirect_uri: redirectUri, grant_type: "authorization_code" },
    env,
  );
  if (!payload.refresh_token) throw new Error("Apple returned no refresh token");
  return payload.refresh_token;
}

export async function revokeAppleRefreshToken(token: string, env: AppleOAuthEnv) {
  await appleRequest(APPLE_REVOKE_URL, { token, token_type_hint: "refresh_token" }, env);
}
