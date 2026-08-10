import { useMemo } from "react";
import { SunMoon } from "lucide-react";

import { timeOfDay, SLOT_NAME } from "@/lib/time-of-day";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

const SLOT_LABEL: Record<string, string> = {
  MORNING: "Morning",
  DAYTIME: "Daytime",
  EVENING: "Evening",
};

/**
 * When the athlete actually lifts best — average tonnage by session start
 * time over 12 weeks. Speaks only when one slot has a real (10%+) edge.
 */
export function TimeOfDayCard({ state }: { state: AppState }) {
  const tod = useMemo(() => timeOfDay(state.sessions, isoDay()), [state.sessions]);

  if (!tod) return null;

  const max = Math.max(...tod.slots.map((s) => s.avgVolumeKg), 1);

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <div className="flex items-baseline justify-between">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5 whitespace-nowrap">
            <SunMoon size={12} /> When you lift best
          </p>
          <p className="label-cap text-[9px] text-grit-dim whitespace-nowrap">
            avg kg · 12 wks
          </p>
        </div>

        <div className="space-y-2 mt-3">
          {tod.slots.map((s) => {
            const best = s.slot === tod.bestSlot;
            return (
              <div key={s.slot} className="flex items-center gap-2">
                <span
                  className={`label-cap text-[8px] w-14 shrink-0 ${best ? "text-accent-red" : "text-grit-dim"}`}
                >
                  {SLOT_LABEL[s.slot]}
                </span>
                <div className="flex-1 h-3 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.avgVolumeKg > 0 ? Math.max(4, (s.avgVolumeKg / max) * 100) : 0}%`,
                      background: best ? "#e63222" : "rgba(230,50,34,0.35)",
                    }}
                  />
                </div>
                <span className="label-cap text-[8px] text-grit-dim w-16 text-right shrink-0">
                  {s.sessions ? `${s.avgVolumeKg.toLocaleString()} kg` : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {tod.advice && (
          <p className="text-[11px] text-grit-dim leading-relaxed mt-3">{tod.advice}</p>
        )}
        {!tod.advice && tod.bestSlot && (
          <p className="text-[11px] text-grit-dim leading-relaxed mt-3">
            Most of your work lands in the {SLOT_NAME[tod.bestSlot]} — no clear edge between slots
            yet.
          </p>
        )}
      </div>
    </section>
  );
}
