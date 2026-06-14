import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  getLeaderboard,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/lib/leaderboard.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "DEADSET — Leaderboard" }] }),
  component: LeaderboardPage,
});

const CATS: { key: LeaderboardCategory; label: string }[] = [
  { key: "OVERALL", label: "OVERALL" },
  { key: "TOTAL", label: "TOTAL" },
  { key: "BENCH", label: "BENCH" },
  { key: "SQUAT", label: "SQUAT" },
  { key: "DEADLIFT", label: "DEAD" },
  { key: "OHP", label: "OHP" },
];

const RANK_KEY = "deadset_lb_ranks_v3";
function loadRanks(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(RANK_KEY) ?? "{}"); } catch { return {}; }
}
function saveRanks(r: Record<string, number>) {
  try { localStorage.setItem(RANK_KEY, JSON.stringify(r)); } catch {}
}

function Avatar({ row, size = 40 }: { row: LeaderboardRow; size?: number }) {
  const init = (row.display_name || row.username || "A")[0]?.toUpperCase();
  if (row.avatar_url)
    return <img src={row.avatar_url} alt="" className="border border-grit object-cover flex-shrink-0 rounded-sm" style={{ width: size, height: size }} />;
  return (
    <div className="border border-grit flex items-center justify-center display font-extrabold text-grit flex-shrink-0 rounded-sm" style={{ width: size, height: size, background: "#1a1a1a", fontSize: size * 0.38 }}>
      {init}
    </div>
  );
}

function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="text-[9px] text-grit-dim label-cap">NEW</span>;
  if (d === 0) return <Minus size={9} className="text-grit-dim" />;
  if (d > 0) return <span className="flex items-center gap-px text-[9px] font-bold" style={{ color: "#22c55e" }}><TrendingUp size={9} />+{d}</span>;
  return <span className="flex items-center gap-px text-[9px] font-bold" style={{ color: "#E10600" }}><TrendingDown size={9} />{d}</span>;
}

