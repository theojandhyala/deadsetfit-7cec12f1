/**
 * Rest timer that survives leaving the app.
 *
 * The original timer decremented a counter every second with setTimeout. iOS
 * suspends JavaScript timers the moment the app is backgrounded, so locking the
 * phone during rest froze the countdown and it resumed from where it stopped —
 * the one thing a rest timer must never do, since people put the phone down
 * between sets by definition.
 *
 * Two fixes, and they are independent:
 *  - Time from an absolute deadline, never by accumulating ticks. Remaining time
 *    is recomputed from the clock, so suspension cannot drift it.
 *  - Schedule a local notification for the deadline, so the alert arrives even if
 *    the app is suspended or killed outright. Cancelled if rest ends early.
 */
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNativeIos } from "./platform";

/** Kept well clear of device-reminders.ts's 7100+ workout reminder block. */
export const REST_NOTIFICATION_ID = 7001;

export type RestTimerState = {
  /** Whole seconds remaining, never negative. */
  remaining: number;
  /** Total the ring/progress bar is measured against. */
  total: number;
  done: boolean;
};

/** Derives what to display from the deadline and the current clock, so the
 *  result is identical whether the app stayed open or was suspended for a
 *  minute. `now` is injected for tests. */
export function restTimerState(
  endsAt: number,
  totalSeconds: number,
  now = Date.now(),
): RestTimerState {
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return {
    remaining,
    total: Math.max(totalSeconds, remaining),
    done: remaining <= 0,
  };
}

/** Extending rest moves the deadline rather than nudging a counter, so the
 *  scheduled notification and the display stay in agreement. */
export function extendDeadline(endsAt: number, addSeconds: number, now = Date.now()): number {
  // Extending after the timer has already elapsed should add to now, not to a
  // deadline in the past — otherwise "+15s" appears to do nothing.
  return Math.max(endsAt, now) + addSeconds * 1000;
}

export function restNotification(endsAt: number, exerciseName?: string) {
  return {
    id: REST_NOTIFICATION_ID,
    title: "Rest over",
    body: exerciseName ? `Next set: ${exerciseName}` : "Back to work — next set is ready.",
    schedule: { at: new Date(endsAt), allowWhileIdle: true },
    sound: undefined,
    threadIdentifier: "deadset-rest",
  };
}

/** The Live Activity plugin (ios/App/App/RestActivityPlugin.swift). Absent on
 *  web and on builds made before the widget extension was added, so every call
 *  is optional. */
type RestActivityPlugin = {
  isSupported(): Promise<{ supported: boolean }>;
  start(options: {
    endsAt: number;
    totalSeconds: number;
    exerciseName: string;
  }): Promise<{ started: boolean }>;
  end(): Promise<void>;
};

function restActivityPlugin(): RestActivityPlugin | undefined {
  if (!isNativeIos()) return undefined;
  return (window as typeof window & { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor
    ?.Plugins?.RestActivity as RestActivityPlugin | undefined;
}

/** Fire-and-forget: a notification that fails to schedule must never break the
 *  in-app timer, which is still the primary experience. */
export async function scheduleRestAlert(endsAt: number, exerciseName?: string): Promise<void> {
  if (!isNativeIos()) return;
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") return;
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({ notifications: [restNotification(endsAt, exerciseName)] });
  } catch {
    /* the on-screen timer is unaffected */
  }
}

/** Shows rest on the Dynamic Island and Lock Screen. The system counts down to
 *  `endsAt` on its own, so this is called once per rest period rather than every
 *  second — iOS rate-limits Live Activity updates. */
export async function startRestActivity(
  endsAt: number,
  totalSeconds: number,
  exerciseName?: string,
): Promise<void> {
  const plugin = restActivityPlugin();
  if (!plugin) return;
  try {
    await plugin.start({
      endsAt,
      totalSeconds,
      exerciseName: exerciseName ?? "Next set",
    });
  } catch {
    /* the on-screen timer is unaffected */
  }
}

export async function endRestActivity(): Promise<void> {
  const plugin = restActivityPlugin();
  if (!plugin) return;
  try {
    await plugin.end();
  } catch {
    /* nothing to end */
  }
}

/** Rest is over or was skipped: clear both the pending alert and the island. */
export async function cancelRestAlert(): Promise<void> {
  await endRestActivity();
  if (!isNativeIos()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
  } catch {
    /* nothing to cancel */
  }
}
