import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Trophy, ChevronDown, Calendar } from "lucide-react";

export type PRRecord = {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  date: string; // ISO
  group: PRGroup;
  history: { date: string; weight: number }[];
};

export type PRGroup = "PUSH" | "PULL" | "LEGS" | "CORE" | "OTHER";

const GROUP_ORDER: PRGroup[] = ["PUSH", "PULL", "LEGS", "CORE", "OTHER"];

const GROUP_LABEL: Record<PRGroup, string> = {
  PUSH: "Push — Chest / Shoulders / Triceps",
  PULL: "Pull — Back / Biceps",
  LEGS: "Legs — Quads / Hams / Glutes",
  CORE: "Core",
  OTHER: "Other",
};

const SEVEN_DAYS = 7 * 24 * 3600 * 1000;

function isFresh(iso: string) {
  return Date.now() - new Date(iso).getTime() < SEVEN_DAYS;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Sparkline({ points }: { points: { date: string; weight: number }[] }) {
  if (points.length < 2) {
    return (
      <div className="h-8 flex items-end gap-[2px]">
        <div className="w-full h-1 bg-grit/40" />
      </div>
    );
  }
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const W = 100;
  const H = 28;
  const step = W / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = H - ((p.weight - min) / range) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = points[points.length - 1];
  const lastX = W;
  const lastY = H - ((last.weight - min) / range) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-8 overflow-visible">
      <defs>
        <linearGradient id="prspark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e63222" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e63222" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#prspark)" />
      <path d={path} fill="none" stroke="#e63222" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill="#e63222" />
    </svg>
  );
}

function PRCard({ pr }: { pr: PRRecord }) {
  const fresh = isFresh(pr.date);
  return (
    <div className="bg-grit-card border border-grit p-4 flex flex-col gap-3 relative">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold uppercase text-sm text-grit tracking-wide leading-tight pr-6">
          {pr.name}
        </p>
        <div
          className={`flex-shrink-0 p-1.5 border ${
            fresh
              ? "border-accent-red text-accent-red bg-accent-red/10"
              : "border-grit text-grit-dim"
          }`}
          style={fresh ? { boxShadow: "0 0 12px rgba(230,50,34,0.5)" } : undefined}
          aria-label={fresh ? "New PR this week" : "PR"}
        >
          <Trophy size={12} />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <p className="display text-4xl font-extrabold text-accent-red leading-none">{pr.weight}</p>
        <p className="display text-sm font-bold text-grit-dim uppercase tracking-wider">kg</p>
        {pr.reps > 0 && (
          <p className="display text-sm font-bold text-grit ml-1 uppercase tracking-wider">
            × {pr.reps}
          </p>
        )}
      </div>

      <Sparkline points={pr.history} />

      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-grit-dim">
        <Calendar size={10} />
        <span>{formatDate(pr.date)}</span>
        {fresh && (
          <span className="ml-auto text-accent-red font-bold tracking-widest">NEW</span>
        )}
      </div>
    </div>
  );
}

export function PRList({ prs }: { prs: PRRecord[] }) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<PRGroup, boolean>>({
    PUSH: true,
    PULL: true,
    LEGS: true,
    CORE: true,
    OTHER: false,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prs;
    return prs.filter((p) => p.name.toLowerCase().includes(q));
  }, [prs, query]);

  const grouped = useMemo(() => {
    const map: Record<PRGroup, PRRecord[]> = { PUSH: [], PULL: [], LEGS: [], CORE: [], OTHER: [] };
    filtered.forEach((p) => map[p.group].push(p));
    GROUP_ORDER.forEach((g) =>
      map[g].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    );
    return map;
  }, [filtered]);

  if (prs.length === 0) {
    return (
      <div className="bg-grit-card border border-grit p-8 flex flex-col items-center text-center gap-4">
        <div className="p-4 border border-grit text-grit-dim">
          <Trophy size={32} />
        </div>
        <div>
          <p className="display text-lg font-extrabold uppercase text-grit tracking-wide">
            No PRs yet
          </p>
          <p className="text-xs text-grit-dim mt-1 uppercase tracking-wider">
            Start logging to set your first record
          </p>
        </div>
        <Link
          to="/train"
          className="bg-accent-red text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-accent-red/90"
        >
          Start a workout
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-grit-dim pointer-events-none"
        />
        <input
          type="text"
          inputMode="search"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-grit-card border border-grit text-grit pl-9 pr-3 py-2.5 text-sm placeholder:text-grit-dim focus:outline-none focus:border-accent-red"
        />
      </div>

      {GROUP_ORDER.map((g) => {
        const list = grouped[g];
        if (list.length === 0) return null;
        const open = openGroups[g];
        return (
          <section key={g}>
            <button
              type="button"
              onClick={() => setOpenGroups((s) => ({ ...s, [g]: !s[g] }))}
              className="w-full flex items-center justify-between px-3 py-2 bg-grit-card border border-grit hover:border-accent-red transition-colors"
            >
              <span className="label-cap text-xs text-grit">
                {GROUP_LABEL[g]} <span className="text-grit-dim ml-1">· {list.length}</span>
              </span>
              <ChevronDown
                size={14}
                className="text-grit-dim transition-transform"
                style={{ transform: open ? "rotate(180deg)" : "none" }}
              />
            </button>
            {open && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {list.map((pr) => (
                  <PRCard key={pr.exerciseId} pr={pr} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {filtered.length === 0 && query && (
        <p className="text-center text-xs text-grit-dim uppercase tracking-wider py-6">
          No exercises match "{query}"
        </p>
      )}
    </div>
  );
}

export function groupForMuscle(muscleGroup: string | undefined, exerciseId: string): PRGroup {
  // ARMS split: triceps → PUSH, biceps → PULL
  if (/curl/i.test(exerciseId)) return "PULL";
  if (/skull|tricep|pushdown/i.test(exerciseId)) return "PUSH";
  switch ((muscleGroup || "").toUpperCase()) {
    case "CHEST":
    case "SHOULDERS":
      return "PUSH";
    case "BACK":
      return "PULL";
    case "LEGS":
      return "LEGS";
    case "CORE":
      return "CORE";
    case "ARMS":
      return "PUSH";
    default:
      return "OTHER";
  }
}
