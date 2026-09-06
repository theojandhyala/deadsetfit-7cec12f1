import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "@/lib/storage";
import { listenForWorkoutNotificationTap, syncWorkoutNotifications } from "@/lib/device-reminders";
import { syncStreakAlerts } from "@/lib/streak-notifications";
import { cancelRivalAlerts, syncRivalAlerts } from "@/lib/rival-notifications";
import { getDuels } from "@/lib/social.functions";
import { isNativeIos } from "@/lib/platform";

export function DeviceReminderSync() {
  const [state] = useAppState();
  const navigate = useNavigate();
  const reminderState = useMemo(
    () => ({
      schedule: state.schedule,
      deviceRemindersEnabled: state.deviceRemindersEnabled,
      workoutReminderHour: state.workoutReminderHour,
      workoutReminderMinute: state.workoutReminderMinute,
    }),
    [
      state.schedule,
      state.deviceRemindersEnabled,
      state.workoutReminderHour,
      state.workoutReminderMinute,
    ],
  );

  useEffect(() => {
    void syncWorkoutNotifications(reminderState).catch((error) => {
      console.warn("Workout reminder sync failed", error);
    });
  }, [reminderState]);

  // Streak warnings are rescheduled whenever the days trained or the setting
  // change — which includes finishing a workout, so logging a session cancels
  // tonight's "your streak ends tonight" rather than sending it anyway.
  const streakState = useMemo(
    () => ({
      completedDates: state.completedDates,
      streakAlertsEnabled: state.streakAlertsEnabled,
      streakAlertHour: state.streakAlertHour,
    }),
    [state.completedDates, state.streakAlertsEnabled, state.streakAlertHour],
  );

  useEffect(() => {
    void syncStreakAlerts(streakState).catch((error) => {
      console.warn("Streak alert sync failed", error);
    });
  }, [streakState]);

  // Duel nudges need the server's view of both scores, so they refresh once per
  // app open rather than on every state change: this is a network call, and the
  // scores cannot move while the athlete is sitting in the app anyway.
  // Keyed on the setting rather than a plain "already ran" flag, so switching
  // the toggle back on fetches again instead of staying silent forever.
  const duelsSyncedFor = useRef<boolean | null | undefined>(undefined);
  const rivalAlertsEnabled = state.rivalAlertsEnabled;
  useEffect(() => {
    if (!isNativeIos()) return;
    if (duelsSyncedFor.current === rivalAlertsEnabled) return;
    duelsSyncedFor.current = rivalAlertsEnabled;

    // Turning it off must clear what is already queued, not merely stop adding
    // to it — otherwise yesterday's nudges keep arriving after you opted out.
    if (rivalAlertsEnabled === false) {
      void cancelRivalAlerts().catch(() => {});
      return;
    }

    void getDuels()
      .then((duels) => syncRivalAlerts(duels ?? [], { rivalAlertsEnabled }))
      .catch((error) => {
        // Signed out, offline, or the call failed — none of which is a reason
        // to surface anything. Yesterday's nudges simply stay as they are.
        console.warn("Rival alert sync skipped", error);
      });
  }, [rivalAlertsEnabled]);

  useEffect(() => {
    let cleanup = () => {};
    void listenForWorkoutNotificationTap((path) => {
      navigate({ to: path as never });
    }).then((remove) => {
      cleanup = remove;
    });
    return () => cleanup();
  }, [navigate]);

  return null;
}
