import { useEffect } from "react";

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
  const load = loadUserState;
  const save = saveUserState;

  useEffect(() => {
    let cancelled = false;
    let activeUserId: string | null = null;

    function prepareLocalState(userId: string) {
      // Local training data must never cross account boundaries. This also
      // clears another user's state before the first authenticated sync.
      // Unowned state is allowed through so a brand-new account can finish
      // onboarding and save its first setup instead of having it wiped.
      const owner = getLocalStateOwner();
      if (owner && owner !== userId) clearLocalState();
    }

    async function pull(userId: string) {
      prepareLocalState(userId);
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
          const owner = getLocalStateOwner();
          if (local.profile && (!owner || owner === userId)) {
            setLocalStateOwner(userId);
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

    withTimeout(supabase.auth.getSession(), { data: { session: null }, error: null }).then(
      ({ data: { session } }) => {
        const uid = session?.user?.id;
        // onAuthStateChange also fires on mount — don't pull the same uid twice.
        if (uid && uid !== activeUserId) {
          activeUserId = uid;
          pull(uid);
        }
      },
    );

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === "SIGNED_OUT") {
        // Do not wipe local app state on a transient auth refresh/storage blip.
        // Explicit logout navigates away and clears auth persistence itself.
        disableRemoteSync();
        clearRemoteStateStatus();
        activeUserId = null;
        return;
      }
      if (!uid) return;
      if (uid !== activeUserId) {
        activeUserId = uid;
        disableRemoteSync();
        pull(uid);
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
