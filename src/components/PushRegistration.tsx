import { useEffect, useRef } from "react";
import { PushNotifications, type Token } from "@capacitor/push-notifications";

import { supabase } from "@/integrations/supabase/client";
import { isNativeIos } from "@/lib/platform";
import { registerPushToken, updatePushPreference } from "@/lib/push-notifications.functions";
import { useAppState } from "@/lib/storage";

/** Registers only after sign-in and mirrors the opt-out to the server. */
export function PushRegistration() {
  const [state] = useAppState();
  const rivalAlertsEnabled = state.rivalAlertsEnabled !== false;
  const notificationPreferenceConfigured = state.notificationPreferenceConfigured === true;
  const registeredToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isNativeIos()) return;
    let active = true;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || !active) return;
      listeners.push(
        await PushNotifications.addListener("registration", (token: Token) => {
          if (!active) return;
          registeredToken.current = token.value;
          void registerPushToken(token.value, rivalAlertsEnabled).catch((error) =>
            console.warn("push token registration failed", error),
          );
        }),
      );
      listeners.push(
        await PushNotifications.addListener("registrationError", (error) =>
          console.warn("APNs registration failed", error),
        ),
      );
      listeners.push(
        await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
          const path = event.notification.data?.path;
          if (path === "/challenges") window.location.assign("/challenges");
        }),
      );
      const permission = await PushNotifications.checkPermissions();
      if (permission.receive === "granted") await PushNotifications.register();
    })();

    return () => {
      active = false;
      for (const listener of listeners) void listener.remove();
    };
  }, [notificationPreferenceConfigured, rivalAlertsEnabled]);

  useEffect(() => {
    if (!isNativeIos() || !registeredToken.current) return;
    void updatePushPreference(rivalAlertsEnabled).catch((error) =>
      console.warn("push preference sync failed", error),
    );
  }, [rivalAlertsEnabled]);

  return null;
}
