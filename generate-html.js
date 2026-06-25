#!/usr/bin/env node
// Runs the SSR server locally to generate dist/client/index.html.
// React uses hydrateRoot(document, ...) so it needs proper server-rendered HTML.
import server from './dist/server/server.js';
import { writeFileSync } from 'node:fs';

const req = new Request('http://localhost/');
const res = await server.fetch(req, {}, {});

if (!res.ok) {
  console.error('SSR server returned', res.status);
  process.exit(1);
}

const html = await res.text();
writeFileSync('dist/client/index.html', html);
console.log('Generated dist/client/index.html (' + html.length + ' bytes)');
