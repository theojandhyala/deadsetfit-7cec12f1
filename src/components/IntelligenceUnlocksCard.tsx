import { useMemo } from "react";
import { Lock, Unlock } from "lucide-react";

import { intelligenceStatus } from "@/lib/intelligence-status";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

/**
 * The intelligence stack's front door for new lifters: every engine hides
 * until it has data, so without this a fresh account sees nothing of what
 * the app can do. Shows what's live and exactly what unlocks the rest;
 * disappears once (nearly) everything is on.
 */
export function IntelligenceUnlocksCard({
  state,
  calorieTarget = 0,
}: {
  state: AppState;
  calorieTarget?: number;
}) {
  const status = useMemo(
    () => intelligenceStatus(state, isoDay(), calorieTarget),
    [state, calorieTarget],
  );

  // Nearly everything live → the engines speak for themselves.
  if (status.total - status.active <= 2) return null;

  const locked = status.engines.filter((e) => !e.active).slice(0, 3);

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <div className="flex items-baseline justify-between">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5 whitespace-nowrap">
            <Unlock size={12} /> Intelligence engines
          </p>
          <p className="label-cap text-[9px] text-grit-dim whitespace-nowrap">
            {status.active}/{status.total} live
          </p>
        </div>

        <div className="h-1.5 rounded-full bg-black/40 mt-2.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-red"
            style={{ width: `${Math.max(3, Math.round((status.active / status.total) * 100))}%` }}
          />
        </div>

        <div className="space-y-1.5 mt-3">
          {locked.map((e) => (
            <div key={e.key} className="flex items-baseline gap-2">
              <Lock size={10} className="text-grit-dim shrink-0 translate-y-[1px]" />
              <p className="text-[11px] text-grit-dim leading-relaxed">
                <span className="text-grit">{e.title}</span> — {e.need.toLowerCase()}
              </p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-grit-dim leading-relaxed mt-2.5">
          Every engine runs on your own logged numbers — keep training and logging and they switch
          on one by one.
        </p>
      </div>
    </section>
  );
}
