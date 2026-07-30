import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, AlertTriangle, TrendingUp, Lock, ChevronRight } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { allInsights, type InsightTone } from "@/lib/pro-intelligence";

const toneIcon: Record<InsightTone, typeof Sparkles> = {
  warn: AlertTriangle,
  info: Sparkles,
  good: TrendingUp,
};
const toneColor: Record<InsightTone, string> = {
  warn: "#f59e0b",
  info: "#3b9eff",
  good: "#22c55e",
};

/**
 * A single high-priority coaching insight surfaced in the daily training flow.
 * Pro users read it live; free users see it blurred with a gold unlock — so the
 * value of Pro shows up every time they open the app to train.
 */
export function TrainingInsight() {
  const [state] = useAppState();
  const { isPro, loading } = usePro();
  const insights = useMemo(() => allInsights(state), [state]);

  if (insights.length === 0) return null; // nothing worth saying yet

  const top = insights[0];
  const Icon = toneIcon[top.tone];

  // Free users (and while Pro status resolves): locked teaser.
  if (!isPro || loading) {
    return (
      <button
        onClick={() => openPaywall("advanced-analytics")}
        className="w-full text-left rounded-2xl border border-pro pro-glow p-4 press mb-4"
        style={{ background: "linear-gradient(135deg, #201a0c 0%, #241b09 55%, #0d0a04 100%)" }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Lock size={13} className="text-pro" />
          <span className="label-cap text-[10px] text-pro">DEADSET Intelligence</span>
        </div>
        <p className="text-sm font-bold text-grit">
          {insights.length} coaching insight{insights.length === 1 ? "" : "s"} from your training
        </p>
        <p className="text-xs text-[#b7ac8e] mt-0.5 blur-[5px] select-none">
          {top.title} — {top.message}
        </p>
        <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-display font-extrabold uppercase tracking-wide text-pro">
          Unlock with Pro <ChevronRight size={12} />
        </span>
      </button>
    );
  }

  // Pro users: the real insight, linking to the full report.
  return (
    <Link
      to="/progress"
      className="w-full block rounded-2xl bg-grit-card border border-grit p-4 press mb-4"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} style={{ color: toneColor[top.tone] }} />
        <span className="label-cap text-[10px] text-grit-dim">Coach's read</span>
        {insights.length > 1 && (
          <span className="label-cap text-[10px] text-pro ml-auto">
            +{insights.length - 1} more
          </span>
        )}
      </div>
      <p className="text-sm font-bold text-grit">{top.title}</p>
      <p className="text-xs text-grit-dim mt-0.5">{top.message}</p>
      <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-display font-extrabold uppercase tracking-wide text-accent-red">
        Full report <ChevronRight size={12} />
      </span>
    </Link>
  );
}
