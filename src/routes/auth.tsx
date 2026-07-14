import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "DEADSET — Sign In" }] }),
  component: AuthRedirect,
});

function AuthRedirect() {
  useEffect(() => {
    // Target the explicit file, not the /auth/ directory: the Capacitor iOS
    // bundled webview doesn't process _redirects and won't serve a directory
    // index, so "/auth/" falls back to the SPA and loops. "/auth/index.html"
    // is a real file served directly on both Capacitor and Cloudflare.
    if (window.location.pathname.includes("index.html")) return;
    window.location.replace("/auth/index.html");
  }, []);

  return (
    <div className="min-h-screen bg-[#080507] text-grit grid place-items-center px-6 text-center">
      <div>
        <h1 className="display text-5xl font-extrabold italic tracking-[-0.045em] text-white">
          DEAD<span className="text-accent-red">SET</span>
        </h1>
        <p className="label-cap text-grit-dim mt-4">Opening sign in…</p>
        <a href="/auth/index.html" className="btn-grit inline-block mt-6 px-6 py-3">
          Open Sign In
        </a>
      </div>
    </div>
  );
}
