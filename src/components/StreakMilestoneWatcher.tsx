import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { calculateStreak } from "@/lib/calc";
import { currentMilestone, type StreakMilestone } from "@/lib/streak-milestones";

const SEEN_KEY = "deadset_streak_milestone_seen";

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) || "0");
  } catch {
    return 0;
  }
}
function writeSeen(days: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(days));
  } catch {
    /* ignore */
  }
}

/**
 * Fires a one-time celebration when the training streak crosses a new milestone.
 * Existing streaks are marked silently on first load (no retroactive spam).
 */
export function StreakMilestoneWatcher() {
  const [state] = useAppState();
  const [hit, setHit] = useState<StreakMilestone | null>(null);
  const initialised = useRef(false);

  const streak = calculateStreak(state.completedDates);
  const milestone = currentMilestone(streak);

  useEffect(() => {
    const seen = readSeen();
    const reached = milestone?.days ?? 0;
    if (!initialised.current) {
      initialised.current = true;
      // Already past this milestone before the feature existed → mark, don't celebrate.
      if (reached > seen) writeSeen(reached);
      return;
    }
    if (milestone && milestone.days > seen) {
      setHit(milestone);
      writeSeen(milestone.days);
    }
  }, [milestone]);

  if (!hit) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      style={{ background: "rgba(8,4,2,0.84)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      onClick={() => setHit(null)}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-accent-red p-6 text-center"
        style={{
          background: "linear-gradient(160deg, #241110 0%, #2a0d0a 45%, #0d0605 100%)",
          boxShadow: "0 18px 48px rgba(0,0,0,.4), 0 0 34px rgba(230,50,34,.28)",
          animation: "pro-pop 0.5s cubic-bezier(.2,.9,.3,1.2) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,180,120,0.3), transparent)",
            animation: "pro-sweep 1.6s ease-in-out 0.35s both",
          }}
        />
        <div className="text-5xl mb-1">{hit.emoji}</div>
        <div
          className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "radial-gradient(circle at 50% 35%, #ff6a3d, #e63222 70%)", boxShadow: "0 0 30px rgba(230,50,34,.6)" }}
        >
          <Flame size={26} strokeWidth={2.5} className="text-white" />
        </div>
        <p className="label-cap text-[10px] tracking-[0.28em] text-accent-red">Streak milestone</p>
        <h2 className="display text-4xl font-extrabold uppercase text-grit leading-none mt-1">{hit.days} days</h2>
        <p className="display text-lg font-extrabold uppercase text-accent-red mt-1">{hit.label}</p>
        <p className="text-xs text-[#b7a9a4] mt-3 mb-5">
          {hit.days} straight days on the grind. Keep the fire lit.
        </p>
        <button
          onClick={() => setHit(null)}
          className="btn-grit w-full rounded-xl"
        >
          Keep Going
        </button>
      </div>
    </div>
  );
}