function LeaderboardPage() {
  const navigate = useNavigate();
  const fetchBoard = useServerFn(getLeaderboard);
  const [cat, setCat] = useState<LeaderboardCategory>("OVERALL");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const prevRanks = useRef<Record<string, number>>(loadRanks());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchBoard({ data: { category: cat } })
      .then(({ rows: r }) => {
        setRows(r);
        const updated = { ...prevRanks.current };
        r.forEach((row, i) => { updated[`${cat}:${row.id}`] = i + 1; });
        saveRanks(updated);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [cat, fetchBoard]);

  const myRank = meId ? rows.findIndex((r) => r.id === meId) + 1 : 0;

  function delta(row: LeaderboardRow, rank: number): number | null {
    const prev = prevRanks.current[`${cat}:${row.id}`];
    if (prev === undefined) return null;
    return prev - rank;
  }

  const [p1, p2, p3, ...rest] = rows;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0A0A0A", paddingTop: "env(safe-area-inset-top)" }}>
      {/* Header */}
      <header className="px-5 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: "1px solid #262626" }}>
        <button onClick={() => navigate({ to: "/friends" as never })} className="p-1 -ml-1 text-grit-dim">
          <ChevronLeft size={20} />
        </button>
        <Trophy size={15} style={{ color: "#E10600" }} />
        <p className="display text-lg font-extrabold uppercase text-grit leading-none">Leaderboard</p>
      </header>

      {/* Category tabs */}
      <div className="px-3 pt-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className="px-3 py-1.5 label-cap text-[11px] border whitespace-nowrap transition-colors"
            style={{
              background: cat === c.key ? "#E10600" : "transparent",
              borderColor: cat === c.key ? "#E10600" : "#262626",
              color: cat === c.key ? "#fff" : "#8A8A8A",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* My rank banner */}
      {myRank > 0 && (
        <div className="mx-3 mb-3 px-4 py-2 flex items-center justify-between" style={{ background: "rgba(225,6,0,0.08)", border: "1px solid rgba(225,6,0,0.35)" }}>
          <span className="label-cap text-[10px] text-grit-dim">YOUR RANK</span>
          <span className="display text-xl font-extrabold" style={{ color: "#E10600" }}>#{myRank}</span>
          <span className="label-cap text-[10px] text-grit-dim">of {rows.length}</span>
        </div>
      )}

      {loading && <p className="text-center py-12 text-grit-dim text-sm">Loading…</p>}

      {!loading && rows.length === 0 && (
        <div className="mx-3 p-8 text-center text-sm text-grit-dim" style={{ border: "1px solid #262626" }}>
          No ranked athletes yet. Log lifts to appear here.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          {/* ── Podium ── */}
          <div className="mx-3 mb-4 p-4" style={{ background: "#141414", border: "1px solid #262626" }}>
            <p className="label-cap text-[9px] text-grit-dim text-center mb-4 tracking-widest">THIS WEEK'S PODIUM</p>
            <div className="flex items-end justify-center gap-2">

              {/* #2 Silver */}
              {p2 ? (
                <Link to="/athlete/$id" params={{ id: p2.id }} className="flex flex-col items-center gap-1.5 flex-1">
                  <Avatar row={p2} size={36} />
                  <p className="text-[9px] font-bold text-grit truncate w-full text-center">{p2.display_name || p2.username || "—"}</p>
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: 44, background: "rgba(192,192,192,0.12)", border: "1px solid rgba(192,192,192,0.25)" }}>
                    <span className="display text-sm font-extrabold" style={{ color: "#C0C0C0" }}>2</span>
                  </div>
                  <p className="display text-xs font-extrabold" style={{ color: "#C0C0C0" }}>{p2.value}<span className="text-grit-dim font-normal"> {p2.unit}</span></p>
                </Link>
              ) : <div className="flex-1" />}

              {/* #1 Gold */}
              {p1 && (
                <Link to="/athlete/$id" params={{ id: p1.id }} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="relative">
                    <Avatar row={p1} size={44} />
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-sm">👑</span>
                  </div>
                  <p className="text-[9px] font-bold text-grit truncate w-full text-center">{p1.display_name || p1.username || "—"}</p>
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: 60, background: "rgba(245,197,66,0.12)", border: "1px solid rgba(245,197,66,0.3)" }}>
                    <span className="display text-xl font-extrabold" style={{ color: "#f5c542" }}>1</span>
                  </div>
                  <p className="display text-sm font-extrabold" style={{ color: "#f5c542" }}>{p1.value}<span className="text-grit-dim font-normal"> {p1.unit}</span></p>
                </Link>
              )}

              {/* #3 Bronze */}
              {p3 ? (
                <Link to="/athlete/$id" params={{ id: p3.id }} className="flex flex-col items-center gap-1.5 flex-1">
                  <Avatar row={p3} size={32} />
                  <p className="text-[9px] font-bold text-grit truncate w-full text-center">{p3.display_name || p3.username || "—"}</p>
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: 32, background: "rgba(205,127,50,0.12)", border: "1px solid rgba(205,127,50,0.25)" }}>
                    <span className="display text-xs font-extrabold" style={{ color: "#cd7f32" }}>3</span>
                  </div>
                  <p className="display text-xs font-extrabold" style={{ color: "#cd7f32" }}>{p3.value}<span className="text-grit-dim font-normal"> {p3.unit}</span></p>
                </Link>
              ) : <div className="flex-1" />}
            </div>
          </div>

          {/* ── Rest of list ── */}
          <div className="px-3 space-y-1">
            {rest.map((r, i) => {
              const rank = i + 4;
              const isMe = r.id === meId;
              return (
                <Link
                  key={r.id}
                  to="/athlete/$id"
                  params={{ id: r.id }}
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{
                    background: isMe ? "rgba(225,6,0,0.08)" : "#141414",
                    border: `1px solid ${isMe ? "rgba(225,6,0,0.5)" : "#262626"}`,
                  }}
                >
                  <span className="w-6 label-cap text-[10px] text-grit-dim text-center flex-shrink-0">#{rank}</span>
                  <span className="w-6 flex items-center justify-center flex-shrink-0">
                    <Delta d={delta(r, rank)} />
                  </span>
                  <Avatar row={r} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-grit truncate">
                      {r.display_name || r.username || "Athlete"}
                      {isMe && <span className="ml-2 label-cap text-[9px]" style={{ color: "#E10600" }}>YOU</span>}
                    </p>
                    <p className="text-[10px] text-grit-dim label-cap truncate">
                      {r.username ? `@${r.username}` : ""}{r.level ? ` · ${r.level}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="display text-base font-extrabold text-grit leading-none">{r.value}</p>
                    <p className="text-[9px] text-grit-dim label-cap">{r.unit}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
