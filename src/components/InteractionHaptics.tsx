import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

import { selectionFeedback } from "@/lib/haptics";

/**
 * Gives the native shell one restrained tactile language without forcing every
 * feature component to know about iOS. Success/warning moments still use their
 * stronger, explicit feedback; this layer is only the light selection tick.
 */
export function InteractionHaptics() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let last = 0;
    const onPointerUp = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest(
        "button:not(:disabled), a[href], [role='button']:not([aria-disabled='true'])",
      );
      if (!control || control.hasAttribute("data-no-haptic")) return;
      const now = performance.now();
      if (now - last < 90) return;
      last = now;
      void selectionFeedback();
    };
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    return () => document.removeEventListener("pointerup", onPointerUp);
  }, []);
  return null;
}
