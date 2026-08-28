import { useEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { migrateInlinePhotos } from "@/lib/progress-photo-store";
import { getState, setState } from "@/lib/storage";

/**
 * Move photos left inline by an older build into object storage.
 *
 * Runs once per session, in the background, on any screen that shows photos.
 * Without it, moving to storage would help only new check-ins and every
 * athlete who already has a library would stay exactly as stuck as before —
 * which was the entire problem: their cloud backup is already paused.
 *
 * Returns a ref holding the signed-in user id, which the capture path needs
 * to know where to upload.
 */
export function useProgressPhotoMigration() {
  const userIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id ?? null;
      if (cancelled) return;
      userIdRef.current = userId;
      if (!userId || startedRef.current) return;

      // Read from the store rather than the render-time snapshot: the pass is
      // long, and photos taken while it runs must not be clobbered.
      const pending = (getState().checkIns ?? []).filter(
        (checkIn) => !checkIn.photoPath && checkIn.photoDataUrl,
      );
      if (pending.length === 0) return;
      startedRef.current = true;

      await migrateInlinePhotos(pending, userId, (date, migrated) => {
        // Applied one at a time against current state, so a run interrupted by
        // a closed app still banks the photos it finished.
        setState((current) => ({
          ...current,
          checkIns: current.checkIns.map((checkIn) => (checkIn.date === date ? migrated : checkIn)),
        }));
      });
    })();

    return () => {
      cancelled = true;
    };
    // Once per mount. State is read through getState so this never needs to
    // re-run, and re-running it would re-scan the whole library on every edit.
  }, []);

  return userIdRef;
}
