/**
 * Post-build: write dist/server/spa-shell.html with correct hashed asset paths.
 * The server imports this at runtime so SSR crashes degrade to a client-side SPA.
 */
import { readdirSync, writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientAssets = resolve(root, "dist/client/assets");

const files = readdirSync(clientAssets);

// The largest index-*.js is the main React entry bundle
const indexFiles = files
  .filter((f) => f.startsWith("index-") && f.endsWith(".js"))
  .map((f) => ({ name: f, size: readFileSync(resolve(clientAssets, f)).length }))
  .sort((a, b) => b.size - a.size);

const mainJs = indexFiles[0]?.name;
const cssFile = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));

if (!mainJs || !cssFile) {
  console.error("write-spa-shell: could not find main JS or CSS", { mainJs, cssFile });
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
    <meta name="theme-color" content="#0a0a0a"/>
    <meta name="apple-mobile-web-app-capable" content="yes"/>
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
    <title>DEADSET</title>
    <link rel="stylesheet" href="/assets/${cssFile}"/>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;600;700;800&display=swap"/>
    <style>
      body{background:#0a0a0a;margin:0;min-height:100vh;}
      #app-loading{display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px;}
      .spinner{width:32px;height:32px;border:2px solid #e63222;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;}
      @keyframes spin{to{transform:rotate(360deg)}}
      .loading-text{font-family:system-ui,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#8a8a8a;}
    </style>
  </head>
  <body>
    <div id="app-loading">
      <div class="spinner"></div>
      <span class="loading-text">Loading…</span>
    </div>
    <script type="module" src="/assets/${mainJs}"></script>
  </body>
</html>`;

// Write to dist/client so Cloudflare's ASSETS binding can serve it
writeFileSync(resolve(root, "dist/client/app-shell.html"), html, "utf-8");
console.log(`✓ dist/client/app-shell.html → /assets/${mainJs} + /assets/${cssFile}`);
