#!/usr/bin/env node
import server from './dist/server/server.js';
import { writeFileSync, readdirSync } from 'node:fs';

const res = await server.fetch(new Request('http://localhost/'), {}, {});
const full = await res.text();

const headMatch = full.match(/<head>([\s\S]*?)<\/head>/);
const head = headMatch ? headMatch[1] : '';

const tsrMatch = full.match(/<script[^>]+id="\$tsr-stream-barrier"[^>]*>([\s\S]*?)<\/script>/);
const tsrContent = tsrMatch
  ? tsrMatch[1].replace(/,ssr:!0/g, ',ssr:!1').replace(/,ssr:true/g, ',ssr:false')
  : '';
const tsrScript = tsrContent ? `<script>${tsrContent}</script>` : '';

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
console.log('Generated dist/client/index.html (' + html.length + ' bytes, ssr:false)');
