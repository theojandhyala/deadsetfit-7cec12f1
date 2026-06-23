import rpcHandler from "../api/rpc";

interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

function requestHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value]));
}

async function handleRpc(request: Request): Promise<Response> {
  let status = 200;
  let body = "";
  const headers = new Headers();

  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return response;
    },
    status(code: number) {
      status = code;
      return response;
    },
    json(value: unknown) {
      headers.set("Content-Type", "application/json; charset=utf-8");
      body = JSON.stringify(value);
      return response;
    },
    end(value?: unknown) {
      body = value == null ? "" : String(value);
      return response;
    },
  };

  let parsedBody: unknown;
  if (request.method !== "OPTIONS") {
    try {
      parsedBody = await request.json();
    } catch {
      parsedBody = undefined;
    }
  }

  await rpcHandler({
    method: request.method,
    headers: requestHeaders(request.headers),
    body: parsedBody,
  }, response);

  return new Response(body, { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/rpc") return handleRpc(request);
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
