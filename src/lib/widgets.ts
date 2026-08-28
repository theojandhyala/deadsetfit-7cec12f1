import { registerPlugin } from "@capacitor/core";

import { calculateGritScore, calculateStreak, defaultSchedule, isoDay, todayKey } from "./calc";
import { isNativeIos } from "./platform";
import { getRank } from "./rank";
import type { AppState } from "./types";

/**
 * The numbers the home-screen and Lock Screen widgets draw.
 *
 * A widget runs in its own process and cannot reach the WKWebView where
 * DEADSET keeps its state, so the app hands this over whenever the numbers
 * change and the widget reads it out of a shared App Group container.
 */
export interface WidgetSnapshot {
  streak: number;
  trainedToday: boolean;
  todayLabel: string;
  todayExerciseCount: number;
  rankLabel: string;
  rankColorHex: string;
  gritPoints: number;
  rankProgress: number;
  weekDone: number;
  weekTarget: number;
}

interface WidgetsPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  publish(snapshot: WidgetSnapshot): Promise<{ published: boolean }>;
}

const Widgets = registerPlugin<WidgetsPlugin>("Widgets");

/** Monday-start ISO days for the week containing `today`. */
function weekDays(today: string): string[] {
  const base = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return [];
  const mondayOffset = (base.getUTCDay() + 6) % 7;
  const monday = new Date(base.getTime() - mondayOffset * 86_400_000);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * Project app state down to what a widget can show.
 *
 * Pure and exported so it can be tested without a device — a widget is the one
 * surface nobody looks at while developing, so a wrong field here would sit on
 * someone's home screen for weeks before anyone noticed.
 */
export function buildWidgetSnapshot(state: AppState, today = isoDay()): WidgetSnapshot {
  const completed = state.completedDates ?? [];
  const grit = calculateGritScore(state).total;
  const rank = getRank(grit);

  const schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
  const day = schedule?.[todayKey()];
  const exerciseIds = day?.exerciseIds ?? [];
  // A day with a label but no movements is a rest day in everything but name,
  // and the widget should say "rest" rather than offer an empty workout.
  const isRest = exerciseIds.length === 0 || (day?.label ?? "").toUpperCase() === "REST";

  const thisWeek = new Set(weekDays(today));
  const weekDone = completed.filter((date) => thisWeek.has(date)).length;

  // Progress through the current rank band, not toward some absolute ceiling.
  const span = Math.max(1, rank.maxPoints - rank.minPoints);
  const rankProgress = Math.min(1, Math.max(0, (grit - rank.minPoints) / span));

  return {
    streak: calculateStreak(completed),
    trainedToday: completed.includes(today),
    todayLabel: isRest ? "" : (day?.label ?? ""),
    todayExerciseCount: isRest ? 0 : exerciseIds.length,
    rankLabel: rank.label,
    rankColorHex: rank.color,
    gritPoints: grit,
    rankProgress,
    weekDone,
    weekTarget: state.profile?.daysPerWeek ?? 0,
  };
}

/**
 * Push the current numbers to the widgets. A no-op off native iOS, and never
 * throws: a widget that fails to update must not interrupt anything.
 */
export async function publishWidgets(state: AppState): Promise<void> {
  if (!isNativeIos()) return;
  try {
    await Widgets.publish(buildWidgetSnapshot(state));
  } catch {
    // Most likely the App Group is not on the provisioning profile. Widgets
    // then show their empty state, which is the correct visible outcome.
  }
}
