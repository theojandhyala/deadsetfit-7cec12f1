import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  enableRemoteSync,
  disableRemoteSync,
  hydrateFromRemote,
  clearLocalState,
  getState,
  getLocalStateOwner,
  setLocalStateOwner,
  beginRemoteStateLoad,
  finishRemoteStateLoad,
  clearRemoteStateStatus,
} from "@/lib/storage";
import { loadUserState, saveUserState } from "@/lib/user-state.functions";
import { withTimeout } from "@/lib/account-restore";
import { logSessionEvent, recordSessionSnapshot } from "@/lib/session-diagnostics";

/**
 * Mounts once at the root. On sign-in, pulls the user's saved app state from
 * the database into localStorage, then enables debounced push-on-change.
 * On sign-out, clears local state so the next user starts clean.
 */
export function StateSync() {
  const load = useServerFn(loadUserState);
  const save = useServerFn(saveUserState);

  useEffect(() => {
    let cancelled = false;
    let activeUserId: string | null = null;

    async function pull(userId: string) {
      logSessionEvent("state-sync:pull-start", { user: userId.slice(0, 8) });
      beginRemoteStateLoad(userId);
      try {
        // 10s timeout — Cloudflare cold starts can be slow
        const res = await withTimeout(load(), null, 10000);
        if (cancelled) return;
        if (res?.data) {
          try {
            const hydrated = hydrateFromRemote(JSON.parse(res.data), userId);
            if (hydrated) {
              logSessionEvent("state-sync:hydrated-remote", { user: userId.slice(0, 8) });
            } else {
              // User made changes while the pull was in flight — local wins;
              // push it so the fresher local state isn't lost.
              logSessionEvent("state-sync:hydration-skipped-local-newer", {
                user: userId.slice(0, 8),
              });
              await save({ data: { data: JSON.stringify(getState()) } }).catch(() => {});
            }
          } catch (parseErr) {
            // Corrupted state — log but don't crash. Local state stays as-is.
            logSessionEvent("state-sync:hydration-parse-error", {
              user: userId.slice(0, 8),
              message: parseErr instanceof Error ? parseErr.message : "parse failed",
            });
          }
        } else {
          // First sign-in: push existing local state so it isn't lost
          const local = getState();
          if (local.profile && getLocalStateOwner() === userId) {
            await save({ data: { data: JSON.stringify(local) } }).catch((err) => {
              logSessionEvent("state-sync:initial-push-failed", {
                message: err instanceof Error ? err.message : "unknown",
              });
            });
          }
          setLocalStateOwner(userId);
        }
        enableRemoteSync(async (json) => {
          await save({ data: { data: json } }).catch((err) => {
            logSessionEvent("state-sync:push-failed", {
              message: err instanceof Error ? err.message : "unknown",
            });
          });
        });
      } catch (e) {
        logSessionEvent("state-sync:pull-failed", {
          user: userId.slice(0, 8),
          message: e instanceof Error ? e.message : "unknown",
        });
        console.warn("state pull failed", e);
        // Still enable sync so future changes are saved even if initial pull failed
        enableRemoteSync(async (json) => {
          await save({ data: { data: json } }).catch(() => {});
        });
      } finally {
        if (!cancelled) finishRemoteStateLoad(userId);
      }
    }

    withTimeout(supabase.auth.getSession(), { data: { session: null }, error: null }, 8000).then(
      ({ data: { session } }) => {
        recordSessionSnapshot("state-sync:initial", session ?? null);
        if (session?.user?.id) {
          activeUserId = session.user.id;
          pull(session.user.id);
        }
      },
    );

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      logSessionEvent("state-sync:auth-change", { event, hasSession: Boolean(session) });
      if (event === "SIGNED_OUT") {
        disableRemoteSync();
        clearRemoteStateStatus();
        activeUserId = null;
        return;
      }
      if (!uid) return;
      if (uid !== activeUserId) {
        activeUserId = uid;
        disableRemoteSync();
        beginRemoteStateLoad(uid);
        if (getLocalStateOwner() && getLocalStateOwner() !== uid) clearLocalState();
        pull(uid);
      }
    });

    // Proactively refresh session when the user returns to the app.
    // Uses exponential backoff on failure so a flaky network can't leave
    // the user stranded with an expired token.
    const refresh = async () => {
      const attempts = [0, 800, 2400];
      for (let i = 0; i < attempts.length; i++) {
        if (attempts[i]) await new Promise((r) => setTimeout(r, attempts[i]));
        try {
          const { data: { session } } = await supabase.auth.getSession();
          recordSessionSnapshot("state-sync:refresh-check", session ?? null);
          if (!session) return;
          const expiresIn = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
          if (expiresIn >= 300) return;
          const { error } = await supabase.auth.refreshSession();
          if (!error) {
            logSessionEvent("state-sync:session-refreshed", { expiresIn, attempt: i });
            return;
          }
          logSessionEvent("state-sync:refresh-error", {
            attempt: i,
            message: error.message,
          });
        } catch (e) {
          logSessionEvent("state-sync:refresh-throw", {
            attempt: i,
            message: e instanceof Error ? e.message : "unknown",
          });
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refresh);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      disableRemoteSync();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [load, save]);

  return null;
}
