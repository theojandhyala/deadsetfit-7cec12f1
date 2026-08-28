import { useEffect } from "react";
import { toast } from "sonner";

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
  setSyncIssueHandler,
  reconcilePendingRemoteState,
} from "@/lib/storage";
import { loadUserState, saveUserState } from "@/lib/user-state.functions";
import { withTimeout } from "@/lib/account-restore";

// Distinct from a genuinely empty account: withTimeout resolves to this when
// the load is too slow, so we don't misread a timeout as "first sign-in".
const LOAD_TIMEOUT = { __loadTimeout: true } as const;

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
    // The row version this device last saw. Sent with every save so the server
    // can refuse a write from a device that has fallen behind another one.
    let baseUpdatedAt: string | null | undefined;
    setSyncIssueHandler((msg) => toast.error(msg, { id: "sync-issue" }));

    function prepareLocalState(userId: string) {
      // Local training data must never cross account boundaries. This also
      // clears another user's state before the first authenticated sync.
      // Unowned state is allowed through so a brand-new account can finish
      // onboarding and save its first setup instead of having it wiped.
      const owner = getLocalStateOwner();
      if (owner && owner !== userId) clearLocalState();
    }

    /**
     * Push local state, guarded by the version this device last saw.
     *
     * A refused write means another device saved since we read. Overwriting it
     * would erase a whole session; refusing loses at most the one change in
     * flight, so we take the remote and let the athlete's next edit push from
     * there.
     */
    async function push(json: string) {
      const result = await save({ data: { data: json, baseUpdatedAt: baseUpdatedAt ?? null } });
      if (result.conflict) {
        baseUpdatedAt = result.updatedAt;
        const fresh = await load();
        baseUpdatedAt = fresh.updatedAt;
        if (fresh.data && activeUserId) {
          try {
            hydrateFromRemote(JSON.parse(fresh.data), activeUserId);
          } catch {
            /* a malformed remote blob is not worth losing local state over */
          }
        }
        return;
      }
      if (result.updatedAt !== undefined) baseUpdatedAt = result.updatedAt;
    }

    async function pull(userId: string) {
      prepareLocalState(userId);
      beginRemoteStateLoad(userId);
      try {
        const res = await Promise.race([
          load(),
          new Promise<typeof LOAD_TIMEOUT>((resolve) =>
            setTimeout(() => resolve(LOAD_TIMEOUT), 4000),
          ),
        ]);
        if (cancelled) return;
        if ("__loadTimeout" in res) {
          // Slow/flaky network — do NOT treat as an empty account (that would
          // push stale local over newer remote we simply couldn't fetch).
          // Enable sync so the user's own later edits still save; skip auto-push.
        } else if (res.data) {
          baseUpdatedAt = res.updatedAt;
          // A foreign/unowned local blob must not merge into this account's
          // remote — clear it first so hydrate is clean.
          if (getLocalStateOwner() !== userId) clearLocalState();
          // Offline edits stashed as pending are NEWER than the remote we just
          // fetched — push them up instead of letting the older remote hydrate
          // over them (which would permanently lose the offline session).
          const localIsNewer =
            getLocalStateOwner() === userId &&
            (await reconcilePendingRemoteState(async (json) => {
              await push(json);
            }));
          if (!localIsNewer) {
            try {
              hydrateFromRemote(JSON.parse(res.data), userId);
            } catch {
              /* ignore */
            }
          }
        } else {
          baseUpdatedAt = res.updatedAt ?? null;
          // Genuinely empty account: back up local ONLY if it already belongs
          // to this user — never push unowned (possibly another user's) state.
          const local = getState();
          if (local.profile && getLocalStateOwner() === userId) {
            await push(JSON.stringify(local)).catch(() => {});
          }
          setLocalStateOwner(userId);
        }
        enableRemoteSync(push);
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
      setSyncIssueHandler(null);
    };
  }, [load, save]);

  return null;
}
