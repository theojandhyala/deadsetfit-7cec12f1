import { useMemo } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { FEEL_EMOJI, feelTrend } from "@/lib/session-feel";
import type { AppState, SessionFeel } from "@/lib/types";

/**
 * How training has been feeling lately. Silent until there is enough rated
 * history to say something honest — a single bad day is not a trend.
 */
export function SessionFeelCard({ state }: { state: AppState }) {
  const trend = useMemo(() => feelTrend(state.sessions ?? []), [state.sessions]);
  if (trend.recent == null || trend.rated < 2) return null;

  const rounded = Math.round(trend.recent) as SessionFeel;
  const copy =
    trend.direction === "up"
      ? "Sessions are feeling better than they were."
      : trend.direction === "down"
        ? "Sessions have been feeling worse. Check sleep, food and whether the load crept up."
        : trend.direction === "flat"
          ? "Steady — training is feeling about the same as last block."
          : "Rate a few more sessions to see which way this is going.";

  const Icon =
    trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const color =
    trend.direction === "up" ? "#22c55e" : trend.direction === "down" ? "#e63222" : "#8a8a8a";

  return (
    <section className="deadset-section">
      <div className="deadset-section-title mb-2">
        <h2 className="display text-xl font-extrabold uppercase leading-none text-grit">
          How it's feeling
        </h2>
      </div>
      <div className="deadset-3d-panel flex items-center gap-4 border border-grit bg-grit-card p-4">
        <span className="text-4xl">{FEEL_EMOJI[rounded]}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="display text-2xl font-extrabold leading-none text-white">
              {trend.recent.toFixed(1)}
            </span>
            <span className="text-xs text-grit-dim">/ 5</span>
            <Icon size={14} style={{ color }} />
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-grit-dim">{copy}</p>
          <p className="mt-1 text-[10px] text-grit-dim">
            Across your last {trend.rated} rated {trend.rated === 1 ? "session" : "sessions"}
            {trend.previous != null ? ` · was ${trend.previous.toFixed(1)}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
