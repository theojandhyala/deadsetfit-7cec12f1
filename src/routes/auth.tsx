import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Join DEADSET" }] }),
  component: AuthRedirect,
});

function AuthRedirect() {
  const target =
    typeof window === "undefined"
      ? "/auth/index.html"
      : `/auth/index.html${window.location.search}${window.location.hash}`;

  useEffect(() => {
    // Target the explicit file, not the /auth/ directory: the Capacitor iOS
    // bundled webview doesn't process _redirects and won't serve a directory
    // index, so "/auth/" falls back to the SPA and loops. "/auth/index.html"
    // is a real file served directly on both Capacitor and Cloudflare.
    if (window.location.pathname.includes("index.html")) return;
    window.location.replace(target);
  }, [target]);

  return (
    <div className="min-h-screen bg-[#080507] text-grit grid place-items-center px-6 text-center">
      <div>
        <img
          src="/brand/deadset-lockup.png"
          alt="DEADSET — Forge Your Body"
          width={810}
          height={360}
          className="mx-auto h-auto w-64"
        />
        <p className="label-cap text-grit-dim mt-4">Opening account setup…</p>
        <a href={target} className="btn-grit inline-block mt-6 px-6 py-3">
          Continue
        </a>
      </div>
    </div>
  );
}
