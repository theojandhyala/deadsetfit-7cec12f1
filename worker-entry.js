import server from './dist/server/server.js';

const STATIC_RE = /\.(css|js|mjs|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|avif|map|txt|xml)$/i;

async function handleSignup(request, env) {
  try {
    const { email, password } = await request.json();
    const url = env.VITE_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !serviceKey) {
      return Response.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const createRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      const msg = err.message ?? 'Sign up failed';
      return Response.json(
        { error: msg.toLowerCase().includes('already') ? 'An account with this email already exists' : msg },
        { status: 400 }
      );
    }

    const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const session = await tokenRes.json();
    return Response.json(session, { status: tokenRes.ok ? 200 : 400 });
  } catch {
    return Response.json({ error: 'Sign up failed' }, { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle signup API endpoint
    if (path === '/api/signup' && request.method === 'POST') {
      return handleSignup(request, env);
    }

    // Serve static assets via ASSETS binding
    if (env.ASSETS) {
      const isAsset = path.startsWith('/assets/') || STATIC_RE.test(path);
      if (isAsset) {
        try {
          const res = await env.ASSETS.fetch(request);
          if (res.status !== 404) return res;
        } catch {}
      }
    }

    try {
      return await server.fetch(request, env, ctx);
    } catch (e) {
      // SSR crashed — fall back to SPA index.html so the client-side app loads
      if (env.ASSETS) {
        try {
          const indexReq = new Request(new URL('/index.html', request.url).toString(), { headers: request.headers });
          const res = await env.ASSETS.fetch(indexReq);
          if (res.status !== 404) return res;
        } catch {}
      }
      return new Response('Internal Server Error: ' + (e && e.message ? e.message : String(e)), { status: 500 });
    }
  }
};
