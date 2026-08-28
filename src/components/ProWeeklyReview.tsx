import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Crown,
  Lock,
  Target,
  TriangleAlert,
} from "lucide-react";

import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { buildProReview, type ReviewAction } from "@/lib/pro-review";
import { useAppState } from "@/lib/storage";

const TONE_ICON: Record<ReviewAction["tone"], typeof Check> = {
  urgent: TriangleAlert,
  progress: Target,
  ready: Check,
};

const TONE_COLOR: Record<ReviewAction["tone"], string> = {
  urgent: "#f4c33a",
  progress: "#e63222",
  ready: "#55d98a",
};

export function ProWeeklyReview() {
  const [state] = useAppState();
  const { isPro, loading } = usePro();
  const locked = loading || !isPro;
  const review = useMemo(() => buildProReview(state), [state]);

  if (state.sessions.filter((session) => session.endedAt).length === 0 && !locked) {
    return (
      <section className="deadset-section">
        <div className="rounded-2xl border border-white/10 bg-grit-card p-4">
          <p className="label-cap flex items-center gap-1.5 text-[9px] text-pro">
            <ClipboardCheck size={12} /> PRO WEEKLY REVIEW
          </p>
          <h2 className="display mt-2 text-xl font-black uppercase text-grit">
            Your first review starts after one session
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-grit-dim">
            Log the workout. DEADSET will turn your volume, PRs, balance and progression into a
            short action list.
          </p>
          <Link
            to="/train"
            className="btn-grit mt-4 flex min-h-11 items-center justify-center gap-2"
          >
            Start training <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="deadset-section">
      <div
        className="relative overflow-hidden rounded-2xl border p-4"
        style={{
          borderColor: "rgba(244,195,58,.42)",
          background: "linear-gradient(145deg, rgba(36,29,12,.98), rgba(12,12,13,.98) 62%)",
          boxShadow: "0 22px 52px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)",
        }}
      >
        <div
          className={locked ? "pointer-events-none select-none blur-[5px] opacity-55" : undefined}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="label-cap flex items-center gap-1.5 text-[9px] text-pro">
                <ClipboardCheck size={12} /> PRO WEEKLY REVIEW
              </p>
              <h2 className="display mt-1 text-2xl font-black uppercase leading-none text-grit">
                {review.headline}
              </h2>
            </div>
            <div className="shrink-0 text-right">
              <p className="display text-4xl font-black leading-none text-pro-gradient">
                {review.score}
              </p>
              <p className="label-cap mt-1 text-[8px] text-grit-dim">WEEK SCORE</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {review.wins.map((win) => (
              <div
                key={win.label}
                className="rounded-xl border border-white/10 bg-black/30 px-2 py-2.5"
              >
                <p
                  className="display text-lg font-black leading-none"
                  style={{ color: win.positive ? "#55d98a" : "#8a8a8a" }}
                >
                  {win.value}
                </p>
                <p className="mt-1 text-[8px] leading-tight text-grit-dim">{win.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {review.actions.map((action, index) => {
              const Icon = TONE_ICON[action.tone];
              const color = TONE_COLOR[action.tone];
              return (
                <Link
                  key={action.id}
                  to={action.to}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 press"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ color, background: `${color}18` }}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="label-cap text-[8px] text-grit-dim">MOVE {index + 1}</span>
                    <span className="block text-xs font-bold text-grit">{action.title}</span>
                    <span className="block text-[9px] leading-snug text-grit-dim">
                      {action.detail}
                    </span>
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-grit-dim" />
                </Link>
              );
            })}
          </div>
        </div>

        {locked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-5">
            <div className="max-w-[290px] text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-pro/40 bg-pro/10 text-pro">
                <Lock size={18} />
              </span>
              <p className="display mt-3 text-2xl font-black uppercase leading-none text-pro-gradient">
                Your week, decided
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#b7ac8e]">
                One review combines progression, plateaus, volume, balance and PR targets into the
                next three moves.
              </p>
              <button
                type="button"
                onClick={() => openPaywall("weekly-review")}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-pro px-4 text-[11px] font-black uppercase text-[#14110a]"
              >
                <Crown size={14} /> Unlock weekly review
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
