import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"/><title>Error</title></head><body style="background:#0a0a0a;color:#f5f5f0;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center"><p style="color:#e63222;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase">Something went wrong</p><button onclick="location.reload()" style="margin-top:1rem;background:#e63222;color:#fff;border:none;padding:.6rem 1.5rem;cursor:pointer;font-size:.8rem;text-transform:uppercase;letter-spacing:.1em">Try again</button></div></body></html>`,
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
