import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Trophy, ChevronDown } from "lucide-react";

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
  PUSH: "Push",
  PULL: "Pull",
  LEGS: "Legs",
  CORE: "Core",
  OTHER: "Other",
};

const SEVEN_DAYS = 7 * 24 * 3600 * 1000;

function isFresh(iso: string) {
  return Date.now() - new Date(iso).getTime() < SEVEN_DAYS;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PRRow({ pr }: { pr: PRRecord }) {
  const fresh = isFresh(pr.date);
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-grit-card border border-grit">
      <div className="min-w-0 flex-1">
        <p className="font-bold uppercase text-xs text-grit tracking-wide truncate">{pr.name}</p>
        <p className="text-[10px] uppercase tracking-wider text-grit-dim mt-0.5">
          {formatDate(pr.date)}
          {fresh && <span className="ml-2 text-accent-red font-bold tracking-widest">NEW</span>}
        </p>
      </div>
      <div className="flex items-baseline gap-1 flex-shrink-0">
        <span className="display text-xl font-extrabold text-accent-red leading-none">
          {pr.weight}
        </span>
        <span className="text-[10px] font-bold text-grit-dim uppercase tracking-wider">kg</span>
        {pr.reps > 0 && (
          <span className="text-[10px] font-bold text-grit uppercase tracking-wider ml-1">
            ×{pr.reps}
          </span>
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
    <div className="space-y-3">
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
              <div className="flex flex-col gap-1.5 mt-1.5">
                {list.map((pr) => (
                  <PRRow key={pr.exerciseId} pr={pr} />
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
