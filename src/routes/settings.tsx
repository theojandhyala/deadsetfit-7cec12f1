import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ChevronLeft, Download, Upload, Bell, Droplets, Scale, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { askConfirm } from "@/lib/confirm";
import { useAppState } from "@/lib/storage";
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

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deadset-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  }

  function importData(file: File) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const parsed = JSON.parse(String(r.result));
        if (!parsed || typeof parsed !== "object") throw new Error("Invalid file");
        const ok = await askConfirm({
          title: "Replace local data?",
          message: "Everything on this device is overwritten with the imported file.",
          confirmLabel: "Replace",
          danger: true,
        });
        if (!ok) return;
        set(() => parsed);
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
        <p className="label-cap mb-2">Your Data</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={exportData}
            className="btn-grit w-full inline-flex items-center justify-center"
          >
            <Download size={14} className="mr-2" /> Export All Data (JSON)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-ghost w-full inline-flex items-center justify-center"
          >
            <Upload size={14} className="mr-2" /> Import From File
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
          />
        </div>
        <p className="text-[10px] text-grit-dim mt-2">
          Export a full backup of your local training data. Import will overwrite current device
          state.
        </p>
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
