import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Flame,
  MapPinned,
  Pause,
  Play,
  Settings,
  Share2,
  Square,
  Trash2,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useAppState } from "@/lib/storage";
import { RunMap } from "@/components/RunMap";
import { RunAdvanced } from "@/components/RunAdvanced";
import {
  avgPace,
  bestKmPace,
  computeSplits,
  elevationGain,
  formatDistance,
  formatDuration,
  formatPace,
  haversine,
  smoothGpsFix,
} from "@/lib/run";
import type { Run, RunSample } from "@/lib/types";

export const Route = createFileRoute("/_tabs/run")({
  head: () => ({ meta: [{ title: "DEADSET — Run" }] }),
  component: RunPage,
});

type View = "hub" | "live" | "detail";

function RunPage() {
  const [state, setState] = useAppState();
  const runs = (state.runs ?? []).slice().sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const [view, setView] = useState<View>("hub");
  const [detailId, setDetailId] = useState<string | null>(null);

  if (view === "live") {
    return (
      <LiveRunner
        onFinish={(run) => {
          if (run) {
            setState((s) => ({ ...s, runs: [...(s.runs ?? []), run] }));
            setDetailId(run.id);
            setView("detail");
          } else {
            setView("hub");
          }
        }}
      />
    );
  }

  if (view === "detail" && detailId) {
    const run = runs.find((r) => r.id === detailId);
    if (run) {
      return (
        <RunDetail
          run={run}
          allRuns={runs}
          onBack={() => setView("hub")}
          onDelete={() => {
            setState((s) => ({
              ...s,
              runs: (s.runs ?? []).filter((r) => r.id !== run.id),
            }));
            setView("hub");
          }}
        />
      );
    }
  }

  return (
    <RunHub
      runs={runs}
      onStart={() => setView("live")}
      onOpen={(id) => {
        setDetailId(id);
        setView("detail");
      }}
    />
  );
}

/* ====================== HUB ====================== */

