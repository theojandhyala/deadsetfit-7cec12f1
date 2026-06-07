import type { Run, RunSample } from "@/lib/types";

/** Find personal records across all runs */
export function computeRunPRs(runs: Run[]) {
  if (runs.length === 0) {
    return {
      longest: null as Run | null,
      fastest1k: null as { run: Run; sec: number } | null,
      fastest5k: null as { run: Run; sec: number } | null,
      fastest10k: null as { run: Run; sec: number } | null,
      mostElev: null as Run | null,
    };
  }
  let longest = runs[0];
  let mostElev = runs[0];
  let fastest1k: { run: Run; sec: number } | null = null;
  let fastest5k: { run: Run; sec: number } | null = null;
  let fastest10k: { run: Run; sec: number } | null = null;

  for (const r of runs) {
    if (r.distanceM > longest.distanceM) longest = r;
    if ((r.elevGainM ?? 0) > (mostElev.elevGainM ?? 0)) mostElev = r;

    const f1 = fastestRollingSec(r.samples, 1000);
    if (f1 && (!fastest1k || f1 < fastest1k.sec)) fastest1k = { run: r, sec: f1 };

    if (r.distanceM >= 5000) {
      const f5 = fastestRollingSec(r.samples, 5000);
      if (f5 && (!fastest5k || f5 < fastest5k.sec)) fastest5k = { run: r, sec: f5 };
    }
    if (r.distanceM >= 10000) {
      const f10 = fastestRollingSec(r.samples, 10000);
      if (f10 && (!fastest10k || f10 < fastest10k.sec)) fastest10k = { run: r, sec: f10 };
    }
  }

  return { longest, fastest1k, fastest5k, fastest10k, mostElev };
}

/** Fastest rolling window of N meters, returns seconds */
function fastestRollingSec(samples: RunSample[], meters: number): number | null {
  if (samples.length < 2) return null;
  let best = Infinity;
  let i = 0;
  for (let j = 1; j < samples.length; j++) {
    while (i < j && samples[j].total - samples[i].total > meters) i++;
    if (i > 0) {
      const a = samples[i - 1];
      const b = samples[j];
      if (b.total - a.total >= meters) {
        const dt = (b.t - a.t) / 1000;
        if (dt > 0 && dt < best) best = dt;
      }
    }
  }
  return isFinite(best) ? best : null;
}

/** Build a smoothed pace-over-distance series (sec/km vs km) */
export function paceSeries(samples: RunSample[], buckets = 40) {
  if (samples.length < 2) return [];
  const total = samples[samples.length - 1].total;
  if (total < 50) return [];
  const step = total / buckets;
  const out: { km: number; pace: number }[] = [];
  let i = 0;
  for (let b = 1; b <= buckets; b++) {
    const target = step * b;
    while (i < samples.length - 1 && samples[i + 1].total < target) i++;
    const start = samples[Math.max(0, i - Math.floor(buckets / 8))];
    const end = samples[i + 1] ?? samples[i];
    const dd = end.total - start.total;
    const dt = (end.t - start.t) / 1000;
    if (dd > 5 && dt > 0) {
      out.push({ km: end.total / 1000, pace: dt / (dd / 1000) });
    }
  }
  return out;
}

/** Build an elevation-over-distance series */
export function elevationSeries(samples: RunSample[], buckets = 40) {
  if (samples.length < 2) return [];
  const withAlt = samples.filter((s) => typeof s.alt === "number");
  if (withAlt.length < 2) return [];
  const total = withAlt[withAlt.length - 1].total;
  const step = total / buckets;
  const out: { km: number; alt: number }[] = [];
  let i = 0;
  for (let b = 1; b <= buckets; b++) {
    const target = step * b;
    while (i < withAlt.length - 1 && withAlt[i + 1].total < target) i++;
    out.push({ km: withAlt[i].total / 1000, alt: withAlt[i].alt! });
  }
  return out;
}

/** Categorize splits into pace zones (Z1=easy → Z5=sprint) relative to avg pace */
export function paceZones(splits: number[], avgPace: number) {
  if (!splits.length || !avgPace) return [];
  const zones = [
    { name: "Z1 Easy", min: 1.15, max: Infinity, color: "#3b82f6" },
    { name: "Z2 Steady", min: 1.05, max: 1.15, color: "#22c55e" },
    { name: "Z3 Tempo", min: 0.95, max: 1.05, color: "#eab308" },
    { name: "Z4 Threshold", min: 0.85, max: 0.95, color: "#f97316" },
    { name: "Z5 VO2", min: 0, max: 0.85, color: "#e63222" },
  ];
  const buckets = zones.map((z) => ({ ...z, count: 0 }));
  for (const s of splits) {
    const ratio = s / avgPace;
    for (const b of buckets) {
      if (ratio >= b.min && ratio < b.max) {
        b.count++;
        break;
      }
    }
  }
  const total = splits.length;
  return buckets.map((b) => ({ ...b, pct: total ? (b.count / total) * 100 : 0 }));
}
