import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, Check, Dumbbell, Droplets, Apple, Scale, Camera, Trophy, Zap } from "lucide-react";
import { useAppState } from "@/lib/storage";
import {
  calculateStreak,
  calculateCalories,
  calculateMacros,
  defaultSchedule,
  isoDay,
  todayKey,
} from "@/lib/calc";

type Quest = {
  id: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  to: string;
  xp: number;
  done: boolean;
};

export function DailyQuests() {
  const [state] = useAppState();
  const [expanded, setExpanded] = useState(true);
  const today = isoDay();

  const quests: Quest[] = useMemo(() => {
    const list: Quest[] = [];
    const schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
    const activeProgram = state.programs.find((program) => program.id === state.activeProgramId);
    const scheduledExerciseCount =
      activeProgram?.days[todayKey()]?.items.length ??
      schedule?.[todayKey()]?.exerciseIds.length ??
      0;
    if (scheduledExerciseCount > 0) {
      list.push({
        id: "workout",
        icon: <Dumbbell size={16} />,
        title: "Crush today's workout",
        sub: `${scheduledExerciseCount} ${scheduledExerciseCount === 1 ? "exercise" : "exercises"} planned`,
        to: "/train",
        xp: 50,
        done: state.completedDates.includes(today),
      });
    }
    // 2. Protein
    if (state.profile) {
      const cal = calculateCalories(state.profile);
      const macros = calculateMacros(state.profile, cal);
      const todayPro = (state.foodLog || [])
        .filter((f) => f.date.startsWith(today))
        .reduce((s, f) => s + (f.protein || 0), 0);
      list.push({
        id: "protein",
        icon: <Apple size={16} />,
        title: `Hit ${macros.protein}g protein`,
        sub: `${Math.round(todayPro)}g logged`,
        to: "/diet",
        xp: 30,
        done: todayPro >= macros.protein * 0.9,
      });
    }
    // 3. Water
    const todayWater = (state.water || [])
      .filter((w) => w.date === today)
      .reduce((s, w) => s + (w.ml || 0), 0);
    const wTarget = state.waterTargetMl || 3000;
    list.push({
      id: "water",
      icon: <Droplets size={16} />,
      title: "Hydrate",
      sub: `${todayWater}/${wTarget}ml`,
      to: "/diet",
      xp: 20,
      done: todayWater >= wTarget * 0.8,
    });
    // 4. Weigh-in
    const weighedToday = (state.weights || []).some((w) => w.date === today);
    list.push({
      id: "weight",
      icon: <Scale size={16} />,
      title: "Log your weight",
      sub: "Track the trend",
      to: "/progress",
      xp: 15,
      done: weighedToday,
    });
    // 5. Photo check-in (weekly bonus, shown daily for engagement)
    const lastCheck = state.checkIns[state.checkIns.length - 1]?.date;
    const daysSinceCheck = lastCheck
      ? Math.floor((Date.now() - new Date(lastCheck).getTime()) / 86400000)
      : Infinity;
    list.push({
      id: "photo",
      icon: <Camera size={16} />,
      title: "Progress photo",
      sub: daysSinceCheck < 7 ? "Done this week" : "Weekly bonus",
      to: "/progress",
      xp: 40,
      done: daysSinceCheck < 7,
    });
    return list;
  }, [state, today]);

  const streak = calculateStreak(state.completedDates);
  const earned = quests.filter((q) => q.done).reduce((s, q) => s + q.xp, 0);
  const total = quests.reduce((s, q) => s + q.xp, 0);
  const doneCount = quests.filter((q) => q.done).length;
  const pct = Math.round((earned / total) * 100);
  const allDone = doneCount === quests.length;

  return (
    <div className="px-5 mb-4">
      {/* Quest list */}
      <div className="bg-grit-card border border-grit">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between border-b border-grit px-3 py-2.5"
        >
          <p className="label-cap text-[10px] flex items-center gap-1.5">
            <Trophy size={12} className="text-accent-red" /> DAILY QUESTS
            <span className="text-grit-dim">
              · {doneCount}/{quests.length}
            </span>
          </p>
          {allDone && (
            <span className="label-cap text-[9px] px-2 py-0.5 bg-accent-red text-white">
              ALL DONE
            </span>
          )}
          <span className="text-grit-dim text-xs">{expanded ? "▲" : "▼"}</span>
        </button>
        {expanded && (
          <div className="divide-y divide-[#262626]">
            {quests.map((q) => (
              <Link
                key={q.id}
                to={q.to}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#141414] transition-colors"
              >
                <div
                  className={`w-7 h-7 flex items-center justify-center border flex-shrink-0 ${q.done ? "grit-quest-done" : ""}`}
                  style={{
                    borderColor: q.done ? "#e63222" : "#2a2a2a",
                    background: q.done ? "#e63222" : "transparent",
                    color: q.done ? "#fff" : "#8a8a8a",
                  }}
                >
                  {q.done ? <Check size={14} /> : q.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold uppercase tracking-wide truncate"
                    style={{
                      color: q.done ? "#8a8a8a" : "#f5f5f0",
                      textDecoration: q.done ? "line-through" : undefined,
                    }}
                  >
                    {q.title}
                  </p>
                  <p className="text-[10px] text-grit-dim truncate">{q.sub}</p>
                </div>
                <span
                  className="label-cap text-[10px] px-1.5 py-0.5 flex-shrink-0 flex items-center gap-0.5"
                  style={{
                    color: q.done ? "#e63222" : "#8a8a8a",
                    border: `1px solid ${q.done ? "#e63222" : "#2a2a2a"}`,
                  }}
                >
                  <Zap size={9} /> {q.xp}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
