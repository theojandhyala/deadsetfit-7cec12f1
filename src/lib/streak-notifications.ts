import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";

import { isoDay } from "./calc";
import { currentStreakAsOf } from "./streak-chase";
import { isNativeIos } from "./platform";
import type { AppState } from "./types";

/**
 * "Your streak ends tonight."
 *
 * Entirely local. A streak is computed from `completedDates`, which the phone
 * already has, so this needs no server, no device tokens and no per-user cost —
 * the constraint every feature in this app is held to. It is also *more*
 * reliable than remote push for this particular job: iOS delivers a scheduled
 * local notification at the exact second whether or not the app has run since.
 *
 * Rescheduled on every app open and after every workout, so logging a session
 * cancels tonight's warning rather than sending it anyway.
 */
const STREAK_ID_START = 7200;
/** Today's warning, then tomorrow's as a safety net if the app is never opened. */
const STREAK_WINDOW_DAYS = 2;
/** Nothing is at risk below this: warning about a one-day streak is nagging. */
export const STREAK_ALERT_MINIMUM = 2;
export const DEFAULT_STREAK_ALERT_HOUR = 19;

export type StreakAlertDraft = Pick<
  LocalNotificationSchema,
  "id" | "title" | "body" | "schedule" | "sound" | "extra" | "threadIdentifier"
>;

function streakIds() {
  return Array.from({ length: STREAK_WINDOW_DAYS }, (_, index) => ({
    id: STREAK_ID_START + index,
  }));
}

/** Wording that earns the interruption: specific number, specific stake. */
function copyFor(streak: number, isToday: boolean): { title: string; body: string } {
  if (isToday) {
    return {
      title: `${streak}-day streak ends tonight`,
      body:
        streak >= 30
          ? `${streak} days. Don't let tonight be the one that breaks it.`
          : `Log anything today and it lives to ${streak + 1}.`,
    };
  }
  return {
    title: "Keep the streak alive",
    body: "You haven't logged today. A short session still counts.",
  };
}

/**
 * Warnings for the next couple of evenings.
 *
 * Only today's message can name the streak length, because tomorrow's depends
 * on whether today gets logged — and a notification claiming "your 12-day
 * streak" when it is actually 13 reads as a bug and costs trust in every other
 * number the app shows.
 */
export function buildStreakAlertDrafts(
  state: Pick<AppState, "completedDates" | "streakAlertsEnabled" | "streakAlertHour">,
  now = new Date(),
): StreakAlertDraft[] {
  if (state.streakAlertsEnabled === false) return [];

  const completed = state.completedDates ?? [];
  const today = isoDay(now);
  // currentStreakAsOf, not calculateStreak: the latter reads the system clock,
  // so scheduling computed against an injected `now` would silently disagree
  // with the streak it is warning about.
  const streak = currentStreakAsOf(completed, today);
  if (streak < STREAK_ALERT_MINIMUM) return [];

  const hour = state.streakAlertHour ?? DEFAULT_STREAK_ALERT_HOUR;
  const drafts: StreakAlertDraft[] = [];

  for (let offset = 0; offset < STREAK_WINDOW_DAYS; offset++) {
    const at = new Date(now);
    at.setDate(now.getDate() + offset);
    at.setHours(hour, 0, 0, 0);
    // Already past tonight's slot, or already trained today: nothing to warn about.
    if (at.getTime() <= now.getTime()) continue;
    if (offset === 0 && completed.includes(today)) continue;

    const { title, body } = copyFor(streak, offset === 0);
    drafts.push({
      id: STREAK_ID_START + offset,
      title,
      body,
      schedule: { at },
      sound: "default.wav",
      extra: { path: "/train" },
      threadIdentifier: "deadset-streak",
    });
  }
  return drafts;
}

export async function cancelStreakAlerts() {
  if (!isNativeIos()) return;
  await LocalNotifications.cancel({ notifications: streakIds() });
}

export async function syncStreakAlerts(
  state: Pick<AppState, "completedDates" | "streakAlertsEnabled" | "streakAlertHour">,
) {
  if (!isNativeIos()) return;

  // Always clear first: a session logged since the last sync must remove
  // tonight's warning, and rescheduling on top would leave the stale one.
  await cancelStreakAlerts();
  if (state.streakAlertsEnabled === false) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  const notifications = buildStreakAlertDrafts(state);
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
