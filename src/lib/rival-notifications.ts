import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";

import { isNativeIos } from "./platform";
import type { AppState } from "./types";
import type { Duel, DuelMetric } from "./social.functions";

/**
 * Rival pressure, delivered locally.
 *
 * What this deliberately is not: a real-time "your rival just logged" push.
 * That needs a server holding device tokens and reacting to someone else's
 * write, which breaks the app's hard rule that every feature costs nothing per
 * user. See docs/AUTOMATIONS.md for the APNs design if that trade is ever
 * revisited.
 *
 * What it is instead: the same retention lever built from facts the phone
 * already learned the last time it opened. A duel score is a known quantity and
 * a duel deadline is a known time, so "you are 2,400 kg behind with a day left"
 * can be scheduled ahead and fires whether or not the app ever runs again. In
 * practice that is the message that gets someone back into the gym — being
 * told the instant a rival finishes a set is not.
 */
const RIVAL_ID_START = 7300;
/** Bounded so a heavy duel user cannot fill their own notification centre. */
const MAX_RIVAL_ALERTS = 4;
const HOUR_MS = 3_600_000;

export type RivalAlertDraft = Pick<
  LocalNotificationSchema,
  "id" | "title" | "body" | "schedule" | "extra" | "threadIdentifier"
>;

function rivalIds() {
  return Array.from({ length: MAX_RIVAL_ALERTS }, (_, index) => ({
    id: RIVAL_ID_START + index,
  }));
}

function opponentName(duel: Duel): string {
  const { display_name: displayName, username } = duel.opponent;
  return displayName?.trim() || (username ? `@${username}` : "Your rival");
}

/** Units the gap is measured in, written the way the app writes them. */
function gapText(metric: DuelMetric, gap: number): string {
  const rounded = Math.round(gap);
  if (metric === "volume") return `${rounded.toLocaleString()} kg`;
  if (metric === "prs") return `${rounded} ${rounded === 1 ? "PR" : "PRs"}`;
  return `${rounded} ${rounded === 1 ? "session" : "sessions"}`;
}

/** Tomorrow morning, local time — the moment someone plans their day. */
function nextMorning(now: Date, hour = 9): Date {
  const at = new Date(now);
  at.setDate(now.getDate() + 1);
  at.setHours(hour, 0, 0, 0);
  return at;
}

/**
 * Build the nudges worth sending.
 *
 * Ordered by urgency, then truncated — a duel ending tonight matters more than
 * one ending next week, and four notifications is already the ceiling of what
 * anyone tolerates from a fitness app.
 */
export function buildRivalAlertDrafts(
  duels: Duel[],
  state: Pick<AppState, "rivalAlertsEnabled">,
  now = new Date(),
): RivalAlertDraft[] {
  if (state.rivalAlertsEnabled === false) return [];

  type Candidate = { priority: number; at: Date; title: string; body: string };
  const candidates: Candidate[] = [];

  for (const duel of duels ?? []) {
    const name = opponentName(duel);

    // A challenge nobody answered is a dead duel — chase it first.
    if (duel.status === "pending" && duel.needsMyResponse) {
      candidates.push({
        priority: 0,
        at: nextMorning(now),
        title: `${name} challenged you`,
        body: "Accept the duel and settle it in the gym.",
      });
      continue;
    }

    if (duel.status !== "active" || duel.ended) continue;

    const behindBy = duel.theirScore - duel.myScore;
    const endsAt = duel.end_at ? new Date(duel.end_at).getTime() : NaN;
    const hoursLeft = Number.isFinite(endsAt) ? (endsAt - now.getTime()) / HOUR_MS : Infinity;
    if (hoursLeft <= 0) continue;

    // Running out of time and losing: the only genuinely urgent case.
    if (hoursLeft <= 48 && behindBy > 0) {
      // Fire in the morning, unless the duel ends before that — then move it
      // earlier rather than sending a warning after the result is settled.
      const morning = nextMorning(now);
      const at =
        Number.isFinite(endsAt) && morning.getTime() >= endsAt
          ? new Date(Math.max(now.getTime() + HOUR_MS, endsAt - 3 * HOUR_MS))
          : morning;
      if (at.getTime() <= now.getTime()) continue;
      candidates.push({
        priority: 1,
        at,
        title: `${Math.max(1, Math.round(hoursLeft))}h left against ${name}`,
        body: `You're ${gapText(duel.metric, behindBy)} behind. Still time to take it.`,
      });
      continue;
    }

    if (behindBy > 0) {
      candidates.push({
        priority: 2,
        at: nextMorning(now),
        title: `${name} is ahead of you`,
        body: `${gapText(duel.metric, behindBy)} in it. Log today and close the gap.`,
      });
      continue;
    }

    // Ahead, and close enough that it could turn: worth defending.
    const leadBy = duel.myScore - duel.theirScore;
    if (leadBy > 0 && duel.myScore > 0 && leadBy / Math.max(1, duel.myScore) < 0.15) {
      candidates.push({
        priority: 3,
        at: nextMorning(now),
        title: `${name} is closing in`,
        body: `Only ${gapText(duel.metric, leadBy)} in it. Don't hand it back.`,
      });
    }
  }

  return candidates
    .sort((a, b) => a.priority - b.priority || a.at.getTime() - b.at.getTime())
    .slice(0, MAX_RIVAL_ALERTS)
    .map((candidate, index) => ({
      id: RIVAL_ID_START + index,
      title: candidate.title,
      body: candidate.body,
      schedule: { at: candidate.at },
      extra: { path: "/challenges" },
      threadIdentifier: "deadset-rivals",
    }));
}

export async function cancelRivalAlerts() {
  if (!isNativeIos()) return;
  await LocalNotifications.cancel({ notifications: rivalIds() });
}

export async function syncRivalAlerts(duels: Duel[], state: Pick<AppState, "rivalAlertsEnabled">) {
  if (!isNativeIos()) return;

  // Clear first: a duel that ended, or one you have since pulled ahead in,
  // must not leave yesterday's "you're behind" sitting in the queue.
  await cancelRivalAlerts();
  if (state.rivalAlertsEnabled === false) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  const notifications = buildRivalAlertDrafts(duels, state);
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
