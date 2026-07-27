import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import type { AppState, DayKey, Schedule } from "./types";
import { isNativeIos } from "./platform";

const REMINDER_ID_START = 7100;
const REMINDER_WINDOW_DAYS = 28;
const DAY_KEYS: DayKey[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export type WorkoutReminderDraft = Pick<
  LocalNotificationSchema,
  "id" | "title" | "body" | "schedule" | "extra" | "threadIdentifier"
>;

function reminderIds() {
  return Array.from({ length: REMINDER_WINDOW_DAYS }, (_, index) => ({
    id: REMINDER_ID_START + index,
  }));
}

export function buildWorkoutReminderDrafts(
  schedule: Schedule | null,
  hour = 18,
  minute = 0,
  now = new Date(),
): WorkoutReminderDraft[] {
  if (!schedule) return [];

  const notifications: WorkoutReminderDraft[] = [];
  for (let offset = 0; offset < REMINDER_WINDOW_DAYS; offset++) {
    const at = new Date(now);
    at.setDate(now.getDate() + offset);
    at.setHours(hour, minute, 0, 0);
    if (at.getTime() <= now.getTime()) continue;

    const workout = schedule[DAY_KEYS[at.getDay()]];
    if (!workout?.exerciseIds.length || workout.label === "REST") continue;

    const movementCount = workout.exerciseIds.length;
    notifications.push({
      id: REMINDER_ID_START + offset,
      title: `Today's workout: ${workout.label}`,
      body: `${movementCount} ${movementCount === 1 ? "exercise is" : "exercises are"} ready. Open DEADSET and start strong.`,
      schedule: { at },
      extra: { path: "/train" },
      threadIdentifier: "deadset-workouts",
    });
  }
  return notifications;
}

export async function disableWorkoutNotifications() {
  if (!isNativeIos()) return;
  await LocalNotifications.cancel({ notifications: reminderIds() });
}

export async function syncWorkoutNotifications(
  state: Pick<
    AppState,
    "deviceRemindersEnabled" | "schedule" | "workoutReminderHour" | "workoutReminderMinute"
  >,
) {
  if (!isNativeIos()) return;

  await disableWorkoutNotifications();
  if (!state.deviceRemindersEnabled || !state.schedule) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  const notifications = buildWorkoutReminderDrafts(
    state.schedule,
    state.workoutReminderHour,
    state.workoutReminderMinute,
  );
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

export async function requestWorkoutNotificationPermission() {
  if (!isNativeIos()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

export async function listenForWorkoutNotificationTap(onOpen: (path: string) => void) {
  if (!isNativeIos()) return () => {};
  const listener = await LocalNotifications.addListener(
    "localNotificationActionPerformed",
    ({ notification }) => {
      const path = notification.extra?.path;
      onOpen(typeof path === "string" && path.startsWith("/") ? path : "/train");
    },
  );
  return () => {
    void listener.remove();
  };
}
