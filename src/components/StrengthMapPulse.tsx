import { Link } from "@tanstack/react-router";
import { ChevronRight, Target } from "lucide-react";
import { useMemo } from "react";

import { buildStrengthMap, strengthMapColor } from "@/lib/strength-map";
import type { AppState } from "@/lib/types";

export function StrengthMapPulse({ state }: { state: AppState }) {
  const map = useMemo(() => buildStrengthMap(state), [state]);
  const next = [...map.regions].sort((a, b) => {
    const status = { unplanned: 0, unlogged: 1, tracked: 2 } as const;
    return status[a.status] - status[b.status] || a.score - b.score;
  })[0];

  return (
    <section className="px-5 pb-5" aria-label="Strength Map update">
      <Link
        to="/progress"
        className="press flex min-h-[82px] items-center gap-3 overflow-hidden rounded-2xl border border-accent-red/35 bg-[radial-gradient(circle_at_80%_30%,rgba(230,50,34,.22),transparent_42%),linear-gradient(145deg,#171717,#090909)] px-4 py-3"
      >
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/45">
          <Target size={21} className="text-accent-red" />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-accent-red px-1.5 py-0.5 text-[8px] font-black text-white">
            {map.overall || "—"}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="label-cap text-[8px] text-accent-red">Strength Map pulse</p>
          <p className="mt-1 truncate text-[12px] font-black uppercase text-white">
            {next.status === "unplanned"
              ? `${next.label} needs coverage`
              : next.status === "unlogged"
                ? `Log ${next.label} to bring it live`
                : `${next.label} is your next build`}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
              style={{ width: `${next.score}%`, background: strengthMapColor(next.score) }}
            />
          </div>
        </div>
        <ChevronRight size={16} className="shrink-0 text-grit-dim" />
      </Link>
    </section>
  );
}
