import { registerPlugin } from "@capacitor/core";

import { isNativeIos } from "./platform";
import { getState } from "./storage";

/**
 * Haptics, with one named function per *meaning* rather than per waveform.
 *
 * The vocabulary is the point: a set tick and a PR must never feel the same,
 * and every call site choosing its own intensity is how that consistency is
 * lost. Callers say what happened; this file decides how it feels.
 *
 * Everything degrades: native iOS gets the Taptic Engine, other platforms fall
 * back to `navigator.vibrate` where it exists, and anywhere else it is a no-op.
 * Nothing here ever throws into a training flow.
 */

type ImpactStyle = "light" | "medium" | "heavy" | "rigid";
type NotificationType = "success" | "warning" | "error";

interface HapticsPlugin {
  impact(options: { style: ImpactStyle }): Promise<void>;
  notification(options: { type: NotificationType }): Promise<void>;
  selection(): Promise<void>;
  pattern(options: { steps: Array<{ style: ImpactStyle; delayMs: number }> }): Promise<void>;
}

const Native = registerPlugin<HapticsPlugin>("Haptics");

/**
 * Haptics are felt, not seen, so they must be switchable — and the preference
 * is read straight from app state on each call rather than mirrored into a
 * module variable that some startup path can forget to initialise. `getState`
 * is version-cached, so this costs a property read.
 *
 * Default on: absent means the athlete has never had an opinion, and the
 * feature is worthless if it has to be discovered before it works.
 */
export function hapticsEnabled(): boolean {
  try {
    return getState().hapticsEnabled !== false;
  } catch {
    return true;
  }
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Safari on iOS has no vibrate, and some browsers throw when the page is
    // not visible. Neither is worth interrupting a workout for.
  }
}

function impact(style: ImpactStyle, fallbackMs: number): void {
  if (!hapticsEnabled()) return;
  if (isNativeIos()) {
    void Native.impact({ style }).catch(() => {});
    return;
  }
  vibrate(fallbackMs);
}

function notify(type: NotificationType, fallback: number[]): void {
  if (!hapticsEnabled()) return;
  if (isNativeIos()) {
    void Native.notification({ type }).catch(() => {});
    return;
  }
  vibrate(fallback);
}

/** A set was recorded. The most frequent haptic in the app — keep it light. */
export function hapticSetLogged(): void {
  impact("medium", 18);
}

/** A warm-up or drop set: real, but not a working set. Lighter than a tick. */
export function hapticSpecialSet(): void {
  impact("light", 10);
}

/** A personal record. Deliberately unmistakable — a double tap, not a tap. */
export function hapticPersonalRecord(): void {
  if (!hapticsEnabled()) return;
  if (isNativeIos()) {
    void Native.pattern({
      steps: [
        { style: "heavy", delayMs: 90 },
        { style: "heavy", delayMs: 90 },
        { style: "rigid", delayMs: 0 },
      ],
    }).catch(() => {});
    return;
  }
  vibrate([30, 60, 30, 60, 50]);
}

/** Rest is over. Must be felt through a pocket. */
export function hapticRestOver(): void {
  notify("success", [60, 40, 60]);
}

/** A countdown beat in the last seconds of rest. */
export function hapticRestTick(): void {
  impact("light", 8);
}

/** The workout is finished. */
export function hapticWorkoutComplete(): void {
  if (!hapticsEnabled()) return;
  if (isNativeIos()) {
    void Native.pattern({
      steps: [
        { style: "medium", delayMs: 110 },
        { style: "medium", delayMs: 110 },
        { style: "heavy", delayMs: 0 },
      ],
    }).catch(() => {});
    return;
  }
  vibrate([40, 80, 40, 80, 80]);
}

/** A multi-step setup flow was saved successfully. */
export function hapticSetupComplete(): void {
  notify("success", [45, 55, 70]);
}

/** A movement was added to or safely changed in the athlete's programme. */
export function hapticPlanUpdated(): void {
  notify("success", [20, 35, 45]);
}

/** Something was undone or deleted. */
export function hapticUndo(): void {
  impact("rigid", 14);
}

/** An action failed or was refused. */
export function hapticFailure(): void {
  notify("error", [80, 50, 80]);
}

/** Moving between values — crown-style scrubbing, picker changes. */
export function hapticSelection(): void {
  if (!hapticsEnabled()) return;
  if (isNativeIos()) {
    void Native.selection().catch(() => {});
    return;
  }
  vibrate(6);
}

/** A milestone landed: rank up, badge, streak record. */
export function hapticMilestone(): void {
  if (!hapticsEnabled()) return;
  if (isNativeIos()) {
    void Native.pattern({
      steps: [
        { style: "light", delayMs: 70 },
        { style: "medium", delayMs: 70 },
        { style: "heavy", delayMs: 0 },
      ],
    }).catch(() => {});
    return;
  }
  vibrate([20, 50, 30, 50, 60]);
}