function RunHub({
  runs,
  onStart,
  onOpen,
}: {
  runs: Run[];
  onStart: () => void;
  onOpen: (id: string) => void;
}) {
  const totals = runs.reduce(
    (acc, r) => {
      acc.distance += r.distanceM;
      acc.duration += r.durationSec;
      acc.count += 1;
      return acc;
    },
    { distance: 0, duration: 0, count: 0 },
  );

  // Weekly distance
  const now = Date.now();
  const weekStart = now - 7 * 24 * 3600 * 1000;
  const weekRuns = runs.filter((r) => new Date(r.date).getTime() >= weekStart);
  const weekDist = weekRuns.reduce((s, r) => s + r.distanceM, 0);
  const latestRun = runs[0];
  const bestRun = runs.reduce<Run | null>((best, r) => !best || r.distanceM > best.distanceM ? r : best, null);

  return (
    <div className="px-4 pt-6 pb-24 max-w-screen-sm mx-auto space-y-5">
      <header className="space-y-1">
        <p className="label-cap text-[10px] text-grit-dim">RUN · GPS TRACKER</p>
        <h1 className="display text-3xl font-extrabold uppercase text-grit tracking-tight">
          Lace up.
        </h1>
        <p className="text-sm text-grit-dim">
          Track every step, chase routes, and push it to the crew.
        </p>
      </header>

      {/* Start CTA */}
      <button
        onClick={onStart}
        className="w-full bg-accent-red text-white py-5 flex items-center justify-center gap-3 font-extrabold uppercase tracking-widest text-sm hover:bg-accent-red/90 transition-colors border border-accent-red"
        style={{ boxShadow: "0 0 24px rgba(230,50,34,0.35)" }}
      >
        <Play size={20} strokeWidth={3} fill="currentColor" />
        Start a run
      </button>

      {/* Totals grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="This week" value={formatDistance(weekDist)} />
        <StatBlock label="Total runs" value={String(totals.count)} />
        <StatBlock label="All-time" value={formatDistance(totals.distance)} />
      </div>

      <section className="bg-grit-card border border-grit p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label-cap text-[10px] text-accent-red">SOCIAL RUNNING</p>
            <h2 className="display text-xl font-extrabold uppercase text-grit leading-none mt-1">
              Your next route matters.
            </h2>
          </div>
          <Link to="/friends" className="btn-grit px-3 py-2 text-[10px] gap-1">
            <Users size={14} /> Crew
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniCue icon={<MapPinned size={14} />} label="Trail map" value="Topo" />
          <MiniCue icon={<Flame size={14} />} label="Best route" value={bestRun ? formatDistance(bestRun.distanceM) : "—"} />
          <MiniCue icon={<Share2 size={14} />} label="Share" value={latestRun ? "Ready" : "After run"} />
        </div>
      </section>

      {/* History */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="label-cap text-xs text-grit">History</h2>
          {runs.length > 0 && (
            <span className="text-[10px] uppercase tracking-wider text-grit-dim">
              {runs.length} {runs.length === 1 ? "run" : "runs"}
            </span>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="bg-grit-card border border-grit p-8 flex flex-col items-center text-center gap-3">
            <div className="p-4 border border-grit text-grit-dim">
              <Activity size={32} />
            </div>
            <p className="display text-lg font-extrabold uppercase text-grit tracking-wide">
              No runs yet
            </p>
            <p className="text-xs text-grit-dim uppercase tracking-wider">
              Hit start. Your route will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onOpen(r.id)}
                  className="w-full bg-grit-card border border-grit hover:border-accent-red transition-colors text-left flex gap-3 p-3"
                >
                  <div className="w-20 h-20 flex-shrink-0">
                    <RunMap samples={r.samples} height={80} showMarkers={false} thumbnail />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="display text-sm font-extrabold uppercase text-grit tracking-wide truncate">
                          {labelRun(r)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-grit-dim mt-0.5">
                          {formatRunDate(r.date)}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-grit-dim flex-shrink-0" />
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="display text-lg font-extrabold text-accent-red leading-none">
                        {(r.distanceM / 1000).toFixed(2)}
                        <span className="text-[10px] font-bold text-grit-dim uppercase ml-0.5">km</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-grit-dim">
                        {formatDuration(r.durationSec)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-grit-dim">
                        {formatPace(r.avgPaceSecPerKm)}/km
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[10px] uppercase tracking-wider text-grit-dim text-center pt-2">
        <Link to="/train" className="hover:text-accent-red">← Back to Train</Link>
      </p>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-grit-card border border-grit p-3 flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-widest text-grit-dim">{label}</span>
      <span className="display text-lg font-extrabold text-grit leading-none">{value}</span>
    </div>
  );
}

/* ====================== LIVE TRACKER ====================== */

type Status = "ready" | "running" | "paused" | "finished";

function LiveRunner({ onFinish }: { onFinish: (run: Run | null) => void }) {
  const [status, setStatus] = useState<Status>("ready");
  const [samples, setSamples] = useState<RunSample[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [previewPos, setPreviewPos] = useState<{ lat: number; lng: number } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  // GPS quality metrics
  const [fixCount, setFixCount] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);
  const [speedAnomaly, setSpeedAnomaly] = useState(false);
  const [rawSpeed, setRawSpeed] = useState<number | null>(null);
  const [lastFixTime, setLastFixTime] = useState<number | null>(null);

  // Refs to avoid stale closures inside watchPosition
  const statusRef = useRef<Status>(status);
  statusRef.current = status;
  const samplesRef = useRef<RunSample[]>([]);
  samplesRef.current = samples;
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0); // total paused ms
  const pausedAtRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const previewWatchRef = useRef<number | null>(null);
  const fixCountRef = useRef(0);
  const rejectCountRef = useRef(0);
  const lastRawPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Timer
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      const totalElapsed = (Date.now() - startedAtRef.current - pausedAccumRef.current) / 1000;
      setElapsedSec(Math.max(0, totalElapsed));
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  // Acquire GPS in ready state so user sees their position before starting
  useEffect(() => {
    if (status !== "ready") return;
    if (!("geolocation" in navigator)) {
      setError("GPS not supported on this device.");
      return;
    }
    previewWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsAccuracy(pos.coords.accuracy);
        setPreviewPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLastFixTime(Date.now());
        setError(null);
      },
      (err) => setError(err.message || "GPS error"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => {
      if (previewWatchRef.current !== null) {
        navigator.geolocation.clearWatch(previewWatchRef.current);
        previewWatchRef.current = null;
      }
    };
  }, [status]);

  const start = () => {
    if (!("geolocation" in navigator)) {
      setError("GPS not supported on this device.");
      return;
    }
    // Clear preview watch
    if (previewWatchRef.current !== null) {
      navigator.geolocation.clearWatch(previewWatchRef.current);
      previewWatchRef.current = null;
    }
    setError(null);
    startedAtRef.current = Date.now();
    pausedAccumRef.current = 0;
    setSamples([]);
    setElapsedSec(0);
    setStatus("running");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (statusRef.current !== "running") return;
        const { latitude, longitude, accuracy, altitude, speed } = pos.coords;
        const now = Date.now();
        setGpsAccuracy(accuracy);
        setLastFixTime(now);

        // Raw speed from device (m/s)
        const deviceSpeed = speed ?? null;
        setRawSpeed(deviceSpeed);

        const t = now - startedAtRef.current - pausedAccumRef.current;
        const prev = samplesRef.current[samplesRef.current.length - 1];

        // Compute raw instantaneous speed for anomaly detection
        let instantSpeed: number | null = null;
        if (lastRawPosRef.current) {
          const rawDist = haversine(
            { lat: lastRawPosRef.current.lat, lng: lastRawPosRef.current.lng },
            { lat: latitude, lng: longitude },
          );
          const dt = (now - lastRawPosRef.current.time) / 1000;
          if (dt > 0) instantSpeed = rawDist / dt;
        }
        lastRawPosRef.current = { lat: latitude, lng: longitude, time: now };

        const result = smoothGpsFix(prev, {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ?? undefined,
          altitude,
          timeMs: t,
        });
        if (!result.accepted) {
          rejectCountRef.current += 1;
          setRejectCount(rejectCountRef.current);
          // Flag speed anomaly if instant speed is impossibly high
          if (instantSpeed != null && instantSpeed > 10) {
            setSpeedAnomaly(true);
            setTimeout(() => setSpeedAnomaly(false), 3000);
          }
          return;
        }
        fixCountRef.current += 1;
        setFixCount(fixCountRef.current);
        const next: RunSample = {
          t,
          lat: result.lat,
          lng: result.lng,
          d: result.d,
          total: result.total,
          acc: result.acc,
          alt: result.alt,
        };
        setSamples((s) => [...s, next]);
      },
      (err) => {
        setError(err.message || "GPS error");
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    // Keep screen awake if supported
    requestWakeLock();
  };


  const pause = () => {
    if (status !== "running") return;
    pausedAtRef.current = Date.now();
    setStatus("paused");
  };

  const resume = () => {
    if (status !== "paused") return;
    pausedAccumRef.current += Date.now() - pausedAtRef.current;
    setStatus("running");
  };

  const stop = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
    setStatus("finished");
  };

  const save = () => {
    const distanceM = samples.length ? samples[samples.length - 1].total : 0;
    if (distanceM < 10) {
      // Discard runs with no meaningful distance
      onFinish(null);
      return;
    }
    const run: Run = {
      id: `run-${Date.now()}`,
      date: new Date(startedAtRef.current).toISOString(),
      durationSec: Math.round(elapsedSec),
      distanceM,
      avgPaceSecPerKm: avgPace(distanceM, elapsedSec),
      bestPaceSecPerKm: bestKmPace(samples),
      elevGainM: elevationGain(samples),
      samples,
      splits: computeSplits(samples),
    };
    onFinish(run);
  };

  const discard = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
    onFinish(null);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (previewWatchRef.current !== null) {
        navigator.geolocation.clearWatch(previewWatchRef.current);
      }
      releaseWakeLock();
    };
  }, []);

  // Synthetic samples for preview map (single point so map can center)
  const mapSamples: RunSample[] = samples.length > 0
    ? samples
    : previewPos
      ? [{ t: 0, lat: previewPos.lat, lng: previewPos.lng, d: 0, total: 0, acc: gpsAccuracy ?? undefined }]
      : [];

  const gpsStrength = gpsAccuracy == null
    ? { label: "SEARCHING", color: "#8a8a8a" }
    : gpsAccuracy <= 15
      ? { label: "STRONG", color: "#22c55e" }
      : gpsAccuracy <= 35
        ? { label: "OK", color: "#fbbf24" }
        : { label: "WEAK", color: "#e63222" };

  const distanceM = samples.length ? samples[samples.length - 1].total : 0;
  const pace = avgPace(distanceM, elapsedSec);
  // Current pace = last ~30 seconds
  const cutoff = (elapsedSec - 30) * 1000;
  const recent = samples.filter((s) => s.t >= cutoff);
  let currentPace = pace;
  if (recent.length >= 2) {
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = (last.t - first.t) / 1000;
    const dd = last.total - first.total;
    if (dt > 0 && dd > 0) currentPace = dt / (dd / 1000);
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-screen-sm mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <button
          onClick={discard}
          className="flex items-center gap-1 text-grit-dim hover:text-grit text-xs uppercase tracking-wider font-bold"
          aria-label="Cancel run"
        >
          <ChevronLeft size={16} />
          Cancel
        </button>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: gpsStrength.color,
              animation: status === "running" ? "pulse 1.5s ease-in-out infinite" : undefined,
            }}
          />
          <span className="label-cap text-[10px]" style={{ color: gpsStrength.color }}>
            GPS {gpsStrength.label}
            {gpsAccuracy != null && ` · ±${Math.round(gpsAccuracy)}m`}
          </span>
        </div>
      </header>

      {/* Hero distance */}
      <div className="bg-grit-card border border-grit p-6 text-center">
        <p className="label-cap text-[10px] text-grit-dim mb-2">
          {status === "ready" ? "READY TO RUN" : "DISTANCE"}
        </p>
        <p className="display text-6xl font-extrabold text-accent-red leading-none tracking-tight">
          {(distanceM / 1000).toFixed(2)}
        </p>
        <p className="label-cap text-xs text-grit-dim mt-2">KILOMETERS</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <BigStat label="Time" value={formatDuration(elapsedSec)} />
        <BigStat label="Avg pace" value={formatPace(pace)} suffix="/km" />
        <BigStat
          label="Pace"
          value={formatPace(currentPace)}
          suffix="/km"
          accent={status === "running"}
        />
      </div>

      {/* Map */}
      <RunMap samples={mapSamples} live={status === "running" || status === "paused"} />

      {error && (
        <div className="bg-accent-red/10 border border-accent-red text-accent-red text-xs px-3 py-2 uppercase tracking-wider">
          {error}
        </div>
      )}

      {/* GPS Quality HUD */}
      <div className="bg-grit-card border border-grit p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: gpsStrength.color,
                boxShadow: `0 0 6px ${gpsStrength.color}`,
              }}
            />
            <span className="label-cap text-[10px]" style={{ color: gpsStrength.color }}>
              {gpsStrength.label}
            </span>
            {speedAnomaly && (
              <span className="label-cap text-[10px] text-accent-red bg-accent-red/10 px-1.5 py-0.5 border border-accent-red">
                SPEED JUMP
              </span>
            )}
          </div>
          <button
            onClick={() => setDebugOpen((v) => !v)}
            className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 border transition-colors ${
              debugOpen
                ? "text-accent-red border-accent-red bg-accent-red/10"
                : "text-grit-dim border-grit hover:text-grit"
            }`}
          >
            <Settings size={12} />
            {debugOpen ? "Hide" : "Debug"}
          </button>
        </div>

        {/* Accuracy bar */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wider text-grit-dim w-12">Acc</span>
          <div className="flex-1 h-2 bg-[#0e0e0e] border border-grit overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: gpsAccuracy == null ? "0%" : `${Math.min(100, (gpsAccuracy / 50) * 100)}%`,
                background: gpsAccuracy != null && gpsAccuracy <= 15
                  ? "#22c55e"
                  : gpsAccuracy != null && gpsAccuracy <= 35
                    ? "#fbbf24"
                    : "#e63222",
              }}
            />
          </div>
          <span className="text-[10px] font-bold tabular-nums w-14 text-right">
            {gpsAccuracy != null ? `±${Math.round(gpsAccuracy)}m` : "—"}
          </span>
        </div>

        {/* Fix staleness */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wider text-grit-dim w-12">Fix</span>
          <span className="text-[10px] font-bold tabular-nums">
            {lastFixTime == null
              ? "—"
              : Date.now() - lastFixTime < 2000
                ? "< 1s ago"
                : `${Math.round((Date.now() - lastFixTime) / 1000)}s ago`}
          </span>
        </div>

        {debugOpen && (
          <div className="border-t border-grit pt-2 space-y-1">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-grit-dim uppercase tracking-wider">Samples</span>
                <span className="block font-bold tabular-nums text-grit">{samples.length}</span>
              </div>
              <div>
                <span className="text-grit-dim uppercase tracking-wider">Fixes</span>
                <span className="block font-bold tabular-nums text-grit">{fixCount}</span>
              </div>
              <div>
                <span className="text-grit-dim uppercase tracking-wider">Rejects</span>
                <span className="block font-bold tabular-nums text-grit">{rejectCount}</span>
              </div>
              <div>
                <span className="text-grit-dim uppercase tracking-wider">Accept %</span>
                <span className="block font-bold tabular-nums text-grit">
                  {fixCount + rejectCount > 0
                    ? `${Math.round((fixCount / (fixCount + rejectCount)) * 100)}%`
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-grit-dim uppercase tracking-wider">Raw speed</span>
                <span className="block font-bold tabular-nums text-grit">
                  {rawSpeed != null ? `${rawSpeed.toFixed(1)} m/s` : "—"}
                </span>
              </div>
              <div>
                <span className="text-grit-dim uppercase tracking-wider">Coords</span>
                <span className="block font-bold tabular-nums text-grit">
                  {previewPos
                    ? `${previewPos.lat.toFixed(5)}, ${previewPos.lng.toFixed(5)}`
                    : samples.length > 0
                      ? `${samples[samples.length - 1].lat.toFixed(5)}, ${samples[samples.length - 1].lng.toFixed(5)}`
                      : "—"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="pt-2">
        {status === "ready" && (
          <button
            onClick={start}
            className="w-full bg-accent-red text-white py-5 flex items-center justify-center gap-3 font-extrabold uppercase tracking-widest text-sm hover:bg-accent-red/90 transition-colors"
            style={{ boxShadow: "0 0 24px rgba(230,50,34,0.35)" }}
          >
            <Play size={20} strokeWidth={3} fill="currentColor" />
            Start
          </button>
        )}
        {status === "running" && (
          <button
            onClick={pause}
            className="w-full bg-grit-card border border-grit text-grit py-5 flex items-center justify-center gap-3 font-extrabold uppercase tracking-widest text-sm hover:border-accent-red transition-colors"
          >
            <Pause size={20} strokeWidth={3} />
            Pause
          </button>
        )}
        {status === "paused" && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={resume}
              className="bg-accent-red text-white py-5 flex items-center justify-center gap-2 font-extrabold uppercase tracking-widest text-xs hover:bg-accent-red/90 transition-colors"
            >
              <Play size={18} strokeWidth={3} fill="currentColor" />
              Resume
            </button>
            <button
              onClick={stop}
              className="bg-grit-card border border-grit text-grit py-5 flex items-center justify-center gap-2 font-extrabold uppercase tracking-widest text-xs hover:border-accent-red transition-colors"
            >
              <Square size={18} strokeWidth={3} fill="currentColor" />
              Finish
            </button>
          </div>
        )}
        {status === "finished" && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={discard}
              className="bg-grit-card border border-grit text-grit-dim py-5 flex items-center justify-center gap-2 font-extrabold uppercase tracking-widest text-xs hover:text-accent-red hover:border-accent-red transition-colors"
            >
              <Trash2 size={16} strokeWidth={3} />
              Discard
            </button>
            <button
              onClick={save}
              className="bg-accent-red text-white py-5 flex items-center justify-center gap-2 font-extrabold uppercase tracking-widest text-xs hover:bg-accent-red/90 transition-colors"
              style={{ boxShadow: "0 0 24px rgba(230,50,34,0.35)" }}
            >
              <Trophy size={18} strokeWidth={3} />
              Save run
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-grit-card border border-grit p-3 flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-widest text-grit-dim">{label}</span>
      <div className="flex items-baseline gap-1">
        <span
          className="display text-xl font-extrabold leading-none"
          style={{ color: accent ? "#e63222" : "var(--grit-text, #e5e5e5)" }}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-grit-dim">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ====================== DETAIL ====================== */

function RunDetail({
  run,
  allRuns,
  onBack,
  onDelete,
}: {
  run: Run;
  allRuns: Run[];
  onBack: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const maxSplit = run.splits.length ? Math.max(...run.splits) : 0;
  const minSplit = run.splits.length ? Math.min(...run.splits) : 0;

  return (
    <div className="px-4 pt-6 pb-24 max-w-screen-sm mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-grit-dim hover:text-grit text-xs uppercase tracking-wider font-bold"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <button
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          className={`flex items-center gap-1 text-xs uppercase tracking-wider font-bold ${
            confirmDelete ? "text-accent-red" : "text-grit-dim hover:text-accent-red"
          }`}
        >
          <Trash2 size={14} />
          {confirmDelete ? "Confirm" : "Delete"}
        </button>
      </header>

      <div>
        <p className="label-cap text-[10px] text-grit-dim">
          {formatRunDate(run.date)}
        </p>
        <h1 className="display text-2xl font-extrabold uppercase text-grit tracking-tight">
          {labelRun(run)}
        </h1>
      </div>

      <RunMap samples={run.samples} height={280} />

      <div className="grid grid-cols-2 gap-2">
        <DetailStat label="Distance" value={`${(run.distanceM / 1000).toFixed(2)} km`} big />
        <DetailStat label="Time" value={formatDuration(run.durationSec)} big />
        <DetailStat label="Avg pace" value={`${formatPace(run.avgPaceSecPerKm)}/km`} />
        <DetailStat
          label="Best km"
          value={run.bestPaceSecPerKm ? `${formatPace(run.bestPaceSecPerKm)}/km` : "—"}
        />
        <DetailStat
          label="Elevation"
          value={run.elevGainM ? `+${run.elevGainM} m` : "—"}
        />
        <DetailStat
          label="Calories"
          value={`${estimateCalories(run)} kcal`}
        />
      </div>

      {/* Splits */}
      {run.splits.length > 0 && (
        <section className="bg-grit-card border border-grit p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-accent-red" />
            <h2 className="label-cap text-xs text-grit">Splits</h2>
          </div>
          <ul className="space-y-1">
            {run.splits.map((sec, i) => {
              const isBest = sec === minSplit && run.splits.length > 1;
              const isWorst = sec === maxSplit && run.splits.length > 1;
              const pct = maxSplit > 0 ? (sec / maxSplit) * 100 : 0;
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-grit-dim font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="flex-1 h-5 bg-grit relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${pct}%`,
                        background: isBest
                          ? "#e63222"
                          : isWorst
                          ? "#404040"
                          : "#2a2a2a",
                      }}
                    />
                  </div>
                  <span
                    className={`w-16 text-right tabular-nums font-bold ${
                      isBest ? "text-accent-red" : "text-grit"
                    }`}
                  >
                    {formatPace(sec)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <RunAdvanced run={run} allRuns={allRuns} />
    </div>
  );
}

