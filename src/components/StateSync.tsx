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
    // Monotonic pull generation: any await inside pull() may resolve after a
    // user switch, and a stale pull must never clear/hydrate/enable for the
    // wrong account.
    let pullSeq = 0;
    setSyncIssueHandler((msg) => toast.error(msg, { id: "sync-issue" }));

    function prepareLocalState(userId: string) {
      // Local training data must never cross account boundaries. This also
      // clears another user's state before the first authenticated sync.
      // Unowned state is allowed through so a brand-new account can finish
      // onboarding and save its first setup instead of having it wiped.
      const owner = getLocalStateOwner();
      if (owner && owner !== userId) clearLocalState();
    }

    async function pull(userId: string, attempt = 0) {
      const seq = ++pullSeq;
      const stale = () => cancelled || seq !== pullSeq || activeUserId !== userId;
      prepareLocalState(userId);
      beginRemoteStateLoad(userId);
      // A load we couldn't complete is NOT license to sync: with a whole-row
      // upsert on the server, enabling push before we know what the row holds
      // lets a fresh device's near-empty state destroy the user's history.
      // Retry instead, with backoff; sync stays off until a load resolves.
      const retryLater = () => {
        if (stale() || attempt >= 5) {
          if (attempt >= 5) {
            toast.error("Can't reach your cloud backup — changes will stay on this device.", {
              id: "sync-issue",
            });
          }
          return;
        }
        setTimeout(() => {
          if (!stale()) void pull(userId, attempt + 1);
        }, 5000 * (attempt + 1));
      };
      try {
        const res = await Promise.race([
          load(),
          new Promise<typeof LOAD_TIMEOUT>((resolve) =>
            setTimeout(() => resolve(LOAD_TIMEOUT), 4000),
          ),
        ]);
        if (stale()) return;
        if ("__loadTimeout" in res) {
          // Slow/flaky network — do NOT treat as an empty account, and do NOT
          // enable sync on an unhydrated device. Try again shortly.
          retryLater();
          return;
        } else if (res.data) {
          // A foreign/unowned local blob must not merge into this account's
          // remote — clear it first so hydrate is clean.
          if (getLocalStateOwner() !== userId) clearLocalState();
          // Offline edits stashed as pending are NEWER than the remote we just
          // fetched — push them up instead of letting the older remote hydrate
          // over them (which would permanently lose the offline session).
          const localIsNewer =
            getLocalStateOwner() === userId &&
            (await reconcilePendingRemoteState(async (json) => {
              await save({ data: { data: json } });
            }, userId));
          if (stale()) return;
          if (!localIsNewer) {
            try {
              hydrateFromRemote(JSON.parse(res.data), userId);
            } catch {
              /* ignore */
            }
          }
        } else {
          // Genuinely empty account: back up local ONLY if it already belongs
          // to this user — never push unowned (possibly another user's) state.
          const local = getState();
          const owner = getLocalStateOwner();
          if (local.profile && owner === userId) {
            await save({ data: { data: JSON.stringify(local) } }).catch(() => {});
            if (stale()) return;
          } else if (!owner && (local.sessions?.length || local.logs?.length || local.checkIns?.length)) {
            // Unowned blob WITH history: this is a previous user's leftover
            // (fresh onboarding has no sessions/photos yet) — never adopt it
            // into a brand-new account.
            clearLocalState();
          }
          setLocalStateOwner(userId);
        }
        enableRemoteSync(async (json) => {
          await save({ data: { data: json } });
        }, userId);
      } catch (e) {
        console.warn("state pull failed", e);
        if (!stale()) retryLater();
      } finally {
        if (!cancelled && seq === pullSeq) finishRemoteStateLoad(userId);
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
