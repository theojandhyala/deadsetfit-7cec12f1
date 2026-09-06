import { useMemo, useState } from "react";
import { Trophy as TrophyIcon, ChevronDown } from "lucide-react";
import {
  achievements,
  CATEGORY_ORDER,
  RARITY_COLOR,
  type Achievement,
  type AchievementCategory,
} from "@/lib/achievements";
import type { AppState } from "@/lib/types";

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  CONSISTENCY: "Consistency",
  TONNAGE: "Tonnage",
  STRENGTH: "Strength",
  VARIETY: "Variety",
  DEDICATION: "Dedication",
  NUTRITION: "Nutrition",
};

/** Locked badges show how close they are; unlocked ones show their rarity. */
function BadgeTile({ a }: { a: Achievement }) {
  const pct = a.target > 0 ? Math.min(100, Math.round((a.progress / a.target) * 100)) : 0;
  const color = RARITY_COLOR[a.rarity];
  return (
    <div
      className="deadset-3d-panel relative flex flex-col items-center bg-grit-card p-2.5 text-center"
      style={{
        border: `1px solid ${a.unlocked ? color : "#262626"}`,
        opacity: a.unlocked ? 1 : 0.55,
        boxShadow: a.unlocked ? `0 0 18px ${color}22` : "none",
      }}
    >
      <span className="mb-1 text-2xl" style={{ filter: a.unlocked ? "none" : "grayscale(1)" }}>
        {a.unlocked ? a.icon : "🔒"}
      </span>
      <p className="label-cap text-[9px] leading-tight text-grit">{a.label}</p>
      <p className="mt-0.5 text-[9px] leading-tight text-grit-dim">{a.desc}</p>
      {a.unlocked ? (
        <span className="label-cap mt-1.5 text-[7px]" style={{ color }}>
          {a.rarity}
        </span>
      ) : (
        <div className="mt-1.5 w-full">
          <div className="h-1 w-full bg-[#1a1a1a]">
            <div className="h-full" style={{ width: `${pct}%`, background: color }} />
          </div>
          <p className="mt-1 text-[8px] text-grit-dim">
            {a.progress.toLocaleString()} / {a.target.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

export function TrophyCase({ state }: { state: AppState }) {
  const all = useMemo(() => achievements(state), [state]);
  const [open, setOpen] = useState(false);

  const unlockedCount = all.filter((a) => a.unlocked).length;
  const byCategory = useMemo(() => {
    const map = new Map<AchievementCategory, Achievement[]>();
    for (const a of all) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return map;
  }, [all]);

  // Collapsed, the wall leads with what was just earned and what is closest —
  // the two things that actually pull someone back to training.
  const highlights = useMemo(() => {
    const unlocked = all.filter((a) => a.unlocked).slice(-3);
    const closest = all
      .filter((a) => !a.unlocked && a.progress > 0)
      .sort((x, y) => y.progress / y.target - x.progress / x.target)
      .slice(0, 6 - unlocked.length);
    return [...unlocked, ...closest].slice(0, 6);
  }, [all]);

  return (
    <section className="px-5 mb-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="label-cap flex items-center gap-1.5">
          <TrophyIcon size={12} className="text-accent-red" /> Trophy Case
        </p>
        <span className="label-cap text-[10px] text-grit-dim">
          {unlockedCount}/{all.length}
        </span>
      </div>

      <div className="mb-2 h-1.5 w-full bg-[#1a1a1a]">
        <div
          className="h-full bg-accent-red transition-[width] duration-500"
          style={{ width: `${Math.round((unlockedCount / all.length) * 100)}%` }}
        />
      </div>

      {!open ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {highlights.map((a) => (
              <BadgeTile key={a.id} a={a} />
            ))}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="btn-ghost mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 text-xs"
          >
            See all {all.length} badges <ChevronDown size={14} />
          </button>
        </>
      ) : (
        <>
          {CATEGORY_ORDER.map((cat) => {
            const list = byCategory.get(cat) ?? [];
            if (!list.length) return null;
            const done = list.filter((a) => a.unlocked).length;
            return (
              <div key={cat} className="mb-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="label-cap text-[10px] text-grit">{CATEGORY_LABEL[cat]}</p>
                  <span className="text-[9px] text-grit-dim">
                    {done}/{list.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {list.map((a) => (
                    <BadgeTile key={a.id} a={a} />
                  ))}
                </div>
              </div>
            );
          })}
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost mt-1 flex min-h-[44px] w-full items-center justify-center text-xs"
          >
            Show less
          </button>
        </>
      )}
    </section>
  );
}
