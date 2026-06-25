#!/usr/bin/env node
// Generates dist/client/index.html for SPA fallback.
// Runs after `bun run build` to create a static shell the CF Pages worker can serve.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const assets = readdirSync("dist/client/assets");
const mainJs = assets.find((f) => f.startsWith("index-") && f.endsWith(".js") && !f.includes("chunk"));
const mainCss = assets.find((f) => f.endsWith(".css"));

if (!mainJs) throw new Error("Could not find main JS entry in dist/client/assets");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>DEADSET — Train. Build. Become.</title>
<meta name="theme-color" content="#0a0a0a"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
${mainCss ? `<link rel="stylesheet" href="/assets/${mainCss}"/>` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap"/>
</head>
<body style="margin:0;background:#0a0a0a">
<div id="root"></div>
<script type="module" src="/assets/${mainJs}"></script>
</body>
</html>`;

writeFileSync("dist/client/index.html", html);
console.log(`Generated dist/client/index.html (JS: ${mainJs}, CSS: ${mainCss})`);
