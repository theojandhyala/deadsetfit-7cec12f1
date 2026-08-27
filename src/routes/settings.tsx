import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Download,
  Upload,
  Bell,
  Vibrate,
  Scale,
  BellRing,
  Clock3,
  Droplets,
  ClipboardList,
  Cloud,
  CloudOff,
  FileSpreadsheet,
  Mail,
  PlayCircle,
  Star,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { askConfirm } from "@/lib/confirm";
import { exportJsonBackup, exportWorkoutCsv } from "@/lib/export";
import { isRemoteStateReady, useAppState, waitForRemoteState } from "@/lib/storage";
import { DEFAULT_STATE } from "@/lib/default-state";
import type { AppState } from "@/lib/types";
import { clearSessionDiagnostics, readSessionLogs } from "@/lib/session-diagnostics";
import { connectHealth, healthSupported } from "@/lib/health";
import { watchStatus, watchSupported, type WatchStatus } from "@/lib/watch";
import { hapticSelection, hapticSetLogged } from "@/lib/haptics";
import { DEFAULT_STREAK_ALERT_HOUR } from "@/lib/streak-notifications";
import { Watch } from "lucide-react";
import { isNativeIos } from "@/lib/platform";
import {
  disableWorkoutNotifications,
  requestWorkoutNotificationPermission,
} from "@/lib/device-reminders";
import { supabase } from "@/integrations/supabase/client";
import { resetFeatureTour } from "@/lib/feature-tour";
import { openAppStoreReviewPage } from "@/lib/app-review";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "DEADSET — Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [state, set] = useAppState();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessionLogs, setSessionLogs] = useState(() => readSessionLogs());
  const [appInfo, setAppInfo] = useState<{ version: string; build: string } | null>(null);
  const [account, setAccount] = useState<{
    email: string | null;
    status: "loading" | "signed-out" | "syncing" | "ready" | "offline";
  }>({ email: null, status: "loading" });

  const reminders = state.remindersEnabled ?? true;
  const deviceReminders = state.deviceRemindersEnabled ?? false;
  const reminderHour = state.workoutReminderHour ?? 18;
  const reminderMinute = state.workoutReminderMinute ?? 0;
  const health = state.healthSync ?? { enabled: false, importWorkouts: true, exportWorkouts: true };
  // Lock-screen notifications only exist in the native shell; on the web these
  // toggles would promise something the browser cannot deliver.
  const notificationsSupported = isNativeIos();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      if (!session) {
        setAccount({ email: null, status: "signed-out" });
        return;
      }
      setAccount({ email: session.user.email ?? null, status: "syncing" });
      await waitForRemoteState(session.user.id, 4500);
      if (!active) return;
      setAccount({
        email: session.user.email ?? null,
        status: isRemoteStateReady(session.user.id) ? "ready" : "offline",
      });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isNativeIos()) return;

    let active = true;
    void import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => {
        if (active) setAppInfo({ version: info.version, build: info.build });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  async function pairHealth() {
    const granted = await connectHealth();
    if (granted) {
      set((s) => ({
        ...s,
        healthSync: { importWorkouts: true, exportWorkouts: true, ...s.healthSync, enabled: true },
      }));
      toast.success("Apple Health connected — watch workouts will sync in");
    } else {
      toast.error("Health access not granted. Check Settings → Health → Data Access.");
    }
  }
  const hydration = state.hydrationAlertsEnabled ?? true;
  const waterTarget = state.waterTargetMl ?? 3000;

  async function toggleDeviceReminders(enabled: boolean) {
    if (!enabled) {
      set((s) => ({ ...s, deviceRemindersEnabled: false }));
      await disableWorkoutNotifications().catch(() => {});
      toast.success("Device workout reminders turned off");
      return;
    }

    try {
      const granted = await requestWorkoutNotificationPermission();
      if (!granted) {
        toast.error("Notifications are blocked. Allow them in iPhone Settings to turn this on.");
        return;
      }
      set((s) => ({ ...s, deviceRemindersEnabled: true }));
      toast.success("Workout reminders scheduled for your training days");
    } catch {
      toast.error("Workout reminders could not be enabled");
    }
  }

  async function handleExportJson() {
    try {
      const result = await exportJsonBackup();
      if (result === "delivered") toast.success("Backup exported");
      else if (result === "failed") toast.error("Couldn't export — try again from the share sheet");
      // "cancelled" = user dismissed the native share sheet — stay quiet.
    } catch {
      toast.error("Couldn't export backup");
    }
  }

  async function handleExportCsv() {
    try {
      const result = await exportWorkoutCsv();
      if (result === "delivered") toast.success("Workout history exported");
      else if (result === "empty") toast("No finished workouts to export yet");
      else if (result === "failed") toast.error("Couldn't export — try again from the share sheet");
    } catch {
      toast.error("Couldn't export workout history");
    }
  }

  async function handleRateDeadset() {
    try {
      await openAppStoreReviewPage();
    } catch {
      toast.error("Couldn't open the App Store");
    }
  }

  function importData(file: File) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const parsed = JSON.parse(String(r.result));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("That doesn't look like a DEADSET backup file");
        }
        const ok = await askConfirm({
          title: "Replace all your data?",
          message:
            "This overwrites everything on this device AND your cloud backup with the imported file. This can't be undone.",
          confirmLabel: "Replace",
          danger: true,
        });
        if (!ok) return;
        // Merge over DEFAULT_STATE so an older/partial backup can't leave
        // required fields undefined and crash downstream reducers.
        set(() => ({ ...DEFAULT_STATE, ...(parsed as Partial<AppState>) }) as AppState);
        toast.success("Data imported");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't import file");
      }
    };
    r.readAsText(file);
  }

  async function copySessionLogs() {
    const logs = readSessionLogs();
    setSessionLogs(logs);
    await navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    toast.success("Session logs copied");
  }

  function clearSessionLogs() {
    clearSessionDiagnostics();
    setSessionLogs(readSessionLogs());
    toast.success("Session logs cleared");
  }

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="pb-24">
      <header className="px-5 pt-6 pb-4 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/profile" as never })} className="icon-btn -ml-1">
          <ChevronLeft size={20} />
        </button>
        <p className="label-cap">Settings</p>
      </header>

      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <UserRound size={12} className="text-accent-red" /> Account & Sync
        </p>
        <div className="rounded-lg border border-grit bg-grit-card p-4">
          {account.status === "signed-out" ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-grit">Saved on this device</p>
                <p className="mt-1 text-[11px] leading-relaxed text-grit-dim">
                  Sign in to back up your training and use it on another device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/auth" as never })}
                className="btn-grit shrink-0 px-4 py-2 text-xs"
              >
                Sign in
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-grit bg-black">
                {account.status === "ready" ? (
                  <Cloud size={18} className="text-[#22c55e]" />
                ) : account.status === "syncing" ? (
                  <Cloud size={18} className="animate-pulse text-accent-red" />
                ) : (
                  <CloudOff size={18} className="text-grit-dim" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-grit">
                  {account.email ?? "Checking your account"}
                </p>
                <p className="mt-0.5 text-[11px] text-grit-dim">
                  {account.status === "ready"
                    ? "Cloud backup is ready"
                    : account.status === "offline"
                      ? "Saved locally · cloud backup will retry"
                      : "Checking cloud backup status…"}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <PlayCircle size={12} className="text-accent-red" /> Help
        </p>
        <div className="divide-y divide-[#262626] overflow-hidden rounded-lg border border-grit bg-grit-card">
          <button
            type="button"
            onClick={() => {
              resetFeatureTour();
              navigate({ to: "/train" as never });
            }}
            className="flex w-full items-center justify-between px-4 py-4 text-left"
          >
            <span>
              <span className="block text-sm font-bold text-grit">Replay app tutorial</span>
              <span className="mt-1 block text-[11px] text-grit-dim">
                A one-minute guide to every main feature.
              </span>
            </span>
            <ChevronLeft size={18} className="rotate-180 text-grit-dim" />
          </button>
          {isNativeIos() && (
            <button
              type="button"
              onClick={() => void handleRateDeadset()}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-grit bg-black">
                  <Star size={17} className="text-accent-red" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-grit">Rate DEADSET</span>
                  <span className="mt-1 block text-[11px] text-grit-dim">
                    Leave a rating or review on the App Store.
                  </span>
                </span>
              </span>
              <ChevronLeft size={18} className="rotate-180 text-grit-dim" />
            </button>
          )}
          <a
            href="mailto:support@deadsetfit.org?subject=DEADSET%20Support"
            className="flex w-full items-center justify-between px-4 py-4 text-left"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-grit bg-black">
                <Mail size={17} className="text-accent-red" />
              </span>
              <span>
                <span className="block text-sm font-bold text-grit">Contact support</span>
                <span className="mt-1 block text-[11px] text-grit-dim">
                  Get help with your account, workouts or subscription.
                </span>
              </span>
            </span>
            <ChevronLeft size={18} className="rotate-180 text-grit-dim" />
          </a>
        </div>
      </section>

      {/* Weight calculations use one canonical unit across training and rankings. */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <Scale size={12} className="text-accent-red" /> Units
        </p>
        <div className="bg-grit-card border border-grit px-4 py-3 flex items-center justify-between">
          <span className="label-cap text-sm text-grit">Metric</span>
          <span className="label-cap text-[10px] text-grit-dim">Kilograms (kg)</span>
        </div>
        <p className="text-[10px] text-grit-dim mt-2">
          Workout weights and strength rankings use kilograms consistently.
        </p>
      </section>

      {/* The watch app itself — separate from Health, and worth saying so:
          pairing Health does nothing for the wrist app, and vice versa. */}
      {watchSupported() && <WatchAppCard />}

      {/* Apple Watch & Health — native iOS only */}
      {healthSupported() && (
        <section className="px-5 mb-6">
          <p className="label-cap mb-2 flex items-center gap-1.5">
            <Watch size={12} className="text-accent-red" /> Apple Watch & Health
          </p>
          {!health.enabled ? (
            <div className="bg-grit-card border border-grit p-4" style={{ borderRadius: 8 }}>
              <p className="text-sm text-grit font-bold">Pair with Apple Health</p>
              <p className="text-[11px] text-grit-dim mt-1 leading-relaxed">
                Bring in steps, activity rings, distance, heart rate and workouts from iPhone and
                Apple Watch. Finished DEADSET sessions can close your rings.
              </p>
              <button onClick={pairHealth} className="btn-grit w-full mt-3 py-2.5 text-xs">
                Connect Apple Health
              </button>
            </div>
          ) : (
            <>
              <div
                className="bg-grit-card border border-grit divide-y divide-[#262626]"
                style={{ borderRadius: 8, overflow: "hidden" }}
              >
                <Toggle
                  label="Import watch workouts"
                  on={health.importWorkouts}
                  onChange={(v) =>
                    set((s) => ({
                      ...s,
                      healthSync: { ...health, ...s.healthSync, importWorkouts: v },
                    }))
                  }
                />
                <Toggle
                  label="Send sessions to rings"
                  on={health.exportWorkouts}
                  onChange={(v) =>
                    set((s) => ({
                      ...s,
                      healthSync: { ...health, ...s.healthSync, exportWorkouts: v },
                    }))
                  }
                />
              </div>
              <p className="text-[10px] text-grit-dim mt-2">
                Connected. Your Fitness dashboard includes steps, Move, Exercise, Stand, distance
                and resting heart rate. Watch workouts become training days; DEADSET sessions appear
                in Apple Fitness.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => void pairHealth()}
                  className="btn-secondary flex-1 py-2 text-[10px]"
                >
                  Refresh permissions
                </button>
                <button
                  onClick={() =>
                    set((s) => ({
                      ...s,
                      healthSync: { ...health, ...s.healthSync, enabled: false },
                    }))
                  }
                  className="btn-secondary flex-1 py-2 text-[10px]"
                >
                  Disconnect
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {isNativeIos() && (
        <section className="px-5 mb-6">
          <p className="label-cap mb-2 flex items-center gap-1.5">
            <BellRing size={12} className="text-accent-red" /> iPhone Workout Reminders
          </p>
          <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
            <Toggle
              label="Scheduled-day notifications"
              on={deviceReminders}
              onChange={(enabled) => void toggleDeviceReminders(enabled)}
            />
            {deviceReminders && (
              <label className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <span className="label-cap flex items-center gap-2">
                  <Clock3 size={14} className="text-grit-dim" /> Reminder time
                </span>
                <input
                  type="time"
                  value={`${String(reminderHour).padStart(2, "0")}:${String(reminderMinute).padStart(2, "0")}`}
                  onChange={(event) => {
                    const [hour, minute] = event.target.value.split(":").map(Number);
                    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
                    set((s) => ({
                      ...s,
                      workoutReminderHour: hour,
                      workoutReminderMinute: minute,
                    }));
                  }}
                  aria-label="Workout reminder time"
                  className="min-h-11 rounded-md border border-grit bg-black px-3 text-sm font-bold text-grit"
                />
              </label>
            )}
          </div>
          <p className="text-[10px] text-grit-dim mt-2 leading-relaxed">
            One reminder on each scheduled training day. Changing your weekly plan updates the next
            four weeks automatically.
          </p>
        </section>
      )}

      {/* Units — stored in kg either way; this only changes what is shown. */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <Scale size={12} className="text-accent-red" /> Weight units
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["kg", "lb"] as const).map((option) => {
            const active = (state.units ?? "kg") === option;
            return (
              <button
                key={option}
                onClick={() => {
                  set((s) => ({ ...s, units: option }));
                  hapticSelection();
                }}
                className="rounded-xl border py-3 press"
                style={{
                  borderColor: active ? "#e63222" : "#262626",
                  background: active ? "rgba(230,50,34,0.08)" : "transparent",
                }}
              >
                <span
                  className="display text-lg font-extrabold uppercase"
                  style={{ color: active ? "#e63222" : "#8a8a8a" }}
                >
                  {option}
                </span>
                <span className="label-cap block text-[9px] text-grit-dim">
                  {option === "kg" ? "Kilograms" : "Pounds"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-grit-dim mt-2 leading-relaxed">
          Your history is always stored in kilograms, so switching units never changes a single
          logged set — only how it is shown. Plates and the bar follow your choice too.
        </p>
      </section>

      {/* Haptics */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <Vibrate size={12} className="text-accent-red" /> Haptics
        </p>
        <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
          <Toggle
            label="Vibrate on sets, PRs and rest"
            on={state.hapticsEnabled !== false}
            onChange={(v) => {
              set((s) => ({ ...s, hapticsEnabled: v }));
              // Fire one immediately when switching on, so the setting proves
              // itself instead of asking you to go and train to find out.
              if (v) hapticSetLogged();
            }}
          />
        </div>
        <p className="text-[10px] text-grit-dim mt-2">
          Every set gets a tap, a PR gets a double, and rest ending gets a buzz you can feel through
          a pocket.
        </p>
      </section>

      {/* In-App Nudges */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <Bell size={12} className="text-accent-red" /> In-App Nudges
        </p>
        <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
          <Toggle
            label="Workout Reminders"
            on={reminders}
            onChange={(v) => set((s) => ({ ...s, remindersEnabled: v }))}
          />
          <Toggle
            label="Hydration Alerts"
            on={hydration}
            onChange={(v) => set((s) => ({ ...s, hydrationAlertsEnabled: v }))}
          />
          <Toggle
            label="Auto-share workouts to feed"
            on={state.autoShareWorkouts ?? false}
            onChange={(v) => set((s) => ({ ...s, autoShareWorkouts: v }))}
          />
        </div>
        <p className="text-[10px] text-grit-dim mt-2">
          These cards appear quietly inside DEADSET while you use it.
        </p>
      </section>

      {/* Notifications that arrive on the lock screen */}
      {notificationsSupported && (
        <section className="px-5 mb-6">
          <p className="label-cap mb-2 flex items-center gap-1.5">
            <Bell size={12} className="text-accent-red" /> Notifications
          </p>
          <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
            <Toggle
              label="Streak at risk"
              on={state.streakAlertsEnabled !== false}
              onChange={(v) => {
                set((s) => ({ ...s, streakAlertsEnabled: v }));
                if (v) void requestWorkoutNotificationPermission();
              }}
            />
            <Toggle
              label="Rival activity"
              on={state.rivalAlertsEnabled !== false}
              onChange={(v) => {
                set((s) => ({ ...s, rivalAlertsEnabled: v }));
                if (v) void requestWorkoutNotificationPermission();
              }}
            />
          </div>
          <p className="text-[10px] text-grit-dim mt-2 leading-relaxed">
            Streak warnings arrive at{" "}
            {String(state.streakAlertHour ?? DEFAULT_STREAK_ALERT_HOUR).padStart(2, "0")}:00 on any
            day you haven't logged. Rival nudges cover duels you're losing or about to lose. Both
            are scheduled on this device — DEADSET never watches you from a server.
          </p>
        </section>
      )}

      {/* Hydration target */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <Droplets size={12} className="text-accent-red" /> Daily Water Target
        </p>
        <div className="bg-grit-card border border-grit p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-grit">{(waterTarget / 1000).toFixed(1)} L</span>
            <span className="label-cap text-grit-dim text-[10px]">{waterTarget} ml</span>
          </div>
          <input
            type="range"
            min={1000}
            max={6000}
            step={250}
            value={waterTarget}
            onChange={(e) => set((s) => ({ ...s, waterTargetMl: Number(e.target.value) }))}
            className="h-11 w-full cursor-pointer accent-[hsl(var(--accent-red))]"
          />
        </div>
      </section>

      {/* Data */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <Download size={12} className="text-accent-red" /> Your Data
        </p>
        <div className="bg-grit-card border border-grit p-4 flex flex-col gap-4">
          <div>
            <button
              onClick={handleExportJson}
              className="btn-ghost w-full inline-flex items-center justify-center"
            >
              <Download size={14} className="mr-2" /> Download Backup (JSON)
            </button>
            <p className="text-[10px] text-grit-dim mt-1.5">
              Full backup of everything on this device.
            </p>
          </div>
          <div>
            <button
              onClick={handleExportCsv}
              className="btn-ghost w-full inline-flex items-center justify-center"
            >
              <FileSpreadsheet size={14} className="mr-2" /> Workout History (CSV)
            </button>
            <p className="text-[10px] text-grit-dim mt-1.5">Spreadsheet of every logged set.</p>
          </div>
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-ghost w-full inline-flex items-center justify-center"
            >
              <Upload size={14} className="mr-2" /> Import From File
            </button>
            <p className="text-[10px] text-grit-dim mt-1.5">
              Restores a backup — overwrites current device state.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
            />
          </div>
        </div>
      </section>

      <details className="mx-5 mb-6 rounded-lg border border-grit bg-grit-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-4 label-cap">
          <ClipboardList size={12} className="text-accent-red" /> Troubleshooting
        </summary>
        <div className="border-t border-grit p-4">
          <p className="mb-3 text-[11px] leading-relaxed text-grit-dim">
            Support may ask for these session logs when diagnosing an account problem.
          </p>
          <div className="flex gap-2 mb-3">
            <button onClick={copySessionLogs} className="btn-grit flex-1 text-xs py-2">
              Copy Logs
            </button>
            <button onClick={clearSessionLogs} className="btn-ghost flex-1 text-xs py-2">
              Clear
            </button>
          </div>
          <div className="max-h-36 overflow-auto text-[10px] text-grit-dim space-y-2">
            {sessionLogs.length === 0 ? (
              <p>No session events recorded on this device yet.</p>
            ) : (
              sessionLogs
                .slice(-10)
                .reverse()
                .map((log) => (
                  <div
                    key={`${log.at}-${log.event}`}
                    className="border-b border-[#262626] pb-2 last:border-0"
                  >
                    <p className="font-bold text-grit">{log.event}</p>
                    <p>
                      {new Date(log.at).toLocaleString()} · {JSON.stringify(log.details ?? {})}
                    </p>
                  </div>
                ))
            )}
          </div>
        </div>
      </details>

      <p className="px-5 pb-4 text-center text-[10px] text-grit-dim">
        {appInfo ? `DEADSET ${appInfo.version} (${appInfo.build})` : "DEADSET for iPhone"}
      </p>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={`${label}: ${on ? "on" : "off"}`}
      className="w-full flex items-center justify-between px-4 py-3"
    >
      <span className="label-cap">{label}</span>
      <span
        className={`relative inline-block w-10 h-6 rounded-full transition-colors ${on ? "bg-accent-red" : "bg-[#2a2a2a]"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`}
        />
      </span>
    </button>
  );
}

/**
 * Live status of the wrist app.
 *
 * Deliberately reports what is actually true rather than a single "connected"
 * badge: "paired but not installed" and "installed but out of range" are
 * different problems with different fixes, and collapsing them into one state
 * is how support tickets get written.
 */
function WatchAppCard() {
  const [status, setStatus] = useState<WatchStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      void watchStatus().then((next) => {
        if (!cancelled) setStatus(next);
      });
    };
    read();
    // Reachability changes when the watch goes in and out of range.
    const id = window.setInterval(read, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!status?.supported) return null;

  const detail = !status.paired
    ? "No Apple Watch paired with this iPhone."
    : !status.installed
      ? "Install DEADSET on your watch from the Watch app on iPhone."
      : status.reachable
        ? "Connected. Start a workout on your phone and it appears on your wrist."
        : "Installed. Out of range right now — sets logged on your watch will sync when it reconnects.";

  const tone =
    status.installed && status.reachable ? "#22c55e" : status.installed ? "#8a8a8a" : "#e63222";

  return (
    <section className="px-5 mb-6">
      <p className="label-cap mb-2 flex items-center gap-1.5">
        <Watch size={12} className="text-accent-red" /> DEADSET on Apple Watch
      </p>
      <div className="bg-grit-card border border-grit p-4" style={{ borderRadius: 8 }}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
          <p className="text-sm font-bold text-grit">
            {status.installed ? (status.reachable ? "Connected" : "Out of range") : "Not installed"}
          </p>
        </div>
        <p className="text-[11px] text-grit-dim mt-1.5 leading-relaxed">{detail}</p>
        <p className="text-[10px] text-grit-dim mt-2 leading-relaxed">
          Log sets, holds and rest from your wrist. Your phone stays the record — the watch queues
          anything it logs while you are apart.
        </p>
      </div>
    </section>
  );
}
