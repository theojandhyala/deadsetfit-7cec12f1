import { X, TrendingUp } from "lucide-react";
import { badgeColor, calculateGritScore, gritBadge } from "@/lib/calc";
import {
  GRIT_MAX,
  GRIT_POINTS,
  gritNextStep,
  gritSources,
  nextGritTier,
} from "@/lib/grit-explainer";
import type { AppState } from "@/lib/types";

const EARNING = [
  { label: "Each day of your streak", points: GRIT_POINTS.streakDay },
  { label: "Each PR you set this week", points: GRIT_POINTS.pr },
  { label: "A check-in photo", points: GRIT_POINTS.checkIn },
  { label: "A set of measurements", points: GRIT_POINTS.measurement },
  { label: "A day you hit your calories", points: GRIT_POINTS.calorieDay },
  { label: "A day you hit your protein", points: GRIT_POINTS.proteinDay },
];

/**
 * Explains grit, using the athlete's own numbers.
 *
 * The score was the biggest thing on the Train screen and nothing said what it
 * measured or how to move it — a new athlete just saw a zero. This shows where
 * their points came from, what the next rank costs, and the one action worth
 * doing next.
 */
export function GritSheet({ state, onClose }: { state: AppState; onClose: () => void }) {
  const breakdown = calculateGritScore(state);
  const score = breakdown.total;
  const badge = gritBadge(score);
  const colour = badgeColor(badge);
  const sources = gritSources(breakdown);
  const next = nextGritTier(score);
  const pct = Math.round((score / GRIT_MAX) * 100);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center"
      style={{ background: "rgba(6,4,4,0.82)" }}
      role="dialog"
      aria-modal="true"
      aria-label="How grit works"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-grit bg-grit-card p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="label-cap text-[10px] text-grit-dim">Your grit</p>
            <p className="display text-4xl font-black leading-none text-grit">{score}</p>
            <p className="label-cap mt-1 text-[11px]" style={{ color: colour }}>
              {badge}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn tap-44 text-grit-dim">
            <X size={20} />
          </button>
        </div>

        <div className="h-1.5 w-full bg-[#1a1a1a]">
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: colour }}
          />
        </div>
        <p className="mt-2 text-[11px] text-grit-dim">
          {next
            ? `${next.remaining} more to reach ${next.badge}.`
            : "Top rank. Nothing above this."}
        </p>

        <div className="mt-4 flex items-start gap-2 border border-accent-red/30 bg-accent-red/[0.07] p-3">
          <TrendingUp size={14} className="mt-0.5 shrink-0 text-accent-red" />
          <p className="text-xs leading-relaxed text-grit">{gritNextStep(breakdown)}</p>
        </div>

        <p className="label-cap mt-5 mb-2 text-[10px] text-grit-dim">Where yours came from</p>
        {sources.length === 0 ? (
          <p className="text-xs leading-relaxed text-grit-dim">
            Nothing yet. Grit measures the work you log — finish a session and it starts moving.
          </p>
        ) : (
          <div className="divide-y divide-[#1f1f1f]">
            {sources.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-grit">{s.label}</p>
                  <p className="text-[10px] text-grit-dim">{s.detail}</p>
                </div>
                <span
                  className="display shrink-0 text-base font-extrabold"
                  style={{ color: s.points < 0 ? "#8a8a8a" : "#e63222" }}
                >
                  {s.points > 0 ? "+" : ""}
                  {s.points}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="label-cap mt-5 mb-2 text-[10px] text-grit-dim">How it's earned</p>
        <div className="divide-y divide-[#1f1f1f]">
          {EARNING.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-xs text-grit-dim">{row.label}</span>
              <span className="text-xs font-bold text-grit">+{row.points}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-xs text-grit-dim">Nothing logged for 48 hours</span>
            <span className="text-xs font-bold text-grit-dim">−{GRIT_POINTS.idlePenalty}</span>
          </div>
        </div>

        <button onClick={onClose} className="btn-grit mt-5 min-h-11 w-full rounded-xl text-sm">
          Got it
        </button>
      </div>
    </div>
  );
}