function DetailStat({
  label,
  value,
  big = false,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="bg-grit-card border border-grit p-3 flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-widest text-grit-dim">{label}</span>
      <span
        className={`display font-extrabold text-grit leading-none ${
          big ? "text-2xl" : "text-lg"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* ====================== HELPERS ====================== */

function labelRun(r: Run): string {
  const h = new Date(r.date).getHours();
  if (h < 5) return "Late night run";
  if (h < 12) return "Morning run";
  if (h < 17) return "Afternoon run";
  if (h < 21) return "Evening run";
  return "Night run";
}

function formatRunDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `Today · ${time}`;
  return `${d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} · ${time}`;
}

function estimateCalories(run: Run): number {
  // Rough estimate: ~1 kcal per kg per km for running, assume 70kg if unknown
  const km = run.distanceM / 1000;
  return Math.round(km * 70);
}

/* ====================== WAKE LOCK ====================== */

let wakeLockSentinel: WakeLockSentinel | null = null;

async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (nav.wakeLock) {
      wakeLockSentinel = await nav.wakeLock.request("screen");
    }
  } catch {
    // ignore
  }
}

function releaseWakeLock() {
  try {
    wakeLockSentinel?.release();
  } catch {
    // ignore
  }
  wakeLockSentinel = null;
}

interface WakeLockSentinel {
  release: () => Promise<void>;
}

