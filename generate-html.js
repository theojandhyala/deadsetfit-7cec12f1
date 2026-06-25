#!/usr/bin/env node
// Generates a minimal SPA shell HTML from the SSR server's <head> content.
// We keep the full <head> (stylesheets, preloads, meta) but strip the SSR body
// so React always does a clean client-side render with no hydration mismatch.
import server from './dist/server/server.js';
import { writeFileSync, readdirSync } from 'node:fs';

const res = await server.fetch(new Request('http://localhost/'), {}, {});
const full = await res.text();

// Extract <head> content
const headMatch = full.match(/<head>([\s\S]*?)<\/head>/);
const head = headMatch ? headMatch[1] : '';

// Find the client entry JS
const assets = readdirSync('dist/client/assets');
const entryJs = assets.find(f => f.startsWith('index-') && f.endsWith('.js'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>${head}</head>
<body style="margin:0;background:#0a0a0a">
<script type="module" src="/assets/${entryJs}"></script>
</body>
</html>`;

writeFileSync('dist/client/index.html', html);
console.log('Generated dist/client/index.html (entry: ' + entryJs + ')');
