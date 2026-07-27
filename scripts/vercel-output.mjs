import { mkdirSync, copyFileSync, writeFileSync, cpSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const outDir = resolve(root, ".vercel/output");
const staticDir = resolve(outDir, "static");
const fnDir = resolve(outDir, "functions/index.func");

mkdirSync(staticDir, { recursive: true });
mkdirSync(fnDir, { recursive: true });

// Static client assets
cpSync(resolve(root, "dist/client"), staticDir, { recursive: true });

// Server bundle (entry + code-split chunks)
copyFileSync(resolve(root, "dist/server/server.js"), resolve(fnDir, "server.js"));
cpSync(resolve(root, "dist/server/assets"), resolve(fnDir, "assets"), { recursive: true });

// Adapter: converts Vercel (req, res) to fetch API expected by TanStack Start
writeFileSync(
  resolve(fnDir, "handler.js"),
  `
import { createServer } from "http";
import { Readable } from "stream";

let serverPromise;
async function getServer() {
  if (!serverPromise) serverPromise = import("./server.js").then((m) => m.default ?? m);
  return serverPromise;
}

export default async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const url = new URL(req.url, proto + "://" + host);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const request = new Request(url.toString(), {
    method: req.method,
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([, v]) => v != null)
    ),
    body: body && body.length > 0 ? body : undefined,
    duplex: "half",
  });

  const srv = await getServer();
  const response = await srv.fetch(request, {}, {});

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));

  const buf = await response.arrayBuffer();
  res.end(Buffer.from(buf));
}
`.trimStart(),
);

// Serverless function config — points to the adapter
writeFileSync(
  resolve(fnDir, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs20.x", handler: "handler.js", maxDuration: 30 }),
);

// Routing: static files pass through, everything else → SSR handler
writeFileSync(
  resolve(outDir, "config.json"),
  JSON.stringify({
    version: 3,
    routes: [
      { src: "^/assets/(.*)$", dest: "/assets/$1" },
      { src: "^/(robots\\.txt|sitemap\\.xml|manifest\\.json|llms\\.txt)$", dest: "/$1" },
      { src: "/(.*)", dest: "/index" },
    ],
  }),
);

console.log("✓ Vercel output written to .vercel/output/");
