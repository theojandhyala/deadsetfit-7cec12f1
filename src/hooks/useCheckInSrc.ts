import { useEffect, useState } from "react";

import { resolveCheckInSrc } from "@/lib/progress-photo-store";
import type { CheckIn } from "@/lib/types";

/**
 * A displayable source for a check-in photo, whichever era it comes from.
 *
 * Stored photos need a signed URL minted asynchronously; legacy ones carry
 * their bytes inline and render immediately. Every display site goes through
 * here so neither case is handled twice.
 */
export function useCheckInSrc(checkIn: CheckIn | null | undefined): string | null {
  // Seeded with the inline bytes when they exist, so legacy photos never flash
  // empty while an unnecessary signature is awaited.
  const [src, setSrc] = useState<string | null>(checkIn?.photoDataUrl || null);

  useEffect(() => {
    if (!checkIn) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    setSrc(checkIn.photoDataUrl || null);
    void resolveCheckInSrc(checkIn).then((resolved) => {
      if (!cancelled) setSrc(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [checkIn]);

  return src;
}
