import { useMemo } from "react";
import { Scale, Ruler, Camera } from "lucide-react";

import { staleData, type FreshnessKind } from "@/lib/data-freshness";
import { isoDay } from "@/lib/calc";
import type { AppState } from "@/lib/types";

const ICON: Record<FreshnessKind, typeof Scale> = {
  WEIGHT: Scale,
  MEASUREMENTS: Ruler,
  PHOTO: Camera,
};

/**
 * Quiet-data nudges — analytics go blind when a stream the athlete already
 * uses stops getting entries. Silent when everything is fresh, and never
 * mentions features they've never touched.
 */
export function DataFreshnessCard({ state }: { state: AppState }) {
  const nudges = useMemo(
    () => staleData(state.weights, state.measurements, state.checkIns, isoDay()),
    [state.weights, state.measurements, state.checkIns],
  );

  if (!nudges.length) return null;

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-grit rounded-2xl p-4 space-y-2.5">
        {nudges.map((n) => {
          const Icon = ICON[n.kind];
          return (
            <div key={n.kind} className="flex items-start gap-2.5">
              <Icon size={14} className="text-accent-red shrink-0 mt-0.5" />
              <p className="text-[11px] text-grit-dim leading-relaxed">{n.message}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
