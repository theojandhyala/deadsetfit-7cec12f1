import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  enableRemoteSync, disableRemoteSync, hydrateFromRemote,
  clearLocalState, getState,
} from "@/lib/storage";
import { loadUserState, saveUserState } from "@/lib/user-state.functions";

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

    async function pull() {
      try {
        const res = await load();
        if (cancelled) return;
        if (res?.data) {
          try { hydrateFromRemote(JSON.parse(res.data)); } catch { /* ignore */ }
        } else {
          // First sign-in on this account: push whatever's local so it isn't lost.
          const local = getState();
          if (local.profile) {
            await save({ data: { data: JSON.stringify(local) } }).catch(() => {});
          }
        }
        enableRemoteSync(async (json) => { await save({ data: { data: json } }); });
      } catch (e) {
        console.warn("state pull failed", e);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        activeUserId = session.user.id;
        pull();
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === "SIGNED_OUT" || !uid) {
        disableRemoteSync();
        clearLocalState();
        activeUserId = null;
        return;
      }
      if (uid !== activeUserId) {
        activeUserId = uid;
        disableRemoteSync();
        clearLocalState();
        pull();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      disableRemoteSync();
    };
  }, [load, save]);

  return null;
}
