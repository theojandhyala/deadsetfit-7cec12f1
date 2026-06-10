import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bike,
  ChevronLeft,
  ChevronRight,
  Flame,
  Footprints,
  MapPinned,
  Mountain,
  Pause,
  Play,
  Share2,
  Square,
  Timer,
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
import type { ActivityType, Run, RunSample } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_tabs/run")({
  head: () => ({ meta: [{ title: "DEADSET — Cardio" }] }),
  component: RunPage,
});

type View = "hub" | "live" | "summary" | "detail";

const ACTIVITY_CONFIG: Record<
  ActivityType,
  {
    label: string;
    icon: ReactNode;
    color: string;
    metricLabel: string;
    calMult: number; // kcal per kg per km (approx)
    maxSpeedMps: number;
    description: string;
  }
> = {
  run: {
    label: "Run",
    icon: <Activity size={22} />,
    color: "#e63222",
    metricLabel: "Pace /km",
    calMult: 1.0,
    maxSpeedMps: 12.5,
    description: "Road · Trail · Treadmill",
  },
  walk: {
    label: "Walk",
    icon: <Footprints size={22} />,
    color: "#fbbf24",
    metricLabel: "Pace /km",
    calMult: 0.55,
    maxSpeedMps: 3.5,
    description: "Power walk · Stroll",
  },
  cycle: {
    label: "Cycle",
    icon: <Bike size={22} />,
    color: "#22c55e",
    metricLabel: "Speed km/h",
    calMult: 0.45,
    maxSpeedMps: 25,
    description: "Road · MTB · Commute",
  },
  hike: {
    label: "Hike",
    icon: <Mountain size={22} />,
    color: "#a78bfa",
    metricLabel: "Pace /km",
    calMult: 0.8,
    maxSpeedMps: 2.8,
    description: "Trail · Summit · Bush",
  },
  trail: {
    label: "Trail Run",
    icon: <MapPinned size={22} />,
    color: "#fb923c",
    metricLabel: "Pace /km",
    calMult: 1.1,
    maxSpeedMps: 7,
    description: "Off-road · Ultra",
  },
};

