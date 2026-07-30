import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { restoreSupabaseSession } from "./integrations/supabase/client";
import { capturePendingRef } from "./lib/referral";
import "./styles.css";

// Exposes the bundled release in diagnostics and scopes asset recovery to this
// deployment so one old CDN race cannot strand later versions.
const RELEASE_ID = "2026-07-28-release1";
const PRELOAD_RETRY_KEY = `deadset_preload_retry_${RELEASE_ID}`;
document.documentElement.dataset.deadsetRelease = RELEASE_ID;

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
  const previousRetry = Number(sessionStorage.getItem(PRELOAD_RETRY_KEY) ?? 0);
  if (previousRetry && Date.now() - previousRetry < 30_000) {
    await clearOldBrowserCaches();
    renderBootFailure(new Error("App asset failed to load after retry"));
    return;
  }
  sessionStorage.setItem(PRELOAD_RETRY_KEY, String(Date.now()));
  await clearOldBrowserCaches();
  window.location.reload();
});

// A successful boot re-arms recovery. This also prevents stale sessionStorage
// copied into a new tab from disabling future release repairs.
window.setTimeout(() => sessionStorage.removeItem(PRELOAD_RETRY_KEY), 10_000);

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
