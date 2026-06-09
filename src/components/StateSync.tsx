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
      beginRemoteStateLoad(userId);
      try {
        const res = await withTimeout(load(), null);
        if (cancelled) return;
        if (res?.data) {
          try {
            hydrateFromRemote(JSON.parse(res.data), userId);
          } catch {
            /* ignore */
          }
        } else {
          // First sign-in on this account: push whatever's local so it isn't lost.
          const local = getState();
          if (local.profile && getLocalStateOwner() === userId) {
            await save({ data: { data: JSON.stringify(local) } }).catch(() => {});
          }
          setLocalStateOwner(userId);
        }
        enableRemoteSync(async (json) => {
          await save({ data: { data: json } });
        });
      } catch (e) {
        console.warn("state pull failed", e);
      } finally {
        if (!cancelled) finishRemoteStateLoad(userId);
      }
    }

    withTimeout(supabase.auth.getSession(), { data: { session: null }, error: null }).then(({ data: { session } }) => {
      if (session?.user?.id) {
        activeUserId = session.user.id;
        pull(session.user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === "SIGNED_OUT") {
        disableRemoteSync();
        clearLocalState();
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

    // Proactively refresh session when the user returns to the app
    const refresh = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const expiresIn = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
          if (expiresIn < 300) {
            await supabase.auth.refreshSession();
          }
        }
      } catch { /* ignore */ }
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
