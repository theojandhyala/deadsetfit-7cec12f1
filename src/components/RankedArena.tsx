import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Share2, Sparkles, Target, Trophy, Zap } from "lucide-react";

import { RankEmblem } from "@/components/RankEmblem";
import { RankShareCard } from "@/components/RankShareCard";
import { usePro } from "@/hooks/usePro";
import { calculateGritScore, calculateStreak, isoDay } from "@/lib/calc";
import { buildHeadlinePRs, computeFifaStats } from "@/lib/fifa-stats";
import { openPaywall } from "@/lib/paywall-events";
import { getRank, pointsToNextTier, rankProgress } from "@/lib/rank";
import type { Rank } from "@/lib/rank";
import type { AppState } from "@/lib/types";

type RankedArenaProps = {
  state: AppState;
  compact?: boolean;
};

// One representative point value per tier, top of the ladder first (see src/lib/rank.ts).
const LADDER_TIER_MINS = [990, 940, 850, 760, 600, 420, 250, 120, 0];
const LADDER: Rank[] = LADDER_TIER_MINS.map((points) => getRank(points));

type LadderSegment = { key: number; hidden: boolean; ranks: Rank[] };

export function RankedArena({ state, compact = false }: RankedArenaProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [ladderOpen, setLadderOpen] = useState(false);
  const { isPro, loading: proLoading } = usePro();
  const score = calculateGritScore(state);
  const rank = getRank(score.total);
  const progress = rankProgress(score.total);
  const toNext = pointsToNextTier(score.total);
  const streak = calculateStreak(state.completedDates);
  const fifa = computeFifaStats(state);
  const today = isoDay();

  // Free users only see their current tier and its immediate neighbours;
  // Pro (or while entitlement is still loading) sees the whole ladder.
  const showFullLadder = proLoading || isPro;
  const tierIdx = LADDER.findIndex((t) => t.tier === rank.tier);

  const ladderSegments = useMemo(() => {
    const segments: LadderSegment[] = [];
    LADDER.forEach((tier, i) => {
      const hidden = !showFullLadder && Math.abs(i - tierIdx) > 1;
      const last = segments[segments.length - 1];
      if (last && last.hidden === hidden) last.ranks.push(tier);
      else segments.push({ key: i, hidden, ranks: [tier] });
    });
    return segments;
  }, [showFullLadder, tierIdx]);

  const hiddenSegments = ladderSegments.filter((s) => s.hidden);
  const overlaySegment = hiddenSegments.length
    ? hiddenSegments.reduce((a, b) => (b.ranks.length > a.ranks.length ? b : a))
    : null;

  const quests = useMemo(() => {
    const workoutDone = state.completedDates.includes(today);
    const sessionThisWeek = (state.sessions || []).filter((s) => {
      const age = Date.now() - new Date(s.date).getTime();
      return age <= 7 * 86400000;
    }).length;
    const prThisWeek = (state.sessions || []).reduce((sum, s) => {
      const age = Date.now() - new Date(s.date).getTime();
      return age <= 7 * 86400000 ? sum + (s.prCount || 0) : sum;
    }, 0);

    return [
      {
        label: workoutDone ? "Daily ranked game complete" : "Complete today's workout",
        reward: "+50 GRIT",
        done: workoutDone,
        to: "/train",
      },
      {
        label: sessionThisWeek >= 3 ? "Weekly consistency locked" : "Hit 3 workouts this week",
        reward: "+90 GRIT",
        done: sessionThisWeek >= 3,
        to: "/train",
      },
      {
        label: prThisWeek > 0 ? "PR pressure applied" : "Set one PR this week",
        reward: "+25 GRIT",
        done: prThisWeek > 0,
        to: "/profile",
      },
    ];
  }, [state.completedDates, state.sessions, today]);

  return (
    <>
      <section className={compact ? "" : "px-5 mb-5"}>
        <div
          className={"relative overflow-hidden border " + (compact ? "rounded-2xl p-3" : "rounded-[22px] p-4")}
          style={{
            borderColor: `${rank.color}2f`,
            boxShadow: `0 18px 46px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.07)`,
            background:
              `radial-gradient(circle at 86% -10%, ${rank.glowColor}24, transparent 36%), linear-gradient(145deg, rgba(31,33,39,.96), rgba(7,7,9,.98) 58%, rgba(0,0,0,.98))`,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
          <div className="absolute right-4 top-4 h-24 w-24 rounded-full border border-white/5" />
          <div className="absolute right-10 top-10 h-12 w-12 rounded-full border border-white/5" />
          <div className="relative flex items-start gap-3">
            <RankEmblem gritPoints={score.total} size={compact ? "sm" : "md"} showProgress={false} showLabel={false} />
            <div className="min-w-0 flex-1">
              <p className="label-cap text-[10px] flex items-center gap-1.5" style={{ color: rank.color }}>
                <Trophy size={12} /> RANKED DIVISION
              </p>
              <h2 className={"display font-black uppercase leading-none mt-1 text-grit " + (compact ? "text-2xl" : "text-[1.7rem]")}>
                {rank.label}
              </h2>
              <p className="text-[11px] text-grit-dim mt-1 font-semibold">
                Season 1 · {score.total}/1000 grit · {rank.tier === "DEADSET" ? "top of the ladder" : `${toNext} to ${rank.nextTier}`}
              </p>
              <div className="mt-2.5 h-1.5 rounded-full bg-black/60 border border-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
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
              className="shrink-0 w-9 h-9 rounded-xl border bg-white/[.03] flex items-center justify-center transition active:scale-95"
              style={{ borderColor: `${rank.color}4d`, color: rank.color }}
              aria-label="Share rank"
            >
              <Share2 size={16} />
            </button>
          </div>

          <div className="relative grid grid-cols-3 gap-2 mt-3">
            <MiniStat label="STREAK" value={`${streak}d`} icon={<Zap size={12} />} />
            <MiniStat label="OVR" value={String(fifa.overall)} icon={<Sparkles size={12} />} />
            <MiniStat label="SESSIONS" value={String(state.sessions.length)} icon={<Target size={12} />} />
          </div>

          <div className="relative mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="label-cap text-[10px] text-grit-dim">LEAGUE LADDER</p>
              <div className="flex items-center gap-2">
                {!showFullLadder && (
                  <span className="label-cap text-[9px] text-accent-red border border-accent-red/40 rounded px-1.5">
                    PRO
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setLadderOpen((v) => !v)}
                  className="label-cap text-[10px] text-grit-dim press"
                >
                  {ladderOpen ? "Collapse" : "Full ladder"}
                </button>
              </div>
            </div>
            {!ladderOpen ? (
              <div className="space-y-1.5">
                {LADDER.filter((_, i) => Math.abs(i - tierIdx) <= 1).map((tier) => (
                  <LadderRow key={tier.tier} tier={tier} isCurrent={tier.tier === rank.tier} />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {ladderSegments.map((seg) => (
                  <div key={seg.key} className="relative">
                    <div
                      className={
                        "space-y-1.5" +
                        (seg.hidden ? " blur-[4px] opacity-50 pointer-events-none select-none" : "")
                      }
                      aria-hidden={seg.hidden || undefined}
                    >
                      {seg.ranks.map((tier) => (
                        <LadderRow key={tier.tier} tier={tier} isCurrent={tier.tier === rank.tier} />
                      ))}
                    </div>
                    {seg === overlaySegment && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center gap-2">
                        <Lock size={13} className="text-accent-red" />
                        <span className="label-cap text-[10px] text-grit">FULL LEAGUES — PRO</span>
                        <button
                          type="button"
                          onClick={() => openPaywall("leagues")}
                          className="btn-ghost text-xs"
                        >
                          Unlock
                        </button>
                      </div>
                    )}
                  </div>
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
                      style={{ background: q.done ? rank.color : "transparent", border: `1px solid ${rank.color}` }}
                    />
                    <span className="text-xs text-grit flex-1 truncate">{q.label}</span>
                    <span className="label-cap text-[9px]" style={{ color: rank.color }}>
                      {q.reward}
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
          sessions={state.sessions.length}
          overall={fifa.overall}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

function LadderRow({ tier, isCurrent }: { tier: Rank; isCurrent: boolean }) {
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
      <span className="text-sm leading-none">{tier.icon}</span>
      <span
        className="label-cap text-[10px] flex-1 truncate"
        style={isCurrent ? { color: tier.color } : undefined}
      >
        {tier.tier}
      </span>
      {isCurrent && (
        <span className="label-cap text-[8px]" style={{ color: tier.color }}>
          YOU
        </span>
      )}
      <span className="text-[9px] font-semibold text-grit-dim">
        {tier.minPoints}–{tier.maxPoints}
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
