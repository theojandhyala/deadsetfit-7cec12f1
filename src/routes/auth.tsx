import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "DEADSET — Sign In" }] }),
  component: AuthRedirect,
});

function AuthRedirect() {
  useEffect(() => {
    // Only redirect from exactly /auth. If the host served the SPA for /auth/
    // itself (no static auth page), redirecting again would reload the same
    // URL forever — show the manual button instead.
    if (window.location.pathname !== "/auth") return;
    window.location.replace("/auth/");
  }, []);

  return (
    <div className="min-h-screen bg-[#080507] text-grit grid place-items-center px-6 text-center">
      <div>
        <h1 className="display text-5xl font-extrabold italic tracking-[-0.045em] text-white">
          DEAD<span className="text-accent-red">SET</span>
        </h1>
        <p className="label-cap text-grit-dim mt-4">Opening sign in…</p>
        <a href="/auth/" className="btn-grit inline-block mt-6 px-6 py-3">
          Open Sign In
        </a>
      </div>
    </div>
  );
}
