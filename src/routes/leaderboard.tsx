import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ChevronLeft, Dumbbell, Flame, Medal, Scale, Swords, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getSeasonInfo } from "@/lib/competition";
import {
  getLeaderboard,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/lib/leaderboard.functions";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "DEADSET - Leaderboards" }] }),
  component: LeaderboardPage,
});

type BoardGroup = "SEASON" | "STRENGTH" | "CONSISTENCY";

const GROUPS: Array<{ key: BoardGroup; label: string; icon: typeof Trophy }> = [
  { key: "SEASON", label: "Season", icon: Swords },
  { key: "STRENGTH", label: "Strength", icon: Dumbbell },
  { key: "CONSISTENCY", label: "Training", icon: Activity },
];

const BOARDS: Record<
  BoardGroup,
  Array<{ key: LeaderboardCategory; label: string; description: string }>
> = {
  SEASON: [
    {
      key: "WEEKLY",
      label: "Weekly",
      description: "Workouts, trained days, working sets, volume and PRs this week.",
    },
    {
      key: "RANK",
      label: "Rank",
      description: "Your long-term DEADSET grit and league position.",
    },
    {
      key: "OVERALL",
      label: "Overall",
      description: "Balanced strength, training, consistency and nutrition rating.",
    },
  ],
  STRENGTH: [
    { key: "TOTAL", label: "Big 3", description: "Bench + squat + deadlift estimated 1RM." },
    {
      key: "P4P",
      label: "Pound for pound",
      description: "Big Three total divided by body weight.",
    },
    { key: "BENCH", label: "Bench", description: "Highest bench press estimated 1RM." },
    { key: "SQUAT", label: "Squat", description: "Highest back squat estimated 1RM." },
    { key: "DEADLIFT", label: "Deadlift", description: "Highest deadlift estimated 1RM." },
  ],
  CONSISTENCY: [
    { key: "VOLUME", label: "Volume", description: "Total working weight moved this week." },
    { key: "PRS", label: "PRs", description: "Personal records earned this week." },
    { key: "STREAK", label: "Streak", description: "Current consecutive training-day streak." },
  ],
};

