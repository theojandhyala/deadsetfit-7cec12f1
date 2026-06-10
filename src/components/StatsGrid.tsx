import { useMemo } from "react";
import { Dumbbell, Flame, Trophy, Calendar } from "lucide-react";
import type { AppState } from "@/lib/types";

export function StatsGrid({ state }: { state: AppState }) {
  const s = useMemo(() => {
    const sessions = (state.sessions || []).filter((x) => x.endedAt);
    const totalSets = sessions.reduce(
      (a, x) => a + x.exercises.reduce((b, e) => b + e.sets.length, 0),
      0,
    );
    return {
      sessions: sessions.length,
      sets: totalSets,
      volume: Math.round(sessions.reduce((a, x) => a + (x.totalVolume || 0), 0)),
      prs: sessions.reduce((a, x) => a + (x.prCount || 0), 0),
      days: new Set(sessions.map((x) => x.date)).size,
    };
  }, [state.sessions]);

  return (
    <section className="px-5 mb-5">
      <p className="label-cap mb-2">Lifetime Stats</p>
      <div className="grid grid-cols-2 gap-2">
        <Cell icon={<Flame size={14} />} label="SESSIONS" value={String(s.sessions)} />
        <Cell icon={<Calendar size={14} />} label="DAYS TRAINED" value={String(s.days)} />
        <Cell
          icon={<Dumbbell size={14} />}
          label="TOTAL VOLUME"
          value={`${s.volume.toLocaleString()}kg`}
        />
        <Cell icon={<Trophy size={14} />} label="PRs SET" value={String(s.prs)} />
      </div>
    </section>
  );
}

function Cell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-grit-card border border-grit p-3">
      <div className="flex items-center gap-1.5 text-grit-dim mb-1">
        {icon}
        <span className="label-cap text-[9px]">{label}</span>
      </div>
      <p className="display font-extrabold text-grit text-xl leading-none">{value}</p>
    </div>
  );
}
