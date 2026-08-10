import { useMemo } from "react";
import { Zap } from "lucide-react";

import { supersetPairs } from "@/lib/superset-suggest";

/**
 * Time-saver hint under the day's plan: antagonist push/pull pairs from
 * today's own exercises. One muscle rests while the other works — the same
 * session, ~10 minutes shorter. Renders nothing when the day has no pair.
 */
export function SupersetHint({ exercises }: { exercises: { name: string; muscle?: string }[] }) {
  const pairs = useMemo(() => supersetPairs(exercises), [exercises]);

  if (!pairs.length) return null;

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-3.5">
      <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
        <Zap size={12} /> Short on time?
      </p>
      <div className="space-y-1 mt-1.5">
        {pairs.map((p) => (
          <p key={`${p.push}|${p.pull}`} className="text-[11px] text-grit-dim leading-relaxed">
            Superset <span className="text-grit">{p.push}</span> with{" "}
            <span className="text-grit">{p.pull}</span> — antagonists, one rests while the other
            works.
          </p>
        ))}
      </div>
    </div>
  );
}
