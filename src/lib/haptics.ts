import { Capacitor, registerPlugin } from "@capacitor/core";

type DeadSetFeedbackPlugin = {
  impact(options: { style: "light" | "medium" | "heavy" }): Promise<void>;
  notify(options: { type: "success" | "warning" | "error" }): Promise<void>;
};

const NativeFeedback = registerPlugin<DeadSetFeedbackPlugin>("DeadSetFeedback");

async function nativeOrVibrate(
  native: () => Promise<void>,
  fallback: number | number[],
): Promise<void> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
      await native();
      return;
    }
    navigator.vibrate?.(fallback);
  } catch {
    // Feedback must never block the action it is acknowledging.
  }
}

export function selectionFeedback() {
  return nativeOrVibrate(() => NativeFeedback.impact({ style: "light" }), 8);
}

export function actionFeedback() {
  return nativeOrVibrate(() => NativeFeedback.impact({ style: "medium" }), 14);
}

export function successFeedback() {
  return nativeOrVibrate(() => NativeFeedback.notify({ type: "success" }), [12, 35, 18]);
}
