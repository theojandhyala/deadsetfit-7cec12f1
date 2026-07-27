import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "@/lib/storage";
import { listenForWorkoutNotificationTap, syncWorkoutNotifications } from "@/lib/device-reminders";

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
