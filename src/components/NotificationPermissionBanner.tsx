import { useCallback, useEffect, useState } from "react";
import { BellRing, Settings } from "lucide-react";

import {
  getWorkoutNotificationPermission,
  requestWorkoutNotificationPermission,
  type NotificationPermissionState,
} from "@/lib/device-reminders";
import { hapticFailure, hapticSaved, hapticSelection } from "@/lib/haptics";
import { openIosAppSettings } from "@/lib/app-review";
import { isNativeIos } from "@/lib/platform";
import { useAppState } from "@/lib/storage";

export function NotificationPermissionBanner({ active }: { active: boolean }) {
  const [state, set] = useAppState();
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!active || !isNativeIos()) return;
    const next = await getWorkoutNotificationPermission();
    setPermission(next);
    if (next === "granted" && !state.notificationPreferenceConfigured) {
      set((current) => ({
        ...current,
        deviceRemindersEnabled: true,
        streakAlertsEnabled: true,
        rivalAlertsEnabled: true,
        notificationPreferenceConfigured: true,
      }));
    }
  }, [active, set, state.notificationPreferenceConfigured]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  if (
    !active ||
    !isNativeIos() ||
    state.notificationPreferenceConfigured ||
    permission === null ||
    permission === "granted" ||
    permission === "unavailable"
  ) {
    return null;
  }

  async function enable() {
    setBusy(true);
    try {
      if (permission === "denied") {
        await openIosAppSettings();
        hapticSelection();
        return;
      }
      const granted = await requestWorkoutNotificationPermission();
      setPermission(granted ? "granted" : "denied");
      set((current) => ({
        ...current,
        deviceRemindersEnabled: granted,
        streakAlertsEnabled: granted,
        rivalAlertsEnabled: granted,
        notificationPreferenceConfigured: granted,
      }));
      if (granted) hapticSaved();
      else hapticFailure();
    } catch {
      hapticFailure();
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    set((current) => ({
      ...current,
      deviceRemindersEnabled: false,
      streakAlertsEnabled: false,
      rivalAlertsEnabled: false,
      notificationPreferenceConfigured: true,
    }));
    hapticSelection();
  }

  return (
    <section className="mx-5 mb-4 overflow-hidden rounded-2xl border border-accent-red/50 bg-grit-card p-4 shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-red/15 text-accent-red">
          <BellRing size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-cap text-[9px] text-accent-red">STAY LOCKED IN</p>
          <p className="display mt-1 text-xl font-black uppercase leading-none text-grit">
            Put DEADSET on your Lock Screen
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-grit-dim">
            Get your scheduled workout, streak-at-risk and rival alerts even when the app is closed.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <button type="button" disabled={busy} onClick={() => void enable()} className="btn-grit min-h-11 text-[10px]">
          {permission === "denied" ? (
            <><Settings size={13} className="mr-1.5" /> Open iPhone Settings</>
          ) : (
            "Enable notifications"
          )}
        </button>
        <button type="button" disabled={busy} onClick={dismiss} className="btn-ghost min-h-11 px-4 text-[10px]">
          Not now
        </button>
      </div>
    </section>
  );
}
