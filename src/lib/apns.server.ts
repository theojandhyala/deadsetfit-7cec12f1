const APNS_PRODUCTION = "https://api.push.apple.com";
const APNS_DEVELOPMENT = "https://api.sandbox.push.apple.com";

export interface ApnsEnvironment {
  APNS_TEAM_ID?: string;
  APNS_KEY_ID?: string;
  APNS_PRIVATE_KEY?: string;
  APNS_TOPIC?: string;
  APNS_ENVIRONMENT?: string;
}

export interface RivalPushPayload {
  title: string;
  body: string;
  path: "/challenges";
  duelId: string;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function privateKeyBytes(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

export function apnsConfigured(env: ApnsEnvironment): boolean {
  return Boolean(env.APNS_TEAM_ID && env.APNS_KEY_ID && env.APNS_PRIVATE_KEY);
}

export async function createApnsJwt(env: ApnsEnvironment, now = Date.now()): Promise<string> {
  if (!apnsConfigured(env)) throw new Error("APNs is not configured");
  const header = encodeJson({ alg: "ES256", kid: env.APNS_KEY_ID });
  const claims = encodeJson({ iss: env.APNS_TEAM_ID, iat: Math.floor(now / 1000) });
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(env.APNS_PRIVATE_KEY!),
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

export type ApnsResult = { delivered: boolean; deadToken: boolean; status: number; reason?: string };

export async function sendApns(
  env: ApnsEnvironment,
  deviceToken: string,
  payload: RivalPushPayload,
  fetcher: typeof fetch = fetch,
): Promise<ApnsResult> {
  const jwt = await createApnsJwt(env);
  const origin = env.APNS_ENVIRONMENT === "development" ? APNS_DEVELOPMENT : APNS_PRODUCTION;
  const response = await fetcher(`${origin}/3/device/${encodeURIComponent(deviceToken)}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": env.APNS_TOPIC || "org.deadsetfit.app",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
      },
      path: payload.path,
      duelId: payload.duelId,
    }),
  });
  if (response.ok) return { delivered: true, deadToken: false, status: response.status };
  const error = (await response.json().catch(() => ({}))) as { reason?: string };
  return {
    delivered: false,
    deadToken: response.status === 410,
    status: response.status,
    reason: error.reason,
  };
}