function LeaderboardPage() {
  const navigate = useNavigate();
  const season = getSeasonInfo();
  const [group, setGroup] = useState<BoardGroup>("SEASON");
  const [category, setCategory] = useState<LeaderboardCategory>("WEEKLY");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    void getLeaderboard({ data: { category, limit: 100 } })
      .then((result) => {
        if (active) setRows(result.rows);
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, retry]);

  const boards = BOARDS[group];
  const board = boards.find((item) => item.key === category) ?? boards[0];
  const myRank = meId ? rows.findIndex((row) => row.id === meId) : -1;

  function chooseGroup(next: BoardGroup) {
    setGroup(next);
    setCategory(BOARDS[next][0].key);
  }

  return (
    <div className="deadset-page pb-20" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="deadset-section flex items-center gap-3 pt-4">
        <button
          onClick={() => navigate({ to: "/friends" as never })}
          aria-label="Back to friends"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-grit bg-grit-card text-grit-dim press"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="label-cap text-[10px] text-accent-red">DEADSET Arenas</p>
          <h1 className="display text-3xl font-black uppercase leading-none text-grit">
            Leaderboards
          </h1>
        </div>
      </header>

      <section className="deadset-section">
        <div className="border-y border-white/10 bg-[#111216] py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-cap flex items-center gap-1.5 text-[10px] text-accent-red">
                <Swords size={12} /> {season.label}
              </p>
              <h2 className="display mt-1 text-2xl font-black uppercase text-grit">
                Earn your position
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-grit-dim">
                Weekly competition resets every Monday. Your league rank stays tied to long-term
                grit.
              </p>
            </div>
            <div className="shrink-0 border-l border-white/10 pl-4 text-right">
              <p className="display text-3xl font-black text-accent-red">{season.daysLeft}</p>
              <p className="text-[9px] font-bold uppercase text-grit-dim">Days left</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              to="/challenges"
              className="btn-grit flex min-h-11 items-center justify-center gap-2 text-xs"
            >
              <Flame size={14} /> Challenges
            </Link>
            <Link
              to="/friends"
              className="btn-ghost flex min-h-11 items-center justify-center gap-2 text-xs"
            >
              Find rivals
            </Link>
          </div>
        </div>
      </section>

      <section className="deadset-section">
        <div className="grid grid-cols-3 border border-grit bg-grit-card p-1">
          {GROUPS.map((item) => {
            const Icon = item.icon;
            const selected = item.key === group;
            return (
              <button
                key={item.key}
                onClick={() => chooseGroup(item.key)}
                aria-pressed={selected}
                className={`flex min-h-11 items-center justify-center gap-1.5 px-2 text-[10px] font-black uppercase transition-colors ${
                  selected ? "bg-accent-red text-white" : "text-grit-dim"
                }`}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {boards.map((item) => (
            <button
              key={item.key}
              onClick={() => setCategory(item.key)}
              aria-pressed={category === item.key}
              className={`flex min-h-11 shrink-0 items-center border px-3 text-[10px] font-black uppercase transition-colors ${
                category === item.key
                  ? "border-accent-red bg-accent-red/10 text-accent-red"
                  : "border-grit text-grit-dim"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h2 className="display text-2xl font-black uppercase text-grit">{board.label}</h2>
            <p className="mt-1 text-xs leading-relaxed text-grit-dim">{board.description}</p>
          </div>
          {myRank >= 0 && (
            <div className="shrink-0 text-right">
              <p className="display text-2xl font-black text-accent-red">#{myRank + 1}</p>
              <p className="text-[9px] font-bold uppercase text-grit-dim">Your place</p>
            </div>
          )}
        </div>
      </section>

      <section className="deadset-section pt-0">
        {loading && (
          <div className="border border-grit bg-grit-card py-10 text-center text-sm text-grit-dim">
            Loading board...
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="border border-grit bg-grit-card px-5 py-8 text-center">
            <Trophy size={22} className="mx-auto text-grit-dim" />
            <h3 className="display mt-3 text-xl font-black uppercase text-grit">
              {failed ? "Board unavailable" : "First place is open"}
            </h3>
            <p className="mt-2 text-sm text-grit-dim">
              {failed
                ? "The board could not load. Check your connection and try again."
                : "Log a qualifying workout or PR to enter this board."}
            </p>
            {failed && (
              <button
                onClick={() => setRetry((current) => current + 1)}
                className="btn-ghost mt-4 min-h-11 px-5"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-hidden border-y border-white/10">
            {rows.map((row, index) => {
              const isMe = row.id === meId;
              const podium = index < 3;
              return (
                <Link
                  key={row.id}
                  to="/athlete/$id"
                  params={{ id: row.id }}
                  className={`flex min-h-[68px] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 ${
                    isMe ? "bg-accent-red/10" : "bg-[#111216]"
                  }`}
                >
                  <div
                    className={`w-8 shrink-0 text-center display text-base font-black ${
                      podium ? "text-accent-red" : "text-grit-dim"
                    }`}
                  >
                    {podium ? <Medal size={18} className="inline" /> : `#${index + 1}`}
                  </div>
                  {row.avatar_url ? (
                    <img
                      src={row.avatar_url}
                      alt=""
                      className="h-10 w-10 shrink-0 border border-grit object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 shrink-0 place-items-center border border-grit bg-black text-sm font-black text-grit">
                      {(row.display_name || row.username || "A")[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-grit">
                      {row.display_name || row.username || "Athlete"}
                      {isMe && (
                        <span className="ml-2 text-[9px] font-black uppercase text-accent-red">
                          You
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] font-bold uppercase text-grit-dim">
                      {row.rank_label || row.level || "Unranked"}
                      {row.username ? ` · @${row.username}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="display text-lg font-black leading-none text-grit">
                      {row.value.toLocaleString()}
                    </p>
                    <p className="mt-1 text-[9px] font-bold uppercase text-grit-dim">{row.unit}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {category === "P4P" && (
          <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-grit-dim">
            <Scale size={14} className="mt-0.5 shrink-0 text-accent-red" />
            Add your body weight and Big Three records to qualify.
          </div>
        )}
      </section>
    </div>
  );
}
