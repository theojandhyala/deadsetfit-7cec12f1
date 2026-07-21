import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ChevronLeft,
  Download,
  Upload,
  Bell,
  Droplets,
  Scale,
  ClipboardList,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { askConfirm } from "@/lib/confirm";
import { exportJsonBackup, exportWorkoutCsv } from "@/lib/export";
import { useAppState } from "@/lib/storage";
import { DEFAULT_STATE } from "@/lib/default-state";
import type { AppState } from "@/lib/types";
import { clearSessionDiagnostics, readSessionLogs } from "@/lib/session-diagnostics";
import { connectHealth, healthSupported } from "@/lib/health";
import { Watch } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "DEADSET — Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [state, set] = useAppState();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessionLogs, setSessionLogs] = useState(() => readSessionLogs());

  const reminders = state.remindersEnabled ?? true;
  const health = state.healthSync ?? { enabled: false, importWorkouts: true, exportWorkouts: true };

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
        <button onClick={() => navigate({ to: "/profile" as never })} className="p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <p className="label-cap">Settings</p>
      </header>

      {/* Units — kg only until lb conversion covers every surface honestly */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <Scale size={12} className="text-accent-red" /> Units
        </p>
        <div className="bg-grit-card border border-grit px-4 py-3 flex items-center justify-between">
          <span className="label-cap text-sm text-grit">Kilograms (kg)</span>
          <span className="label-cap text-[9px] text-grit-dim border border-grit rounded px-1.5 py-0.5">
            LB SOON
          </span>
        </div>
        <p className="text-[10px] text-grit-dim mt-2">
          All weights are logged and displayed in kg. Pounds support is coming.
        </p>
      </section>

      {/* Apple Watch & Health — native iOS only */}
      {healthSupported() && (
        <section className="px-5 mb-6">
          <p className="label-cap mb-2 flex items-center gap-1.5">
            <Watch size={12} className="text-accent-red" /> Apple Watch & Health
          </p>
          {!health.enabled ? (
            <div className="bg-grit-card border border-grit p-4">
              <p className="text-sm text-grit font-bold">Pair with Apple Health</p>
              <p className="text-[11px] text-grit-dim mt-1 leading-relaxed">
                Workouts recorded on your Apple Watch count toward your streak and grit, and
                finished DEADSET sessions close your rings.
              </p>
              <button onClick={pairHealth} className="btn-grit w-full mt-3 py-2.5 text-xs">
                Connect Apple Health
              </button>
            </div>
          ) : (
            <>
              <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
                <Toggle
                  label="Import watch workouts"
                  on={health.importWorkouts}
                  onChange={(v) =>
                    set((s) => ({ ...s, healthSync: { ...health, ...s.healthSync, importWorkouts: v } }))
                  }
                />
                <Toggle
                  label="Send sessions to rings"
                  on={health.exportWorkouts}
                  onChange={(v) =>
                    set((s) => ({ ...s, healthSync: { ...health, ...s.healthSync, exportWorkouts: v } }))
                  }
                />
              </div>
              <p className="text-[10px] text-grit-dim mt-2">
                Connected. Watch workouts appear as training days; DEADSET sessions appear in
                Apple Fitness.
              </p>
            </>
          )}
        </section>
      )}

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
            on={state.autoShareWorkouts ?? true}
            onChange={(v) => set((s) => ({ ...s, autoShareWorkouts: v }))}
          />
        </div>
        <p className="text-[10px] text-grit-dim mt-2">
          Shown inside the app while you use it — not device push notifications.
        </p>
      </section>

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
            className="w-full accent-[hsl(var(--accent-red))]"
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

      <section className="px-5 mb-6">
        <p className="label-cap mb-2 flex items-center gap-1.5">
          <ClipboardList size={12} className="text-accent-red" /> Session Logs
        </p>
        <div className="bg-grit-card border border-grit p-4">
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
              sessionLogs.slice(-10).reverse().map((log) => (
                <div key={`${log.at}-${log.event}`} className="border-b border-[#262626] pb-2 last:border-0">
                  <p className="font-bold text-grit">{log.event}</p>
                  <p>{new Date(log.at).toLocaleString()} · {JSON.stringify(log.details ?? {})}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
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
