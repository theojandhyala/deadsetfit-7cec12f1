import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type CloudflareEnv = {
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
  [key: string]: unknown;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Serve the pre-built SPA shell from Cloudflare ASSETS binding so React boots
// client-side even when SSR crashes (missing env vars, cold-start timeouts, etc.)
async function spaFallback(env: CloudflareEnv): Promise<Response> {
  try {
    const assets = env?.ASSETS;
    if (assets) {
      const resp = await assets.fetch(new Request("https://deadsetfit.org/app-shell.html"));
      if (resp.ok) {
        return new Response(resp.body, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    }
  } catch {
    // fall through to static error page
  }
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function normalizeCatastrophicSsrResponse(
  response: Response,
  env: CloudflareEnv,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return spaFallback(env);
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, env);
    } catch (error) {
      console.error(error);
      return spaFallback(env);
    }
  },
};
