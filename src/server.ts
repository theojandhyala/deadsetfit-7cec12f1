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

async function spaFallback(env: CloudflareEnv): Promise<Response> {
  try {
    const assets = env?.ASSETS;
    if (assets) {
      const resp = await assets.fetch(new Request("http://localhost/app-shell.html"));
      if (resp.ok) {
        return new Response(resp.body, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    }
  } catch {
    // fall through
  }
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function normalizeSsrResponse(response: Response, env: CloudflareEnv): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await response.clone().text();
    if (body.includes('"unhandled":true')) {
      console.error(consumeLastCapturedError() ?? new Error(`SSR error: ${body}`));
      return spaFallback(env);
    }
  }
  return spaFallback(env);
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeSsrResponse(response, env);
    } catch (error) {
      console.error(error);
      return spaFallback(env);
    }
  },
};
