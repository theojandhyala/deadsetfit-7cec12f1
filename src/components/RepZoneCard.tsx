import { useMemo } from "react";
import { Crosshair } from "lucide-react";

import { repZoneMix, REP_ZONE_LABEL, type RepZone } from "@/lib/rep-zones";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

const ZONE_ORDER: RepZone[] = ["STRENGTH", "BUILD", "ENDURANCE"];
const ZONE_BG: Record<RepZone, string> = {
  STRENGTH: "#e63222",
  BUILD: "rgba(230,50,34,0.55)",
  ENDURANCE: "rgba(230,50,34,0.25)",
};
const ZONE_NAME: Record<RepZone, string> = {
  STRENGTH: "Strength",
  BUILD: "Build",
  ENDURANCE: "Endurance",
};

/**
 * Where the last four weeks of working sets land on the rep spectrum, judged
 * against the athlete's goal. The Volume Optimizer covers "enough sets per
 * muscle" — this covers "the right kind of sets". Hidden until there are
 * enough sets to say anything honest.
 */
export function RepZoneCard({ state }: { state: AppState }) {
  const mix = useMemo(
    () => (state.profile ? repZoneMix(state.sessions, state.profile.goal, isoDay()) : null),
    [state.sessions, state.profile],
  );

  if (!mix) return null;

  return (
    <section className="px-5 mb-6">
    <div className="bg-grit-card border border-grit rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
          <Crosshair size={12} /> Rep-zone mix
        </p>
        <p className="label-cap text-[9px] text-grit-dim whitespace-nowrap">
          {mix.totalSets.toLocaleString()} sets · 4 wks
        </p>
      </div>

      <div
        className="flex h-3 rounded-full overflow-hidden mt-3"
        role="img"
        aria-label={`Set mix: ${ZONE_ORDER.map((z) => `${ZONE_NAME[z]} ${mix.pct[z]}%`).join(", ")}`}
      >
        {ZONE_ORDER.map((z) =>
          mix.pct[z] > 0 ? (
            <div key={z} style={{ width: `${mix.pct[z]}%`, background: ZONE_BG[z] }} />
          ) : null,
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {ZONE_ORDER.map((z) => (
          <div key={z} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ZONE_BG[z] }} />
            <p className="label-cap text-[8px] text-grit-dim whitespace-nowrap">
              {ZONE_NAME[z]} {mix.pct[z]}%
              {z === mix.targetZone ? " ★" : ""}
            </p>
          </div>
        ))}
      </div>

      <p
        className={`text-[11px] leading-relaxed mt-3 ${mix.aligned ? "text-grit-dim" : "text-grit"}`}
      >
        {mix.advice}
        {!mix.aligned && (
          <span className="text-grit-dim"> Target zone: {REP_ZONE_LABEL[mix.targetZone]}.</span>
        )}
      </p>
    </div>
    </section>
  );
}
