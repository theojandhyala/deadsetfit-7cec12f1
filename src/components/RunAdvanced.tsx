import { useEffect, useState } from "react";

import { Activity, Lock, Mountain, Sparkles, Target, TrendingUp, Trophy, Zap } from "lucide-react";
import { usePro, usePaywall } from "@/hooks/usePro";
import { getRunCoachTips, type RunCoachInsight } from "@/lib/run-coach.functions";
import {
  computeRunPRs,
  elevationSeries,
  paceSeries,
  paceZones,
} from "@/lib/run-analytics";
import { formatDuration, formatPace } from "@/lib/run";
import type { Run } from "@/lib/types";

interface RunAdvancedProps {
  run: Run;
  allRuns: Run[];
}

export function RunAdvanced({ run, allRuns }: RunAdvancedProps) {
  const { isPro, loading } = usePro();
  const { open: openPaywall } = usePaywall();

  if (loading) {
    return (
      <div className="bg-grit-card border border-grit p-6 text-center">
        <span className="label-cap text-grit-dim text-xs animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!isPro) {
    return (
      <section className="relative bg-grit-card border border-accent-red/60 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(230,50,34,0.08), transparent 60%)",
          }}
        />
        <div className="relative p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent-red" />
              <span className="label-cap text-[10px] text-accent-red">PRO ANALYSIS</span>
            </div>
            <Lock size={14} className="text-accent-red" />
          </div>
          <div>
            <h3 className="display text-xl font-extrabold uppercase text-grit tracking-tight leading-tight">
              Unlock Advanced Run Data
            </h3>
            <p className="text-xs text-grit-dim mt-2 leading-relaxed">
              AI coach tips on every run, pace charts, elevation profile, pace
              zones, personal records (1k / 5k / 10k), and training trends.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-grit-dim">
            <li className="flex items-center gap-1.5"><Activity size={12} className="text-accent-red" /> Pace chart</li>
            <li className="flex items-center gap-1.5"><Mountain size={12} className="text-accent-red" /> Elevation profile</li>
            <li className="flex items-center gap-1.5"><Target size={12} className="text-accent-red" /> Pace zones</li>
            <li className="flex items-center gap-1.5"><Trophy size={12} className="text-accent-red" /> Run PRs</li>
            <li className="flex items-center gap-1.5"><TrendingUp size={12} className="text-accent-red" /> Training trends</li>
            <li className="flex items-center gap-1.5"><Sparkles size={12} className="text-accent-red" /> AI coach tips</li>
          </ul>
          <button
            onClick={() =>
              openPaywall({
                feature: "Advanced Run Data",
                description:
                  "AI coach insights, pace & elevation charts, pace zones, and personal records on every run.",
              })
            }
            className="w-full bg-accent-red text-white py-3 font-extrabold uppercase tracking-widest text-xs hover:bg-accent-red/90 transition-colors"
            style={{ boxShadow: "0 0 18px rgba(230,50,34,0.4)" }}
          >
            Go Pro
          </button>
        </div>
      </section>
    );
  }

  return <RunAdvancedContent run={run} allRuns={allRuns} />;
}

function RunAdvancedContent({ run, allRuns }: { run: Run; allRuns: Run[] }) {
  const pace = paceSeries(run.samples);
  const elev = elevationSeries(run.samples);
  const zones = paceZones(run.splits, run.avgPaceSecPerKm);
  const prs = computeRunPRs(allRuns);

  return (
    <div className="space-y-3">
      <CoachCard run={run} allRuns={allRuns} />

      {/* Pace chart */}
      {pace.length > 1 && (
        <ChartCard
          icon={<Activity size={14} className="text-accent-red" />}
          title="Pace"
          subtitle={`Avg ${formatPace(run.avgPaceSecPerKm)}/km`}
        >
          <PaceChart data={pace} avg={run.avgPaceSecPerKm} />
        </ChartCard>
      )}

      {/* Elevation profile */}
      {elev.length > 1 && (
        <ChartCard
          icon={<Mountain size={14} className="text-accent-red" />}
          title="Elevation"
          subtitle={run.elevGainM ? `+${run.elevGainM} m gained` : ""}
        >
          <ElevationChart data={elev} />
        </ChartCard>
      )}

      {/* Pace zones */}
      {zones.some((z) => z.count > 0) && (
        <ChartCard
          icon={<Target size={14} className="text-accent-red" />}
          title="Pace zones"
          subtitle={`${run.splits.length} km splits`}
        >
          <ZoneBar zones={zones} />
        </ChartCard>
      )}

      {/* Personal records */}
      {allRuns.length > 1 && <PRSection prs={prs} thisRunId={run.id} />}
    </div>
  );
}

function ChartCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-grit-card border border-grit p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="label-cap text-xs text-grit">{title}</h2>
        </div>
        {subtitle && (
          <span className="text-[10px] uppercase tracking-wider text-grit-dim">
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/* ===== Coach card ===== */

function CoachCard({ run, allRuns }: { run: Run; allRuns: Run[] }) {
  const getTips = getRunCoachTips;
  const [insight, setInsight] = useState<RunCoachInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setInsight(null);
    const recent = allRuns
      .filter((r) => r.id !== run.id)
      .slice(0, 5)
      .map((r) => r.distanceM / 1000);
    getTips({
      data: {
        distanceKm: run.distanceM / 1000,
        durationSec: run.durationSec,
        avgPaceSecPerKm: run.avgPaceSecPerKm,
        bestKmPaceSecPerKm: run.bestPaceSecPerKm,
        splits: run.splits,
        elevGainM: run.elevGainM,
        recentRunsKm: recent,
      },
    })
      .then((res) => {
        if (!cancelled) setInsight(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load tips";
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);

  return (
    <section className="bg-grit-card border border-accent-red/60 p-4 space-y-3 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(230,50,34,0.08), transparent 70%)",
        }}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent-red" />
          <h2 className="label-cap text-xs text-accent-red">Coach</h2>
        </div>
        <span className="text-[9px] uppercase tracking-widest text-grit-dim">
          PRO · AI
        </span>
      </div>

      {loading && (
        <div className="relative">
          <div className="h-3 w-2/3 bg-grit animate-pulse mb-2" />
          <div className="h-2 w-full bg-grit animate-pulse mb-1.5" />
          <div className="h-2 w-5/6 bg-grit animate-pulse mb-1.5" />
          <div className="h-2 w-4/6 bg-grit animate-pulse" />
        </div>
      )}

      {error && !loading && (
        <p className="relative text-xs text-grit-dim">
          Coach is catching their breath. {error}
        </p>
      )}

      {insight && !loading && (
        <div className="relative space-y-3">
          <div>
            <p className="display text-base font-extrabold uppercase text-grit tracking-tight leading-tight">
              {insight.headline}
            </p>
            <p className="text-xs text-grit-dim mt-1 leading-relaxed">
              {insight.verdict}
            </p>
          </div>
          <ul className="space-y-1.5">
            {insight.tips.map((tip, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs text-grit leading-relaxed"
              >
                <Zap
                  size={12}
                  className="text-accent-red flex-shrink-0 mt-0.5"
                  strokeWidth={3}
                />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-grit pt-2">
            <p className="label-cap text-[9px] text-grit-dim mb-1">NEXT UP</p>
            <p className="text-xs text-grit leading-relaxed">
              {insight.nextWorkout}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ===== Pace chart ===== */

function PaceChart({ data, avg }: { data: { km: number; pace: number }[]; avg: number }) {
  const W = 300;
  const H = 90;
  const pad = { top: 6, right: 4, bottom: 14, left: 4 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const xs = data.map((d) => d.km);
  const ys = data.map((d) => d.pace);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys, avg);
  const maxY = Math.max(...ys, avg);
  const xR = Math.max(maxX - minX, 0.001);
  const yR = Math.max(maxY - minY, 0.001);
  const px = (x: number) => pad.left + ((x - minX) / xR) * innerW;
  const py = (y: number) => pad.top + (1 - (y - minY) / yR) * innerH; // lower pace = faster = top
  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${px(d.km).toFixed(1)},${py(d.pace).toFixed(1)}`)
    .join(" ");
  const fill = `${path} L${px(maxX).toFixed(1)},${pad.top + innerH} L${px(minX).toFixed(1)},${pad.top + innerH} Z`;
  const avgY = py(avg);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-24 overflow-visible"
    >
      <defs>
        <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e63222" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e63222" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={pad.left}
        x2={pad.left + innerW}
        y1={avgY}
        y2={avgY}
        stroke="#404040"
        strokeWidth={0.6}
        strokeDasharray="2 2"
      />
      <path d={fill} fill="url(#paceFill)" />
      <path
        d={path}
        fill="none"
        stroke="#e63222"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={pad.left}
        y={H - 2}
        fontSize="8"
        fill="#737373"
        fontFamily="monospace"
      >
        0 km
      </text>
      <text
        x={pad.left + innerW}
        y={H - 2}
        fontSize="8"
        fill="#737373"
        textAnchor="end"
        fontFamily="monospace"
      >
        {maxX.toFixed(2)} km
      </text>
    </svg>
  );
}

/* ===== Elevation chart ===== */

function ElevationChart({ data }: { data: { km: number; alt: number }[] }) {
  const W = 300;
  const H = 70;
  const pad = { top: 4, right: 4, bottom: 4, left: 4 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const xs = data.map((d) => d.km);
  const ys = data.map((d) => d.alt);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xR = Math.max(maxX - minX, 0.001);
  const yR = Math.max(maxY - minY, 0.001);
  const px = (x: number) => pad.left + ((x - minX) / xR) * innerW;
  const py = (y: number) => pad.top + (1 - (y - minY) / yR) * innerH;
  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${px(d.km).toFixed(1)},${py(d.alt).toFixed(1)}`)
    .join(" ");
  const fill = `${path} L${px(maxX).toFixed(1)},${pad.top + innerH} L${px(minX).toFixed(1)},${pad.top + innerH} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-20"
    >
      <defs>
        <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a8a8a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8a8a8a" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#elevFill)" />
      <path
        d={path}
        fill="none"
        stroke="#a3a3a3"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ===== Zone bar ===== */

function ZoneBar({
  zones,
}: {
  zones: { name: string; pct: number; count: number; color: string }[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden border border-grit">
        {zones.map((z) => (
          <div
            key={z.name}
            style={{ width: `${z.pct}%`, background: z.color }}
            title={`${z.name}: ${z.count}km`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {zones
          .filter((z) => z.count > 0)
          .map((z) => (
            <li
              key={z.name}
              className="flex items-center gap-2 text-[10px] uppercase tracking-wider"
            >
              <span
                className="w-2 h-2 flex-shrink-0"
                style={{ background: z.color }}
              />
              <span className="text-grit-dim flex-1 truncate">{z.name}</span>
              <span className="text-grit font-bold tabular-nums">
                {z.count}km
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/* ===== Personal records ===== */

function PRSection({
  prs,
  thisRunId,
}: {
  prs: ReturnType<typeof computeRunPRs>;
  thisRunId: string;
}) {
  const items: { label: string; value: string; highlight: boolean }[] = [];
  if (prs.longest) {
    items.push({
      label: "Longest",
      value: `${(prs.longest.distanceM / 1000).toFixed(2)} km`,
      highlight: prs.longest.id === thisRunId,
    });
  }
  if (prs.fastest1k) {
    items.push({
      label: "Fastest 1k",
      value: formatDuration(prs.fastest1k.sec),
      highlight: prs.fastest1k.run.id === thisRunId,
    });
  }
  if (prs.fastest5k) {
    items.push({
      label: "Fastest 5k",
      value: formatDuration(prs.fastest5k.sec),
      highlight: prs.fastest5k.run.id === thisRunId,
    });
  }
  if (prs.fastest10k) {
    items.push({
      label: "Fastest 10k",
      value: formatDuration(prs.fastest10k.sec),
      highlight: prs.fastest10k.run.id === thisRunId,
    });
  }
  if (prs.mostElev && (prs.mostElev.elevGainM ?? 0) > 0) {
    items.push({
      label: "Most climb",
      value: `+${prs.mostElev.elevGainM} m`,
      highlight: prs.mostElev.id === thisRunId,
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="bg-grit-card border border-grit p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Trophy size={14} className="text-accent-red" />
        <h2 className="label-cap text-xs text-grit">Personal records</h2>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <li
            key={it.label}
            className={`p-2 border ${
              it.highlight
                ? "border-accent-red bg-accent-red/10"
                : "border-grit"
            }`}
          >
            <p className="text-[9px] uppercase tracking-widest text-grit-dim">
              {it.label}
              {it.highlight && (
                <span className="ml-1.5 text-accent-red font-bold tracking-widest">
                  NEW
                </span>
              )}
            </p>
            <p className="display text-base font-extrabold text-grit leading-none mt-1">
              {it.value}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
