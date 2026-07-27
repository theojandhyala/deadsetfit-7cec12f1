import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { restoreSupabaseSession } from "./integrations/supabase/client";
import { capturePendingRef } from "./lib/referral";
import "./styles.css";

// Exposes the bundled release in diagnostics and forces a fresh entry asset
// when a Cloudflare edge has cached an invalid response for an older hash.
document.documentElement.dataset.deadsetRelease = "2026-07-26-fitness2";

// Grab any ?ref= invite code before the router rewrites the URL.
capturePendingRef();

// Signals the index.html boot watchdog that the entry module executed.
(window as unknown as Record<string, unknown>).__DEADSET_BOOT_OK = true;

const root = document.getElementById("root")!;

function renderBootFailure(error: unknown) {
  console.error("DEADSET failed to boot", error);
  root.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#f5f5f0;font-family:Inter,system-ui,sans-serif;padding:24px;text-align:center">
      <div style="max-width:360px">
        <h1 style="margin:0;font-family:Impact,'Arial Black',sans-serif;font-size:44px;font-style:italic;letter-spacing:-.04em">
          DEAD<span style="color:#e63222">SET</span>
        </h1>
        <p style="margin:18px 0 0;color:#f5f5f0;font-size:14px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">
          Loading hit a snag
        </p>
        <p style="margin:10px 0 22px;color:#8a8a8a;font-size:13px;line-height:1.5">
          Your account data is safe. Reload the app to pull the latest version.
        </p>
        <button onclick="window.location.reload()" style="appearance:none;border:0;background:#e63222;color:white;padding:14px 22px;font-weight:900;letter-spacing:.12em;text-transform:uppercase">
          Reload DEADSET
        </button>
      </div>
    </main>
  `;
}

async function clearOldBrowserCaches() {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => /deadset|vite|workbox|supabase|app/i.test(key))
        .map((key) => caches.delete(key)),
    );
  } catch {
    /* cache cleanup is best-effort only */
  }
}

window.addEventListener("vite:preloadError", async () => {
  const key = "deadset_preload_retry_v1";
  if (sessionStorage.getItem(key)) {
    await clearOldBrowserCaches();
    renderBootFailure(new Error("App asset failed to load after retry"));
    return;
  }
  sessionStorage.setItem(key, "1");
  await clearOldBrowserCaches();
  window.location.reload();
});

function withBootTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

try {
  createRoot(root).render(<RouterProvider router={router} />);
} catch (error) {
  renderBootFailure(error);
}

void withBootTimeout(restoreSupabaseSession()).catch((error) => {
  console.warn("Session restore failed; continuing app boot", error);
});
