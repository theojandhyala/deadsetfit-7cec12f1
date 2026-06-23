import server from './dist/server/server.js';

const STATIC_EXTENSIONS = /\.(css|js|mjs|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|avif|map|txt|json|xml)$/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route static assets through Cloudflare's asset store
    const isAsset = path.startsWith('/assets/') || STATIC_EXTENSIONS.test(path);
    if (isAsset && env.ASSETS) {
      try {
        const res = await env.ASSETS.fetch(request);
        if (res.status !== 404) return res;
      } catch {}
    }

    // SSR for everything else
    try {
      return await server.fetch(request, env, ctx);
    } catch (err) {
      console.error(err);
      return new Response('Server error', { status: 500 });
    }
  }
};
