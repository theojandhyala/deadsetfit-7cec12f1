#!/usr/bin/env node
// Generates dist/client/index.html — full <head> from SSR + the $tsr router bootstrap
// script needed by TanStack Router, but no SSR body content so React renders fresh.
import server from './dist/server/server.js';
import { writeFileSync, readdirSync } from 'node:fs';

const res = await server.fetch(new Request('http://localhost/'), {}, {});
const full = await res.text();

// Extract <head> content
const headMatch = full.match(/<head>([\s\S]*?)<\/head>/);
const head = headMatch ? headMatch[1] : '';

// Extract the $tsr-stream-barrier script (router manifest + match state)
const tsrMatch = full.match(/<script[^>]+id="\$tsr-stream-barrier"[^>]*>([\s\S]*?)<\/script>/);
const tsrScript = tsrMatch ? `<script>${tsrMatch[1]}</script>` : '';

// Find client entry JS
const assets = readdirSync('dist/client/assets');
const entryJs = assets.find(f => f.startsWith('index-') && f.endsWith('.js') && !f.includes('chunk'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>${head}</head>
<body style="margin:0;background:#0a0a0a">
${tsrScript}
<script type="module" src="/assets/${entryJs}"></script>
</body>
</html>`;

writeFileSync('dist/client/index.html', html);
console.log('Generated dist/client/index.html (' + html.length + ' bytes)');
