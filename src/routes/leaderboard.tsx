import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Trophy, Medal } from "lucide-react";
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
];

function LeaderboardPage() {
  const navigate = useNavigate();
  const fetchBoard = useServerFn(getLeaderboard);
  const [cat, setCat] = useState<LeaderboardCategory>("OVERALL");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchBoard({ data: { category: cat } })
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [cat, fetchBoard]);

  const myRank = meId ? rows.findIndex((r) => r.id === meId) : -1;

  return (
    <div className="pb-20" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-grit">
        <button onClick={() => navigate({ to: "/friends" as never })} className="p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <Trophy size={16} className="text-accent-red" />
        <p className="display text-lg font-extrabold uppercase text-grit leading-none">
          Leaderboard
        </p>
      </header>

      <div className="px-3 pt-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`px-3 py-1.5 label-cap text-[11px] border whitespace-nowrap transition-colors ${
              cat === c.key
                ? "bg-accent-red border-accent-red text-white"
                : "border-grit text-grit-dim"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {myRank >= 0 && (
        <div className="px-5 py-2 text-[11px] label-cap text-accent-red">
          You're #{myRank + 1} of {rows.length}
        </div>
      )}

      <div className="px-3">
        {loading && <div className="text-center py-8 text-grit-dim text-sm">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="bg-grit-card border border-grit p-6 text-center text-sm text-grit-dim">
            No ranked athletes yet for this category.
          </div>
        )}
        {!loading &&
          rows.map((r, i) => {
            const isMe = r.id === meId;
            const podium = i < 3;
            return (
              <Link
                key={r.id}
                to="/athlete/$id"
                params={{ id: r.id }}
                className={`flex items-center gap-3 px-3 py-2.5 border mb-1.5 transition-colors ${
                  isMe ? "bg-accent-red/10 border-accent-red" : "bg-grit-card border-grit"
                }`}
              >
                <div
                  className={`w-7 text-center display font-extrabold text-sm ${podium ? "text-accent-red" : "text-grit-dim"}`}
                >
                  {podium ? <Medal size={16} className="inline" /> : `#${i + 1}`}
                </div>
                {r.avatar_url ? (
                  <img
                    src={r.avatar_url}
                    alt=""
                    className="w-9 h-9 border border-grit object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 bg-[#1a1a1a] border border-grit flex items-center justify-center display font-extrabold text-grit text-sm">
                    {(r.display_name || r.username || "A")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-grit truncate">
                    {r.display_name || r.username || "Athlete"}
                    {isMe && <span className="ml-2 label-cap text-[9px] text-accent-red">YOU</span>}
                  </p>
                  <p className="text-[10px] text-grit-dim label-cap">
                    {r.username ? `@${r.username}` : ""}
                    {r.level ? ` · ${r.level}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="display text-lg font-extrabold text-grit leading-none">{r.value}</p>
                  <p className="text-[9px] text-grit-dim label-cap">{r.unit}</p>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