function RunPage() {
  const [state, setState] = useAppState();
  const runs = (state.runs ?? [])
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [view, setView] = useState<View>("hub");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingRun, setPendingRun] = useState<Run | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>("run");

  if (view === "live") {
    return (
      <LiveRunner
        activityType={selectedActivity}
        weightKg={state.profile?.weightKg ?? 70}
        onFinish={(run) => {
          if (run) {
            setPendingRun(run);
            setView("summary");
          } else {
            setView("hub");
          }
        }}
      />
    );
  }

  if (view === "summary" && pendingRun) {
    return (
      <RunSummary
        run={pendingRun}
        onSave={(named) => {
          setState((s) => ({ ...s, runs: [...(s.runs ?? []), named] }));
          setDetailId(named.id);
          setPendingRun(null);
          setView("detail");
          toast.success("Activity saved 🔥");
        }}
        onDiscard={() => {
          setPendingRun(null);
          setView("hub");
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
      selectedActivity={selectedActivity}
      onSelectActivity={setSelectedActivity}
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
  selectedActivity,
  onSelectActivity,
  onStart,
  onOpen,
}: {
  runs: Run[];
  selectedActivity: ActivityType;
  onSelectActivity: (t: ActivityType) => void;
  onStart: () => void;
  onOpen: (id: string) => void;
}) {
  const totals = runs.reduce(
    (acc, r) => {
      acc.distance += r.distanceM;
      acc.duration += r.durationSec;
      acc.count += 1;
      acc.calories += r.calories ?? 0;
      return acc;
    },
    { distance: 0, duration: 0, count: 0, calories: 0 },
  );

  const now = Date.now();
  const weekStart = now - 7 * 24 * 3600 * 1000;
  const weekRuns = runs.filter((r) => new Date(r.date).getTime() >= weekStart);
  const weekDist = weekRuns.reduce((s, r) => s + r.distanceM, 0);
  const cfg = ACTIVITY_CONFIG[selectedActivity];

  return (
    <div className="px-4 pt-6 pb-24 max-w-screen-sm mx-auto space-y-5 animate-fade-in">
      <header className="space-y-1 animate-slide-down">
        <p className="label-cap text-[10px] text-grit-dim">CARDIO · GPS TRACKER</p>
        <h1 className="display text-3xl font-extrabold uppercase text-grit tracking-tight">
          Get moving.
        </h1>
        <p className="text-sm text-grit-dim">
          GPS tracks every move. Strava-style trail, splits and stats.
        </p>
      </header>
      {/* Activity type picker */}
      <div className="grid grid-cols-5 gap-1.5">
        {(Object.entries(ACTIVITY_CONFIG) as [ActivityType, typeof cfg][]).map(([type, c]) => (
          <button
            key={type}
            onClick={() => onSelectActivity(type)}
            className="flex flex-col items-center gap-1.5 p-2.5 border transition-all"
            style={{
              borderColor: selectedActivity === type ? c.color : "#262626",
              background: selectedActivity === type ? `${c.color}15` : "#0f0f0f",
            }}
          >
            <span style={{ color: selectedActivity === type ? c.color : "#8a8a8a" }}>{c.icon}</span>
            <span
              className="label-cap text-[9px]"
              style={{ color: selectedActivity === type ? c.color : "#8a8a8a" }}
            >
              {c.label}
            </span>
          </button>
        ))}
      </div>
      {/* Start CTA */}
      <button
        onClick={onStart}
        className="w-full text-white py-5 flex items-center justify-center gap-3 font-extrabold uppercase tracking-widest text-sm transition-colors border"
        style={{
          background: cfg.color,
          borderColor: cfg.color,
          boxShadow: `0 0 24px ${cfg.color}40`,
        }}
      >
        <Play size={20} strokeWidth={3} fill="currentColor" />
        Start {cfg.label}
      </button>
      {/* This week summary */}
      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="This week" value={formatDistance(weekDist)} />
        <StatBlock label="Total" value={String(totals.count)} suffix="sessions" />
        <StatBlock label="All-time" value={formatDistance(totals.distance)} />
      </div>
      {/* History by type */}
      {Object.entries(ACTIVITY_CONFIG).map(([type, c]) => {
        const typed = runs.filter((r) => (r.activityType ?? "run") === type);
        if (typed.length === 0) return null;
        return (
          <div key={type} className="flex items-center gap-3 p-3 border border-grit bg-grit-card">
            <span style={{ color: c.color }}>{c.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="label-cap text-[10px]" style={{ color: c.color }}>
                {c.label.toUpperCase()}
              </p>
              <p className="text-sm font-bold text-grit">
                {formatDistance(typed.reduce((s, r) => s + r.distanceM, 0))}
              </p>
            </div>
            <span className="label-cap text-[10px] text-grit-dim">{typed.length} sessions</span>
          </div>
        );
      })}
      {/* History list */} origin/main
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="label-cap text-xs text-grit">Recent Activity</h2>
          {runs.length > 0 && (
            <span className="text-[10px] uppercase tracking-wider text-grit-dim">
              {runs.length} total
            </span>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="bg-grit-card border border-grit p-8 flex flex-col items-center text-center gap-3">
            <div className="p-4 border border-grit text-grit-dim">
              <Activity size={32} />
            </div>
            <p className="display text-lg font-extrabold uppercase text-grit">No activities yet</p>
            <p className="text-xs text-grit-dim uppercase tracking-wider">
              Hit start. Your route appears here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => {
              const actCfg = ACTIVITY_CONFIG[r.activityType ?? "run"];
              return (
                <li key={r.id}>
                  <button
                    onClick={() => onOpen(r.id)}
                    className="w-full bg-grit-card border border-grit hover:border-accent-red transition-colors text-left p-3 space-y-2"
                  >
                    <div className="flex gap-3">
                      <div className="w-20 flex-shrink-0">
                        <div className="h-20">
                          <RunMap samples={r.samples} height={80} showMarkers={false} thumbnail />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span style={{ color: actCfg.color }}>{actCfg.icon}</span>
                              <p className="display text-sm font-extrabold uppercase text-grit tracking-wide truncate">
                                {r.name || labelRun(r)}
                              </p>
                            </div>
                            <p className="text-[10px] uppercase tracking-wider text-grit-dim">
                              {formatRunDate(r.date)}
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-grit-dim flex-shrink-0" />
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span
                            className="display text-lg font-extrabold leading-none"
                            style={{ color: actCfg.color }}
                          >
                            {(r.distanceM / 1000).toFixed(2)}
                            <span className="text-[10px] font-bold text-grit-dim uppercase ml-0.5">
                              km
                            </span>
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-grit-dim">
                            {formatDuration(r.durationSec)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 border-t border-[#262626] pt-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-grit-dim">
                          {r.activityType === "cycle" ? "Speed" : "Pace"}
                        </p>
                        <p className="text-[11px] font-bold text-grit tabular-nums">
                          {r.activityType === "cycle"
                            ? `${speedKmh(r.distanceM, r.durationSec)} km/h`
                            : `${formatPace(r.avgPaceSecPerKm)}/km`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-grit-dim">
                          Duration
                        </p>
                        <p className="text-[11px] font-bold text-grit tabular-nums">
                          {formatDuration(r.durationSec)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-grit-dim">
                          Calories
                        </p>
                        <p className="text-[11px] font-bold text-grit tabular-nums">
                          {r.calories ?? estimateCalories(r)} kcal
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatBlock({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-grit-card border border-grit p-3 flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-widest text-grit-dim">{label}</span>
      <span className="display text-lg font-extrabold text-grit leading-none">{value}</span>
      {suffix && (
        <span className="text-[9px] text-grit-dim uppercase tracking-wider">{suffix}</span>
      )}
    </div>
  );
}

/* ====================== LIVE TRACKER ====================== */

type Status = "ready" | "running" | "paused" | "finished";
type LocationPermission = "checking" | "prompt" | "granted" | "denied" | "unknown";

function LiveRunner({
  activityType,
  weightKg,
  onFinish,
}: {
  activityType: ActivityType;
  weightKg: number;
  onFinish: (run: Run | null) => void;
}) {
  const cfg = ACTIVITY_CONFIG[activityType];
  const [status, setStatus] = useState<Status>("ready");
  const [permission, setPermission] = useState<LocationPermission>("checking");
  const [samples, setSamples] = useState<RunSample[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [previewPos, setPreviewPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);

  const [rejectCount, setRejectCount] = useState(0);
  const [rawSpeed, setRawSpeed] = useState<number | null>(null);
  const [lastFixTime, setLastFixTime] = useState<number | null>(null);

  const statusRef = useRef<Status>(status);
  statusRef.current = status;
  const samplesRef = useRef<RunSample[]>([]);
  samplesRef.current = samples;
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const previewWatchRef = useRef<number | null>(null);
  const lastRawPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const rejectCountRef = useRef(0);

  const handleGpsError = (err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setPermission("denied");
      setError("Location blocked — enable in browser settings.");
      return;
    }
    setError(err.message || "GPS error");
  };

  useEffect(() => {
    let cancelled = false;
    if (!("permissions" in navigator) || !("geolocation" in navigator)) {
      setPermission("unknown");
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        setPermission(result.state as LocationPermission);
        result.onchange = () => setPermission(result.state as LocationPermission);
      })
      .catch(() => setPermission("unknown"));
    return () => {
      cancelled = true;
    };
  }, []);

  // Timer
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setElapsedSec(
        Math.max(0, (Date.now() - startedAtRef.current - pausedAccumRef.current) / 1000),
      );
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  // Preview GPS (before starting)
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
      handleGpsError,
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
      setError("GPS not supported.");
      return;
    }
    if (previewWatchRef.current !== null) {
      navigator.geolocation.clearWatch(previewWatchRef.current);
      previewWatchRef.current = null;
    }
    setError(null);
    startedAtRef.current = Date.now();
    pausedAccumRef.current = 0;
    const initial: RunSample[] = previewPos
      ? [
          {
            t: 0,
            lat: previewPos.lat,
            lng: previewPos.lng,
            d: 0,
            total: 0,
            acc: gpsAccuracy ?? undefined,
          },
        ]
      : [];
    samplesRef.current = initial;
    setSamples(initial);
    setElapsedSec(0);
    rejectCountRef.current = 0;
    setRejectCount(0);
    lastRawPosRef.current = null;
    setStatus("running");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (statusRef.current !== "running") return;
        const { latitude, longitude, accuracy, altitude, speed } = pos.coords;
        const now = Date.now();
        setGpsAccuracy(accuracy);
        setLastFixTime(now);
        const deviceSpeed = typeof speed === "number" && speed >= 0 ? speed : null;
        const t = now - startedAtRef.current - pausedAccumRef.current;
        const prev = samplesRef.current[samplesRef.current.length - 1];

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
        setRawSpeed(deviceSpeed ?? instantSpeed);

        if (instantSpeed != null && instantSpeed > cfg.maxSpeedMps * 1.5) {
          rejectCountRef.current += 1;
          setRejectCount(rejectCountRef.current);
          return;
        }

        const result = smoothGpsFix(
          prev,
          {
            lat: latitude,
            lng: longitude,
            accuracy: accuracy ?? undefined,
            altitude,
            speed: deviceSpeed,
            timeMs: t,
          },
          { maxAccuracyM: 90, maxSpeedMps: cfg.maxSpeedMps, minDeltaM: 0.5 },
        );

        if (!result.accepted) {
          rejectCountRef.current += 1;
          setRejectCount(rejectCountRef.current);
          return;
        }
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
      handleGpsError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
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

  const buildRun = (): Run | null => {
    const distanceM = samples.length ? samples[samples.length - 1].total : 0;
    if (distanceM < 10) return null;
    const calories = Math.round((distanceM / 1000) * weightKg * cfg.calMult);
    return {
      id: `run-${Date.now()}`,
      date: new Date(startedAtRef.current).toISOString(),
      durationSec: Math.round(elapsedSec),
      distanceM,
      avgPaceSecPerKm: avgPace(distanceM, elapsedSec),
      bestPaceSecPerKm: bestKmPace(samples),
      elevGainM: elevationGain(samples),
      samples,
      splits: computeSplits(samples),
      activityType,
      calories,
    };
  };

  const finish = () => {
    const run = buildRun();
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
    onFinish(run);
  };

  const discard = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (previewWatchRef.current !== null) {
      navigator.geolocation.clearWatch(previewWatchRef.current);
      previewWatchRef.current = null;
    }
    releaseWakeLock();
    onFinish(null);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (previewWatchRef.current !== null)
        navigator.geolocation.clearWatch(previewWatchRef.current);
      releaseWakeLock();
    };
  }, []);

  const mapSamples: RunSample[] =
    samples.length > 0
      ? samples
      : previewPos
        ? [
            {
              t: 0,
              lat: previewPos.lat,
              lng: previewPos.lng,
              d: 0,
              total: 0,
              acc: gpsAccuracy ?? undefined,
            },
          ]
        : [];

  const distanceM = samples.length ? samples[samples.length - 1].total : 0;
  const pace = avgPace(distanceM, elapsedSec);
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

  const gpsStrength =
    gpsAccuracy == null
      ? { label: "SEARCHING", color: "#8a8a8a" }
      : gpsAccuracy <= 15
        ? { label: "STRONG", color: "#22c55e" }
        : gpsAccuracy <= 35
          ? { label: "OK", color: "#fbbf24" }
          : { label: "WEAK", color: "#e63222" };

  const isCycle = activityType === "cycle";
  const speedKmhNow = elapsedSec > 0 ? (distanceM / elapsedSec) * 3.6 : 0;
  const currentSpeedKmhNow =
    recent.length >= 2
      ? (() => {
          const f = recent[0];
          const l = recent[recent.length - 1];
          const dt = (l.t - f.t) / 1000;
          const dd = l.total - f.total;
          return dt > 0 ? (dd / dt) * 3.6 : 0;
        })()
      : speedKmhNow;

  const mapHeight = mapExpanded ? 380 : 240;

  return (
    <div className="px-4 pt-4 pb-24 max-w-screen-sm mx-auto space-y-3">
      <header className="flex items-center justify-between">
        <button
          onClick={discard}
          className="flex items-center gap-1 text-grit-dim hover:text-grit text-xs uppercase tracking-wider font-bold"
        >
          <ChevronLeft size={16} />
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
          <span className="label-cap text-[11px]" style={{ color: cfg.color }}>
            {cfg.label.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: gpsStrength.color, boxShadow: `0 0 6px ${gpsStrength.color}` }}
          />
          <span className="label-cap text-[10px]" style={{ color: gpsStrength.color }}>
            {gpsAccuracy != null ? `±${Math.round(gpsAccuracy)}m` : "GPS"}
          </span>
        </div>
      </header>

      {/* Hero metric */}
      <div
        className="bg-grit-card border p-5 text-center"
        style={{ borderColor: status === "running" ? cfg.color : "#262626" }}
      >
        <p className="label-cap text-[10px] text-grit-dim mb-1">
          {status === "ready" ? "READY" : "DISTANCE"}
        </p>
        <p
          className="display text-6xl font-extrabold leading-none tracking-tight"
          style={{ color: cfg.color }}
        >
          {(distanceM / 1000).toFixed(2)}
        </p>
        <p className="label-cap text-xs text-grit-dim mt-1">KILOMETRES</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <BigStat label="Time" value={formatDuration(elapsedSec)} />
        {isCycle ? (
          <>
            <BigStat label="Avg km/h" value={speedKmhNow.toFixed(1)} />
            <BigStat
              label="Now km/h"
              value={currentSpeedKmhNow.toFixed(1)}
              accent={status === "running"}
            />
          </>
        ) : (
          <>
            <BigStat label="Avg pace" value={formatPace(pace)} suffix="/km" />
            <BigStat
              label="Now"
              value={formatPace(currentPace)}
              suffix="/km"
              accent={status === "running"}
            />
          </>
        )}
      </div>

      {/* Map — tap to expand */}
      <div className="relative">
        <RunMap
          samples={mapSamples}
          height={mapHeight}
          live={status === "running" || status === "paused"}
          mapStyle="trail"
          activityColor={cfg.color}
        />
        <button
          onClick={() => setMapExpanded((v) => !v)}
          className="absolute bottom-2 right-2 bg-black/80 border border-grit px-2 py-1 z-[400] label-cap text-[9px] text-grit"
        >
          {mapExpanded ? "⊟ SHRINK" : "⊞ EXPAND"}
        </button>
        {status === "running" && samples.length >= 2 && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/80 border border-accent-red px-2 py-1 z-[400]">
            <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
            <span className="label-cap text-[9px] text-accent-red">
              LIVE · {samples.length} pts
            </span>
          </div>
        )}
      </div>

      {permission === "denied" && (
        <div className="bg-grit-card border border-accent-red p-4 space-y-2">
          <p className="label-cap text-[10px] text-accent-red">GPS BLOCKED</p>
          <p className="text-xs text-grit-dim">
            Enable location in browser settings to record your route.
          </p>
          <button
            onClick={() => {
              setPermission("prompt");
              setError(null);
              navigator.geolocation.getCurrentPosition(
                () => setPermission("granted"),
                handleGpsError,
                { enableHighAccuracy: true },
              );
            }}
            className="btn-grit w-full py-2.5 text-xs"
          >
            Retry GPS
          </button>
        </div>
      )}

      {error && (
        <div className="bg-accent-red/10 border border-accent-red text-accent-red text-xs px-3 py-2 uppercase tracking-wider">
          {error}
        </div>
      )}

      {/* Live stats bar */}
      {status === "running" && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-grit-card border border-grit p-2">
            <p className="text-[9px] uppercase tracking-wider text-grit-dim">Calories</p>
            <p className="text-sm font-bold text-grit">
              {Math.round((distanceM / 1000) * weightKg * cfg.calMult)}
            </p>
          </div>
          <div className="bg-grit-card border border-grit p-2">
            <p className="text-[9px] uppercase tracking-wider text-grit-dim">Fixes</p>
            <p className="text-sm font-bold text-grit">{samples.length}</p>
          </div>
          <div className="bg-grit-card border border-grit p-2">
            <p className="text-[9px] uppercase tracking-wider text-grit-dim">Elevation</p>
            <p className="text-sm font-bold text-grit">+{elevationGain(samples)}m</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="pt-1">
        {status === "ready" && (
          <button
            onClick={start}
            className="w-full text-white py-5 flex items-center justify-center gap-3 font-extrabold uppercase tracking-widest text-sm transition-colors"
            style={{ background: cfg.color, boxShadow: `0 0 24px ${cfg.color}40` }}
          >
            <Play size={20} strokeWidth={3} fill="currentColor" />
            Start {cfg.label}
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
              className="text-white py-5 flex items-center justify-center gap-2 font-extrabold uppercase tracking-widest text-xs transition-colors"
              style={{ background: cfg.color }}
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
              onClick={finish}
              className="text-white py-5 flex items-center justify-center gap-2 font-extrabold uppercase tracking-widest text-xs transition-colors"
              style={{ background: cfg.color, boxShadow: `0 0 24px ${cfg.color}40` }}
            >
              <Trophy size={18} strokeWidth={3} />
              Save
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

/* ====================== POST-RUN SUMMARY ====================== */

function RunSummary({
  run,
  onSave,
  onDiscard,
}: {
  run: Run;
  onSave: (named: Run) => void;
  onDiscard: () => void;
}) {
  const cfg = ACTIVITY_CONFIG[run.activityType ?? "run"];
  const [name, setName] = useState(labelRun(run));
  const [notes, setNotes] = useState("");
  const [hr, setHr] = useState("");

  function save() {
    onSave({
      ...run,
      name: name.trim() || labelRun(run),
      notes: notes.trim() || undefined,
      heartRateAvg: hr ? Number(hr) : undefined,
    });
  }

  async function share() {
    const text = `${name} · ${(run.distanceM / 1000).toFixed(2)} km · ${formatDuration(run.durationSec)} · ${run.calories ?? estimateCalories(run)} kcal 🔥 via DEADSET`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "DEADSET Activity", text });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-screen-sm mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <button
          onClick={onDiscard}
          className="flex items-center gap-1 text-grit-dim text-xs uppercase tracking-wider font-bold"
        >
          <Trash2 size={14} /> Discard
        </button>
        <div className="flex items-center gap-2">
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
          <span className="label-cap text-[11px]" style={{ color: cfg.color }}>
            ACTIVITY COMPLETE
          </span>
        </div>
        <button
          onClick={share}
          className="flex items-center gap-1 text-xs uppercase tracking-wider font-bold"
          style={{ color: cfg.color }}
        >
          <Share2 size={14} /> Share
        </button>
      </header>

      {/* Map */}
      <RunMap samples={run.samples} height={280} mapStyle="trail" activityColor={cfg.color} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border p-4 text-center" style={{ borderColor: cfg.color }}>
          <p className="label-cap text-[9px]" style={{ color: cfg.color }}>
            DISTANCE
          </p>
          <p className="display text-3xl font-extrabold text-grit leading-none mt-1">
            {(run.distanceM / 1000).toFixed(2)}
          </p>
          <p className="label-cap text-[9px] text-grit-dim">km</p>
        </div>
        <div className="border border-grit p-4 text-center bg-grit-card">
          <p className="label-cap text-[9px] text-grit-dim">TIME</p>
          <p className="display text-3xl font-extrabold text-grit leading-none mt-1">
            {formatDuration(run.durationSec)}
          </p>
          <p className="label-cap text-[9px] text-grit-dim">duration</p>
        </div>
        <div className="border border-grit p-3 bg-grit-card text-center">
          <p className="label-cap text-[9px] text-grit-dim">
            {run.activityType === "cycle" ? "AVG SPEED" : "AVG PACE"}
          </p>
          <p className="display text-xl font-extrabold text-grit leading-none mt-1">
            {run.activityType === "cycle"
              ? `${speedKmh(run.distanceM, run.durationSec)} km/h`
              : `${formatPace(run.avgPaceSecPerKm)}/km`}
          </p>
        </div>
        <div className="border border-grit p-3 bg-grit-card text-center">
          <p className="label-cap text-[9px] text-grit-dim">CALORIES</p>
          <p className="display text-xl font-extrabold text-grit leading-none mt-1">
            {run.calories ?? estimateCalories(run)}
          </p>
          <p className="label-cap text-[9px] text-grit-dim">kcal</p>
        </div>
        {(run.elevGainM ?? 0) > 0 && (
          <div className="border border-grit p-3 bg-grit-card text-center">
            <p className="label-cap text-[9px] text-grit-dim">ELEVATION</p>
            <p className="display text-xl font-extrabold text-grit leading-none mt-1">
              +{run.elevGainM}m
            </p>
          </div>
        )}
        {run.splits.length > 0 && (
          <div className="border border-grit p-3 bg-grit-card text-center">
            <p className="label-cap text-[9px] text-grit-dim">BEST KM</p>
            <p className="display text-xl font-extrabold text-grit leading-none mt-1">
              {formatPace(run.bestPaceSecPerKm ?? 0)}/km
            </p>
          </div>
        )}
      </div>

      {/* Name + notes */}
      <div className="space-y-3">
        <div>
          <label className="label-cap text-[10px] text-grit-dim block mb-1">Activity name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="input-grit w-full"
            placeholder="Morning Run"
          />
        </div>
        <div>
          <label className="label-cap text-[10px] text-grit-dim block mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            className="input-grit w-full resize-none"
            placeholder="How did it feel?"
          />
        </div>
        <div>
          <label className="label-cap text-[10px] text-grit-dim block mb-1">
            Avg heart rate (optional)
          </label>
          <input
            value={hr}
            onChange={(e) => setHr(e.target.value)}
            inputMode="numeric"
            maxLength={3}
            className="input-grit w-32"
            placeholder="e.g. 155"
          />
          <span className="label-cap text-[9px] text-grit-dim ml-2">bpm</span>
        </div>
      </div>

      <button
        onClick={save}
        className="w-full text-white py-5 flex items-center justify-center gap-3 font-extrabold uppercase tracking-widest text-sm"
        style={{ background: cfg.color, boxShadow: `0 0 24px ${cfg.color}40` }}
      >
        <Trophy size={20} strokeWidth={3} />
        Save Activity
      </button>
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
  const cfg = ACTIVITY_CONFIG[run.activityType ?? "run"];
  const maxSplit = run.splits.length ? Math.max(...run.splits) : 0;
  const minSplit = run.splits.length ? Math.min(...run.splits) : 0;

  async function share() {
    const text = `${run.name || labelRun(run)} · ${(run.distanceM / 1000).toFixed(2)} km · ${formatDuration(run.durationSec)} · ${run.calories ?? estimateCalories(run)} kcal 🔥 via DEADSET`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "DEADSET Activity", text });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-screen-sm mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-grit-dim hover:text-grit text-xs uppercase tracking-wider font-bold"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={share} className="text-grit-dim hover:text-grit">
            <Share2 size={16} />
          </button>
          <button
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            className={`flex items-center gap-1 text-xs uppercase tracking-wider font-bold ${confirmDelete ? "text-accent-red" : "text-grit-dim hover:text-accent-red"}`}
          >
            <Trash2 size={14} />
            {confirmDelete ? "Confirm" : "Delete"}
          </button>
        </div>
      </header>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
          <p className="label-cap text-[10px]" style={{ color: cfg.color }}>
            {formatRunDate(run.date)}
          </p>
        </div>
        <h1 className="display text-2xl font-extrabold uppercase text-grit tracking-tight">
          {run.name || labelRun(run)}
        </h1>
        {run.notes && <p className="text-sm text-grit-dim mt-1 italic">"{run.notes}"</p>}
      </div>

      {/* Full route map */}
      <RunMap samples={run.samples} height={340} mapStyle="trail" activityColor={cfg.color} />

      <div className="grid grid-cols-2 gap-2">
        <DetailStat label="Distance" value={`${(run.distanceM / 1000).toFixed(2)} km`} big />
        <DetailStat label="Time" value={formatDuration(run.durationSec)} big />
        <DetailStat
          label={run.activityType === "cycle" ? "Avg speed" : "Avg pace"}
          value={
            run.activityType === "cycle"
              ? `${speedKmh(run.distanceM, run.durationSec)} km/h`
              : `${formatPace(run.avgPaceSecPerKm)}/km`
          }
        />
        <DetailStat
          label={run.activityType === "cycle" ? "Top speed est." : "Best km"}
          value={
            run.activityType === "cycle"
              ? `${run.bestPaceSecPerKm ? (3600 / run.bestPaceSecPerKm).toFixed(1) : "—"} km/h`
              : run.bestPaceSecPerKm
                ? `${formatPace(run.bestPaceSecPerKm)}/km`
                : "—"
          }
        />
        <DetailStat label="Elevation" value={run.elevGainM ? `+${run.elevGainM} m` : "—"} />
        <DetailStat label="Calories" value={`${run.calories ?? estimateCalories(run)} kcal`} />
        {run.heartRateAvg && <DetailStat label="Avg HR" value={`${run.heartRateAvg} bpm`} />}
      </div>

      {/* Splits */}
      {run.splits.length > 0 && (
        <section className="bg-grit-card border border-grit p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-accent-red" />
            <h2 className="label-cap text-xs text-grit">Km Splits</h2>
          </div>
          <ul className="space-y-1">
            {run.splits.map((sec, i) => {
              const isBest = sec === minSplit && run.splits.length > 1;
              const isWorst = sec === maxSplit && run.splits.length > 1;
              const pct = maxSplit > 0 ? (sec / maxSplit) * 100 : 0;
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-grit-dim font-bold tabular-nums">{i + 1}</span>
                  <div className="flex-1 h-5 bg-grit relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${pct}%`,
                        background: isBest ? cfg.color : isWorst ? "#404040" : "#2a2a2a",
                      }}
                    />
                  </div>
                  <span
                    className={`w-16 text-right tabular-nums font-bold ${isBest ? "text-accent-red" : "text-grit"}`}
                  >
                    {formatPace(sec)}
                  </span>
                  {isBest && <span className="label-cap text-[9px] text-accent-red">BEST</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <RunAdvanced run={run} allRuns={allRuns} />

      {/* Share / Social */}
      <section className="border border-grit bg-grit-card p-4 space-y-3">
        <p className="label-cap text-[10px] text-accent-red">SHARE WITH CREW</p>
        <button
          onClick={share}
          className="btn-grit w-full py-3 flex items-center justify-center gap-2"
        >
          <Share2 size={14} /> Share this {cfg.label.toLowerCase()}
        </button>
        <Link
          to="/friends"
          className="block text-center label-cap text-[10px] text-grit-dim hover:text-accent-red"
        >
          Post to feed → <Users size={10} className="inline" />
        </Link>
      </section>
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
        className={`display font-extrabold text-grit leading-none ${big ? "text-2xl" : "text-lg"}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ====================== HELPERS ====================== */

function labelRun(r: Run): string {
  const cfg = ACTIVITY_CONFIG[r.activityType ?? "run"];
  const h = new Date(r.date).getHours();
  const time =
    h < 5 ? "Late night" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : h < 21 ? "Evening" : "Night";
  return `${time} ${cfg.label}`;
}

function formatRunDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

function estimateCalories(run: Run): number {
  return Math.round((run.distanceM / 1000) * 70);
}

function speedKmh(distanceM: number, durationSec: number): string {
  if (durationSec <= 0) return "0.0";
  return ((distanceM / durationSec) * 3.6).toFixed(1);
}

/* ====================== WAKE LOCK ====================== */

let wakeLockSentinel: WakeLockSentinel | null = null;

async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (nav.wakeLock) wakeLockSentinel = await nav.wakeLock.request("screen");
  } catch {
    /* ignore */
  }
}

function releaseWakeLock() {
  try {
    wakeLockSentinel?.release();
  } catch {
    /* ignore */
  }
  wakeLockSentinel = null;
}

interface WakeLockSentinel {
  release: () => Promise<void>;
}
