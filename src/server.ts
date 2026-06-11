import "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type CloudflareEnv = {
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
  [key: string]: unknown;
};

async function serveShell(env: CloudflareEnv): Promise<Response> {
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

// Routes that go straight to client-side SPA shell — no SSR needed
const SPA_ROUTES = new Set(["/train", "/run", "/diet", "/profile", "/progress", "/friends", "/coach", "/upgrade", "/settings", "/auth", "/onboarding"]);

function isSpaRoute(pathname: string): boolean {
  if (SPA_ROUTES.has(pathname)) return true;
  for (const r of SPA_ROUTES) {
    if (pathname.startsWith(r + "/")) return true;
  }
  return false;
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
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

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: unknown) {
    const url = new URL(request.url);

    // Serve SPA shell immediately for app routes — no SSR
    if (isSpaRoute(url.pathname)) {
      return serveShell(env);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);

      // Any 5xx from SSR → fall back to SPA shell
      if (response.status >= 500) {
        return serveShell(env);
      }

      return response;
    } catch {
      return serveShell(env);
    }
  },
};
