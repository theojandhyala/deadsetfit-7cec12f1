interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { email, password } = await context.request.json<{ email: string; password: string }>();
    const url = context.env.VITE_SUPABASE_URL;
    const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = context.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !serviceKey) {
      return Response.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Create user via admin API (bypasses email confirmation)
    const createRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });

    if (!createRes.ok) {
      const err = await createRes.json<{ message?: string }>();
      const msg = err.message ?? "Sign up failed";
      return Response.json(
        { error: msg.toLowerCase().includes("already") ? "An account with this email already exists" : msg },
        { status: 400 }
      );
    }

    // Sign in to get session tokens
    const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const session = await tokenRes.json();
    return Response.json(session, { status: tokenRes.ok ? 200 : 400 });
  } catch (err) {
    return Response.json({ error: "Sign up failed" }, { status: 500 });
  }
};
