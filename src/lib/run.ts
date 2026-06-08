import type { Run, RunSample } from "./types";

const EARTH_R = 6371000; // meters

export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/** seconds per km from m/s velocity */
export function paceFromSpeed(metersPerSec: number): number {
  if (metersPerSec <= 0) return 0;
  return 1000 / metersPerSec;
}

export function avgPace(distanceM: number, durationSec: number): number {
  if (distanceM <= 0 || durationSec <= 0) return 0;
  return durationSec / (distanceM / 1000);
}

/** Compute per-kilometer splits (sec/km) from samples. */
export function computeSplits(samples: RunSample[]): number[] {
  const splits: number[] = [];
  let lastKm = 0;
  let lastT = 0;
  for (const s of samples) {
    const km = Math.floor(s.total / 1000);
    while (km > lastKm) {
      // interpolate time when total crossed (lastKm+1)*1000 — approximate as s.t
      splits.push(Math.max(1, Math.round(s.t / 1000) - lastT));
      lastT = Math.round(s.t / 1000);
      lastKm += 1;
    }
  }
  return splits;
}

/** Compute the best rolling 1km pace from samples (sec/km). */
export function bestKmPace(samples: RunSample[]): number {
  if (samples.length < 2) return 0;
  let best = Infinity;
  let i = 0;
  for (let j = 1; j < samples.length; j++) {
    while (i < j && samples[j].total - samples[i].total > 1000) i++;
    if (i > 0) {
      const a = samples[i - 1];
      const b = samples[j];
      const dist = b.total - a.total;
      const dt = (b.t - a.t) / 1000;
      if (dist >= 1000 && dt > 0) {
        const pace = dt / (dist / 1000);
        if (pace < best) best = pace;
      }
    }
  }
  return isFinite(best) ? best : 0;
}

/**
 * Decide whether to accept a raw GPS fix, and if so produce a smoothed
 * coordinate. Filters out: low-accuracy fixes, jitter, and impossible-speed
 * jumps (e.g. tower-handoff teleports). Applies an accuracy-weighted
 * low-pass filter (simple 1D Kalman-style blend) against the previous
 * accepted sample so the rendered polyline tracks the actual path closely
 * instead of zig-zagging between noisy fixes.
 */
export function smoothGpsFix(
  prev: RunSample | undefined,
  raw: {
    lat: number;
    lng: number;
    accuracy?: number;
    altitude?: number | null;
    speed?: number | null;
    timeMs: number; // run-relative ms
  },
  opts: { maxAccuracyM?: number; maxSpeedMps?: number; minDeltaM?: number } = {},
): { accepted: false } | { accepted: true; lat: number; lng: number; d: number; total: number; acc?: number; alt?: number } {
  const maxAccuracy = opts.maxAccuracyM ?? 100;
  const maxSpeed = opts.maxSpeedMps ?? 12.5; // ~45 km/h, still rejects GPS teleports
  const minDelta = opts.minDeltaM ?? 0.75;
  const acc = raw.accuracy;

  // Reject very inaccurate fixes outright.
  if (acc != null && acc > maxAccuracy) return { accepted: false };

  if (!prev) {
    return {
      accepted: true,
      lat: raw.lat,
      lng: raw.lng,
      d: 0,
      total: 0,
      acc,
      alt: raw.altitude ?? undefined,
    };
  }

  const rawDist = haversine(
    { lat: prev.lat, lng: prev.lng },
    { lat: raw.lat, lng: raw.lng },
  );
  const dtSec = Math.max(0.001, (raw.timeMs - prev.t) / 1000);

  // Jitter: keep this deliberately permissive so 0.01km changes show quickly.
  // Accuracy still matters, but we cap the noise gate and let device speed prove movement.
  const movingBySensor = typeof raw.speed === "number" && raw.speed > 0.35;
  const noiseFloor = movingBySensor ? minDelta : Math.max(minDelta, Math.min(4, (acc ?? 0) * 0.12));
  if (rawDist < noiseFloor) return { accepted: false };

  // Impossible-speed teleport: reject hard.
  if (rawDist / dtSec > maxSpeed) return { accepted: false };

  // Accuracy-weighted blend toward the new fix. When the new fix is much
  // less accurate than our prior position, we trust it less.
  const prevAcc = prev.acc ?? 10;
  const newAcc = acc ?? 10;
  const baseK = prevAcc / (prevAcc + newAcc); // 0..1, higher = trust new fix more
  const k = Math.min(0.85, Math.max(movingBySensor ? 0.55 : 0.35, baseK));
  const blendedLat = prev.lat + k * (raw.lat - prev.lat);
  const blendedLng = prev.lng + k * (raw.lng - prev.lng);

  const d = haversine(
    { lat: prev.lat, lng: prev.lng },
    { lat: blendedLat, lng: blendedLng },
  );
  if (d < minDelta) return { accepted: false };

  return {
    accepted: true,
    lat: blendedLat,
    lng: blendedLng,
    d,
    total: prev.total + d,
    acc,
    alt: raw.altitude ?? undefined,
  };
}

export function elevationGain(samples: RunSample[]): number {
  let gain = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].alt;
    const b = samples[i].alt;
    if (typeof a === "number" && typeof b === "number") {
      const d = b - a;
      if (d > 0.5) gain += d; // threshold to ignore noise
    }
  }
  return Math.round(gain);
}

/** Build an SVG path string from samples, normalized to a 100×100 viewBox. */
export function samplesToSvgPath(
  samples: RunSample[],
  pad = 4,
): { d: string; start?: { x: number; y: number }; end?: { x: number; y: number } } {
  if (samples.length < 2) return { d: "" };
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const s of samples) {
    if (s.lat < minLat) minLat = s.lat;
    if (s.lat > maxLat) maxLat = s.lat;
    if (s.lng < minLng) minLng = s.lng;
    if (s.lng > maxLng) maxLng = s.lng;
  }
  const latRange = Math.max(maxLat - minLat, 1e-9);
  const lngRange = Math.max(maxLng - minLng, 1e-9);
  // Account for longitude scaling at this latitude
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const effLngRange = lngRange * lngScale;
  const scale = Math.min((100 - 2 * pad) / latRange, (100 - 2 * pad) / Math.max(effLngRange, 1e-9));
  const offsetX = (100 - effLngRange * scale) / 2;
  const offsetY = (100 - latRange * scale) / 2;
  const pts = samples.map((s) => ({
    x: offsetX + (s.lng - minLng) * lngScale * scale,
    y: 100 - (offsetY + (s.lat - minLat) * scale), // flip so north = up
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  return { d, start: pts[0], end: pts[pts.length - 1] };
}

export function summarizeRun(
  samples: RunSample[],
  durationSec: number,
): Pick<Run, "distanceM" | "avgPaceSecPerKm" | "bestPaceSecPerKm" | "elevGainM" | "splits"> {
  const distanceM = samples.length ? samples[samples.length - 1].total : 0;
  return {
    distanceM,
    avgPaceSecPerKm: avgPace(distanceM, durationSec),
    bestPaceSecPerKm: bestKmPace(samples),
    elevGainM: elevationGain(samples),
    splits: computeSplits(samples),
  };
}
