import { useMemo } from "react";
import { Trophy as TrophyIcon } from "lucide-react";
import { calculateStreak, calculateGritScore } from "@/lib/calc";
import type { AppState } from "@/lib/types";

interface TrophyItem {
  id: string;
  label: string;
  desc: string;
  icon: string;
  unlocked: boolean;
}

export function TrophyCase({ state }: { state: AppState }) {
  const trophies = useMemo<TrophyItem[]>(() => {
    const sessions = state.sessions || [];
    const completed = sessions.filter((s) => s.endedAt);
    const sessionCount = completed.length;
    const totalVolume = completed.reduce((a, s) => a + (s.totalVolume || 0), 0);
    const totalPRs = completed.reduce((a, s) => a + (s.prCount || 0), 0);
    const daysTrained = new Set(completed.map((s) => s.date)).size;
    const streak = calculateStreak(state.completedDates);
    const grit = calculateGritScore(state).total;

    return [
      { id: "first-rep", label: "FIRST REP", desc: "Logged your first session", icon: "🥇", unlocked: sessionCount >= 1 },
      { id: "ten-sessions", label: "WARMED UP", desc: "10 sessions logged", icon: "🔥", unlocked: sessionCount >= 10 },
      { id: "fifty-sessions", label: "REGULAR", desc: "50 sessions logged", icon: "💯", unlocked: sessionCount >= 50 },
      { id: "hundred-sessions", label: "CENTURION", desc: "100 sessions", icon: "🏆", unlocked: sessionCount >= 100 },
      { id: "ten-tons", label: "10 TONNES", desc: "10,000kg total volume", icon: "🏋️", unlocked: totalVolume >= 10000 },
      { id: "hundred-tons", label: "100 TONNES", desc: "100,000kg lifted", icon: "🦣", unlocked: totalVolume >= 100000 },
      { id: "first-pr", label: "PR HUNTER", desc: "Set your first PR", icon: "⚡", unlocked: totalPRs >= 1 },
      { id: "ten-prs", label: "RECORD BREAKER", desc: "10 PRs broken", icon: "🎯", unlocked: totalPRs >= 10 },
      { id: "week-streak", label: "WEEK ON", desc: "7-day streak", icon: "🔥", unlocked: streak >= 7 },
      { id: "month-streak", label: "UNSTOPPABLE", desc: "30-day streak", icon: "👑", unlocked: streak >= 30 },
      { id: "month-trained", label: "MONTH IN", desc: "30 days trained", icon: "📅", unlocked: daysTrained >= 30 },
      { id: "deadset-elite", label: "DEADSET ELITE", desc: "10,000 Grit pts", icon: "💎", unlocked: grit >= 10000 },
    ];
  }, [state]);

  const unlockedCount = trophies.filter((t) => t.unlocked).length;

  return (
    <section className="px-5 mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="label-cap flex items-center gap-1.5">
          <Trophy size={12} className="text-accent-red" /> Trophy Case
        </p>
        <span className="text-[10px] text-grit-dim label-cap">{unlockedCount}/{trophies.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {trophies.map((t) => (
          <div
            key={t.id}
            className="bg-grit-card border p-2.5 flex flex-col items-center text-center"
            style={{
              borderColor: t.unlocked ? "#3a1410" : "#262626",
              opacity: t.unlocked ? 1 : 0.45,
            }}
          >
            <span className="text-2xl mb-1" style={{ filter: t.unlocked ? "none" : "grayscale(1)" }}>
              {t.unlocked ? t.icon : "🔒"}
            </span>
            <p className="label-cap text-[9px] text-grit leading-tight">{t.label}</p>
            <p className="text-[9px] text-grit-dim mt-0.5 leading-tight">{t.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
