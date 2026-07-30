import { describe, expect, it } from "vitest";
import {
  extendDeadline,
  restNotification,
  restTimerState,
  REST_NOTIFICATION_ID,
} from "./rest-timer";

const NOW = 1_785_000_000_000;

describe("restTimerState", () => {
  it("counts down from the deadline, not from accumulated ticks", () => {
    const endsAt = NOW + 90_000;

    expect(restTimerState(endsAt, 90, NOW).remaining).toBe(90);
    expect(restTimerState(endsAt, 90, NOW + 30_000).remaining).toBe(60);
    expect(restTimerState(endsAt, 90, NOW + 89_500).remaining).toBe(1);
  });

  it("reports the correct time after the app was suspended past the deadline", () => {
    // The exact case the old timer got wrong: phone locked for five minutes
    // during a 90 second rest. It used to resume mid-countdown.
    const state = restTimerState(NOW + 90_000, 90, NOW + 300_000);

    expect(state.remaining).toBe(0);
    expect(state.done).toBe(true);
  });

  it("never reports negative time", () => {
    expect(restTimerState(NOW, 60, NOW + 10_000).remaining).toBe(0);
  });

  it("grows the total so an extended rest does not overflow the progress bar", () => {
    const state = restTimerState(NOW + 120_000, 90, NOW);

    expect(state.remaining).toBe(120);
    expect(state.total).toBe(120);
  });

  it("is not done while a second remains", () => {
    expect(restTimerState(NOW + 400, 60, NOW).done).toBe(false);
  });
});

describe("extendDeadline", () => {
  it("pushes a running deadline out by the added seconds", () => {
    expect(extendDeadline(NOW + 30_000, 15, NOW)).toBe(NOW + 45_000);
  });

  it("extends from now when the timer already elapsed, so +15s visibly adds 15s", () => {
    expect(extendDeadline(NOW - 60_000, 15, NOW)).toBe(NOW + 15_000);
  });
});

describe("restNotification", () => {
  it("fires at the deadline and names the next exercise", () => {
    const notification = restNotification(NOW + 90_000, "Bench Press");

    expect(notification.id).toBe(REST_NOTIFICATION_ID);
    expect(notification.schedule.at.getTime()).toBe(NOW + 90_000);
    expect(notification.body).toContain("Bench Press");
    // allowWhileIdle matters: without it iOS can defer delivery in Low Power
    // Mode, which is exactly when a phone is sitting idle on a bench.
    expect(notification.schedule.allowWhileIdle).toBe(true);
  });

  it("still says something useful without an exercise name", () => {
    expect(restNotification(NOW, undefined).body).toMatch(/next set/i);
  });

  it("stays clear of the workout reminder id block", () => {
    expect(REST_NOTIFICATION_ID).toBeLessThan(7100);
  });
});
