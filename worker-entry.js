// Cloudflare Pages worker: serves the SPA shell + static assets, and routes
// backend traffic (/_serverFn/*, /api/*) to the built TanStack Start server
// handler so server functions (AI, payments, social, etc.) work in production.
import server from "./dist/server/server.js";

const STATIC_RE = /\.(css|js|mjs|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|avif|map|txt|xml)$/i;

// The server bundle reads configuration from process.env (Supabase, Stripe,
// Anthropic). Cloudflare only exposes bindings via `env`, so mirror the
// string bindings into process.env once per isolate.
let envBridged = false;
function bridgeEnv(env) {
  if (envBridged || !globalThis.process?.env) return;
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  // The server code reads SUPABASE_URL; Cloudflare env may only carry the VITE_ name.
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }
  envBridged = true;
}

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
    if (!tokenRes.ok) {
      // Account was created but auto sign-in failed — tell the user the
      // truth instead of a generic failure that makes them retry signup.
      return Response.json(
        { error: 'Account created — please sign in with your email and password' },
        { status: 400 }
      );
    }
    return Response.json(session, { status: 200 });
  } catch {
    return Response.json({ error: 'Sign up failed' }, { status: 500 });
  }
}

function handleHealth(env) {
  // Presence booleans only — never expose values.
  return Response.json({
    supabaseUrl: !!(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
    supabaseServiceKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: !!env.VITE_SUPABASE_PUBLISHABLE_KEY,
    geminiKey: !!env.GEMINI_API_KEY,
    stripeSandboxKey: !!env.STRIPE_SANDBOX_API_KEY,
    stripeLiveKey: !!env.STRIPE_LIVE_API_KEY,
    webhookSandboxSecret: !!env.PAYMENTS_SANDBOX_WEBHOOK_SECRET,
    webhookLiveSecret: !!env.PAYMENTS_LIVE_WEBHOOK_SECRET,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Signup stays on the lightweight worker path.
    if (path === '/api/signup' && request.method === 'POST') {
      return handleSignup(request, env);
    }

    // Env presence diagnostics (booleans only).
    if (path === '/api/health') {
      return handleHealth(env);
    }

    // Backend traffic → TanStack Start server handler (server functions + API
    // routes like the Stripe webhook). Without this, every server function
    // call would fall through to the SPA fallback and get index.html back.
    if (path.startsWith('/_serverFn/') || path.startsWith('/api/')) {
      bridgeEnv(env);
      try {
        return await server.fetch(request, env, ctx);
      } catch (e) {
        return Response.json(
          { error: 'Server function failed', detail: String(e && e.message ? e.message : e) },
          { status: 500 }
        );
      }
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

      // Serve index.html for all app routes (SPA mode)
      try {
        const indexReq = new Request(new URL('/index.html', request.url).toString(), { headers: request.headers });
        const res = await env.ASSETS.fetch(indexReq);
        const html = await res.text();
        return new Response(html, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      } catch (e) {
        return new Response('ASSETS error: ' + String(e), { status: 500 });
      }
    }

    return new Response('No ASSETS binding', { status: 500 });
  }
};
