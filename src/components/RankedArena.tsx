import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Share2, Sparkles, Target, Trophy, Zap } from "lucide-react";

import { RankEmblem, RankTierGlyph } from "@/components/RankEmblem";
import { RankShareCard } from "@/components/RankShareCard";
import { calculateGritScore, calculateStreak, isoDay } from "@/lib/calc";
import { getSeasonInfo, getWeeklyCompetitionStats } from "@/lib/competition";
import { buildHeadlinePRs, computeFifaStats } from "@/lib/fifa-stats";
import { getRank, getRankLadder, pointsToNextRank, rankProgress, rankStepBounds } from "@/lib/rank";
import type { Rank } from "@/lib/rank";
import type { AppState } from "@/lib/types";

type RankedArenaProps = {
  state: AppState;
  compact?: boolean;
};

const LADDER = getRankLadder();

export function RankedArena({ state, compact = false }: RankedArenaProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [ladderOpen, setLadderOpen] = useState(false);
  const score = calculateGritScore(state);
  const rank = getRank(score.total);
  const progress = rankProgress(score.total);
  const toNext = pointsToNextRank(score.total);
  const streak = calculateStreak(state.completedDates);
  const fifa = computeFifaStats(state);
  const weekly = getWeeklyCompetitionStats(state);
  const season = getSeasonInfo();
  const today = isoDay();

  const tierIdx = LADDER.findIndex((item) => item.label === rank.label);

  const quests = useMemo(() => {
    const workoutDone = state.completedDates.includes(today);
    const finished = (state.sessions || []).filter((s) => s.endedAt);
    const sessionThisWeek = finished.filter((s) => {
      const age = Date.now() - new Date(s.date).getTime();
      return age <= 7 * 86400000;
    }).length;
    const prThisWeek = finished.reduce((sum, s) => {
      const age = Date.now() - new Date(s.date).getTime();
      return age <= 7 * 86400000 ? sum + (s.prCount || 0) : sum;
    }, 0);

    return [
      {
        label: workoutDone ? "Today's session complete" : "Complete today's workout",
        progress: workoutDone ? "DONE" : "0/1",
        done: workoutDone,
        to: "/train",
      },
      {
        label: sessionThisWeek >= 3 ? "Weekly consistency locked" : "Hit 3 workouts in 7 days",
        progress: `${Math.min(sessionThisWeek, 3)}/3`,
        done: sessionThisWeek >= 3,
        to: "/train",
      },
      {
        label: prThisWeek > 0 ? "PR pressure applied" : "Set one PR in 7 days",
        progress: `${Math.min(prThisWeek, 1)}/1`,
        done: prThisWeek > 0,
        to: "/profile",
      },
    ];
  }, [state.completedDates, state.sessions, today]);

  return (
    <>
      <section className={compact ? "" : "px-5 mb-5"}>
        <div
          className={
            "relative overflow-hidden border " +
            (compact ? "rounded-2xl p-3" : "rounded-[22px] p-4")
          }
          style={{
            borderColor: `${rank.color}2f`,
            boxShadow: `0 18px 46px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.07)`,
            background: `radial-gradient(circle at 86% -10%, ${rank.glowColor}24, transparent 36%), linear-gradient(145deg, rgba(31,33,39,.96), rgba(7,7,9,.98) 58%, rgba(0,0,0,.98))`,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
          <div className="absolute right-4 top-4 h-24 w-24 rounded-full border border-white/5" />
          <div className="absolute right-10 top-10 h-12 w-12 rounded-full border border-white/5" />
          <div className="relative flex items-start gap-3">
            <RankEmblem
              gritPoints={score.total}
              size={compact ? "sm" : "md"}
              showProgress={false}
              showLabel={false}
            />
            <div className="min-w-0 flex-1">
              <p
                className="label-cap text-[10px] flex items-center gap-1.5"
                style={{ color: rank.color }}
              >
                <Trophy size={12} /> RANKED DIVISION
              </p>
              <h2
                className={
                  "display font-black uppercase leading-none mt-1 text-grit " +
                  (compact ? "text-2xl" : "text-[1.7rem]")
                }
              >
                {rank.label}
              </h2>
              <p className="text-[11px] text-grit-dim mt-1 font-semibold">
                {season.label} · {season.daysLeft}d left ·{" "}
                {rank.tier === "DEADSET"
                  ? "top of the ladder"
                  : `${toNext} to ${getRank(score.total + toNext).label}`}
              </p>
              <div className="mt-2.5 h-1.5 rounded-full bg-black/60 border border-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    background: `linear-gradient(90deg, ${rank.gradient[0]}, ${rank.color})`,
                    boxShadow: `0 0 10px ${rank.glowColor}80`,
                  }}
                />
              </div>
            </div>
            <button
              onClick={() => setShareOpen(true)}
              className="shrink-0 w-9 h-9 rounded-xl border bg-white/[.03] flex items-center justify-center transition active:scale-95 tap-44"
              style={{ borderColor: `${rank.color}4d`, color: rank.color }}
              aria-label="Share rank"
            >
              <Share2 size={16} />
            </button>
          </div>

          <div className="relative grid grid-cols-3 gap-2 mt-3">
            <MiniStat label="WEEKLY" value={String(weekly.score)} icon={<Zap size={12} />} />
            <MiniStat label="OVR" value={String(fifa.overall)} icon={<Sparkles size={12} />} />
            <MiniStat
              label="SESSIONS"
              value={String(weekly.sessions)}
              icon={<Target size={12} />}
            />
          </div>

          <div className="relative mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="label-cap text-[10px] text-grit-dim">LEAGUE LADDER</p>
              <button
                type="button"
                onClick={() => setLadderOpen((v) => !v)}
                className="label-cap tap-44 text-[10px] text-grit-dim press"
              >
                {ladderOpen ? "Collapse" : "Full ladder"}
              </button>
            </div>
            {!ladderOpen ? (
              <div className="space-y-1.5">
                {LADDER.filter((_, i) => Math.abs(i - tierIdx) <= 2).map((tier) => (
                  <LadderRow key={tier.label} tier={tier} isCurrent={tier.label === rank.label} />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {LADDER.map((tier) => (
                  <LadderRow key={tier.label} tier={tier} isCurrent={tier.label === rank.label} />
                ))}
              </div>
            )}
          </div>

          {!compact && (
            <div className="relative mt-4 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="label-cap text-[10px] text-grit-dim">RANK-UP MISSIONS</p>
                <Link to="/leaderboard" className="label-cap text-[10px] text-accent-red">
                  Leaderboard
                </Link>
              </div>
              <div className="space-y-2">
                {quests.map((q) => (
                  <Link
                    key={q.label}
                    to={q.to}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        background: q.done ? rank.color : "transparent",
                        border: `1px solid ${rank.color}`,
                      }}
                    />
                    <span className="text-xs text-grit flex-1 truncate">{q.label}</span>
                    <span className="label-cap text-[9px]" style={{ color: rank.color }}>
                      {q.progress}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {shareOpen && (
        <RankShareCard
          gritPoints={score.total}
          displayName={state.profile?.username || "Athlete"}
          username={state.profile?.username}
          avatarDataUrl={state.profile?.avatarDataUrl}
          streak={streak}
          prs={buildHeadlinePRs(state)}
          sessions={state.sessions.filter((s) => s.endedAt).length}
          overall={fifa.overall}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

function LadderRow({ tier, isCurrent }: { tier: Rank; isCurrent: boolean }) {
  const bounds = rankStepBounds(tier);
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
      style={{
        borderColor: isCurrent ? `${tier.color}59` : "rgba(255,255,255,.08)",
        background: isCurrent
          ? `linear-gradient(90deg, ${tier.color}1f, rgba(0,0,0,.35))`
          : "rgba(0,0,0,.3)",
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-black/40"
        style={{ color: tier.color, borderColor: `${tier.color}40` }}
      >
        <RankTierGlyph tier={tier.tier} size={13} color={tier.color} />
      </span>
      <span
        className="label-cap text-[10px] flex-1 truncate"
        style={isCurrent ? { color: tier.color } : undefined}
      >
        {tier.label}
      </span>
      {isCurrent && (
        <span className="label-cap text-[8px]" style={{ color: tier.color }}>
          YOU
        </span>
      )}
      <span className="text-[9px] font-semibold text-grit-dim">
        {bounds.min}–{bounds.max}
      </span>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
      <div className="flex items-center gap-1 text-grit-dim">
        {icon}
        <span className="label-cap text-[8px]">{label}</span>
      </div>
      <p className="display font-extrabold text-grit text-lg leading-none mt-1">{value}</p>
    </div>
  );
}
