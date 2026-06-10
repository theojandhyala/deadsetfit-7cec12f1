import { useMemo } from "react";
import { Calendar, Dumbbell, Flame, Trophy } from "lucide-react";
import type { AppState } from "@/lib/types";

interface Props {
  state: AppState;
}

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function WeeklyRecap({ state }: Props) {
  const stats = useMemo(() => {
    const start = startOfWeek().getTime();
    const sessions = (state.sessions || []).filter(
      (s) => s.endedAt && new Date(s.endedAt).getTime() >= start,
    );
    const daysTrained = new Set(sessions.map((s) => s.date)).size;
    const totalVolume = sessions.reduce((a, s) => a + (s.totalVolume || 0), 0);
    const totalSets = sessions.reduce(
      (a, s) => a + s.exercises.reduce((b, e) => b + e.sets.length, 0),
      0,
    );
    const prs = sessions.reduce((a, s) => a + (s.prCount || 0), 0);
    return { daysTrained, totalVolume, totalSets, prs, sessions: sessions.length };
  }, [state.sessions]);

  if (stats.sessions === 0) {
    return (
      <div className="bg-grit-card border border-grit p-5">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={12} className="text-accent-red" />
          <p className="label-cap text-accent-red">THIS WEEK</p>
        </div>
        <p className="display text-2xl font-extrabold text-grit leading-none">NO LIFTS LOGGED</p>
        <p className="text-xs text-grit-dim mt-2">Get one session in. Momentum starts now.</p>
      </div>
    );
  }

  return (
    <div className="bg-grit-card border border-grit p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-accent-red" />
          <p className="label-cap text-accent-red">THIS WEEK</p>
        </div>
        <p className="label-cap text-grit-dim text-[10px]">{stats.daysTrained}/7 DAYS</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Flame size={14} />} label="SESSIONS" value={String(stats.sessions)} />
        <Stat
          icon={<Dumbbell size={14} />}
          label="VOLUME"
          value={`${Math.round(stats.totalVolume).toLocaleString()}kg`}
        />
        <Stat icon={<Trophy size={14} />} label="PRs" value={String(stats.prs)} />
      </div>
      <div className="mt-3 h-1 bg-grit overflow-hidden">
        <div
          className="h-1 bg-accent-red transition-all"
          style={{ width: `${Math.min(100, (stats.daysTrained / 7) * 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-grit-dim mt-2 label-cap">
        {stats.totalSets} SETS · {stats.daysTrained >= 4 ? "ON PACE" : "PUSH HARDER"}
      </p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-grit p-2.5">
      <div className="flex items-center gap-1 text-grit-dim mb-1">
        {icon}
        <span className="label-cap text-[9px]">{label}</span>
      </div>
      <p className="display font-extrabold text-grit text-lg leading-none">{value}</p>
    </div>
  );
}
