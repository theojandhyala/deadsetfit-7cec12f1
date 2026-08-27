import { useEffect, useMemo, useRef, useState } from "react";
import { Dumbbell } from "lucide-react";

import { useAppState, getHydrationCount } from "@/lib/storage";
import { lifetimeStats } from "@/lib/lifetime-stats";
import {
  currentTonnageMilestone,
  type TonnageMilestone,
} from "@/lib/tonnage-milestones";
import { SocialShareButton } from "@/components/SocialShareButton";

const SEEN_KEY = "deadset_tonnage_milestone_seen";

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) || "0");
  } catch {
    return 0;
  }
}
function writeSeen(kg: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(kg));
  } catch {
    /* ignore */
  }
}

/**
 * One-time celebration when lifetime tonnage crosses a milestone. Mirrors
 * StreakMilestoneWatcher: existing progress is marked silently on first load,
 * only a genuine live crossing celebrates.
 */
export function TonnageMilestoneWatcher() {
  const [state] = useAppState();
  const [hit, setHit] = useState<TonnageMilestone | null>(null);
  const initialised = useRef(false);
  const lastHydration = useRef(getHydrationCount());

  const totalKg = useMemo(
    () => lifetimeStats(state.sessions, state.completedDates)?.totalVolumeKg ?? 0,
    [state.sessions, state.completedDates],
  );
  const milestone = currentTonnageMilestone(totalKg);

  useEffect(() => {
    const seen = readSeen();
    const reached = milestone?.kg ?? 0;
    // A remote hydration means history arrived, not that the athlete just
    // crossed a mark live — mark it silently exactly like first observation.
    const hydration = getHydrationCount();
    const hydrated = hydration !== lastHydration.current;
    lastHydration.current = hydration;
    const first = !initialised.current || hydrated;
    initialised.current = true;
    // Total dropped below the celebrated mark (account restore, deletions) —
    // reset so re-crossing celebrates instead of staying silent forever.
    if (reached < seen) {
      writeSeen(reached);
      return;
    }
    if (milestone && reached > seen) {
      if (!first) setHit(milestone);
      writeSeen(reached);
    }
  }, [milestone]);

  if (!hit) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      // No backdrop-filter: composites as solid black while scrolling in WKWebView/iOS Safari.
      style={{ background: "rgba(8,4,2,0.93)" }}
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
          style={{
            background: "radial-gradient(circle at 50% 35%, #ff6a3d, #e63222 70%)",
            boxShadow: "0 0 30px rgba(230,50,34,.6)",
          }}
        >
          <Dumbbell size={26} strokeWidth={2.5} className="text-white" />
        </div>
        <p className="label-cap text-[10px] tracking-[0.28em] text-accent-red">
          Lifetime tonnage
        </p>
        <h2 className="display text-4xl font-extrabold uppercase text-grit leading-none mt-1">
          {hit.label}
        </h2>
        <p className="text-xs text-[#b7a9a4] mt-3 mb-5">
          You&apos;ve now lifted {hit.flavor} — every kilo of it logged, rep by rep.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <SocialShareButton
            text={`I just lifted ${hit.flavor} total on DEADSET. ${hit.label} unlocked.`}
            className="btn-ghost flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs"
          />
          <button onClick={() => setHit(null)} className="btn-grit rounded-xl text-xs">
            Keep Lifting
          </button>
        </div>
      </div>
    </div>
  );
}
