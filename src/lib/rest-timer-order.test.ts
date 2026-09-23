import { beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ enabled: true }));
const notifications = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
}));
vi.mock("./platform", () => ({ isNativeIos: () => native.enabled }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: notifications }));
import { cancelRestAlert, scheduleRestAlert } from "./rest-timer";

beforeEach(() => {
  vi.clearAllMocks();
  native.enabled = true;
  // This suite tests the notification queue; no native Activity plugin is present.
  vi.stubGlobal("window", {});
  notifications.checkPermissions.mockResolvedValue({ display: "granted" });
  notifications.cancel.mockResolvedValue(undefined);
  notifications.schedule.mockResolvedValue(undefined);
});
describe("rest alert ordering", () => {
  it("cancels after a delayed schedule instead of resurrecting a skipped rest", async () => {
    let allow!: (permission: { display: string }) => void;
    notifications.checkPermissions.mockReturnValueOnce(
      new Promise((resolve) => {
        allow = resolve;
      }),
    );
    const events: string[] = [];
    notifications.cancel.mockImplementation(async () => {
      events.push("cancel");
    });
    notifications.schedule.mockImplementation(async () => {
      events.push("schedule");
    });
    const schedule = scheduleRestAlert(Date.now() + 60000);
    const cancel = cancelRestAlert();
    await Promise.resolve();
    allow({ display: "granted" });
    await Promise.all([schedule, cancel]);
    expect(events).toEqual(["cancel", "schedule", "cancel"]);
  });
  it("keeps the latest extension as the final scheduled deadline", async () => {
    await Promise.all([scheduleRestAlert(1000), scheduleRestAlert(2000), scheduleRestAlert(3000)]);
    expect(
      notifications.schedule.mock.calls.map(([args]) =>
        args.notifications[0].schedule.at.getTime(),
      ),
    ).toEqual([1000, 2000, 3000]);
  });
  it("recovers after a native schedule failure", async () => {
    notifications.schedule.mockRejectedValueOnce(new Error("offline"));
    await scheduleRestAlert(1000);
    await scheduleRestAlert(2000);
    expect(notifications.schedule).toHaveBeenCalledTimes(2);
  });
  it("does not schedule without notification permission", async () => {
    notifications.checkPermissions.mockResolvedValueOnce({ display: "denied" });
    await scheduleRestAlert(1000);
    expect(notifications.schedule).not.toHaveBeenCalled();
  });
  it("keeps the web timer independent of native APIs", async () => {
    native.enabled = false;
    await scheduleRestAlert(1000);
    await cancelRestAlert();
    expect(notifications.checkPermissions).not.toHaveBeenCalled();
    expect(notifications.cancel).not.toHaveBeenCalled();
  });
});
