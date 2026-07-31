import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Dumbbell, Flame, Trophy, X } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { calculateStreak } from "@/lib/calc";

const SHOWN_KEY = "deadset_weekly_recap_at";
const MIN_GAP_MS = 6 * 86400000; // at most once every ~week

function readShown(): number {
  try {
    return Number(localStorage.getItem(SHOWN_KEY) || "0");
  } catch {
    return 0;
  }
}

/**
 * A once-a-week "your week in review" summary, computed from the last 7 days of
 * sessions. Informational (not a purchase prompt), frequency-capped, and only
 * shown when there's something to celebrate.
 */
export function WeeklyRecapNudge() {
  const [state] = useAppState();
  const [open, setOpen] = useState(false);

  const recap = useMemo(() => {
    const since = Date.now() - 7 * 86400000;
    const sessions = (state.sessions ?? []).filter((s) => {
      if (!s.endedAt) return false;
      const t = Date.parse(s.startedAt || s.date);
      return Number.isFinite(t) && t >= since;
    });
    return {
      count: sessions.length,
      volume: Math.round(sessions.reduce((n, s) => n + (s.totalVolume ?? 0), 0)),
      prs: sessions.reduce((n, s) => n + (s.prCount ?? 0), 0),
      streak: calculateStreak(state.completedDates),
    };
  }, [state.sessions, state.completedDates]);

  useEffect(() => {
    if (recap.count < 1) return;
    if (Date.now() - readShown() < MIN_GAP_MS) return;
    const t = setTimeout(() => {
      // Re-check the cap at fire time (avoids double-show across quick remounts).
      if (Date.now() - readShown() < MIN_GAP_MS) return;
      try {
        localStorage.setItem(SHOWN_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      setOpen(true);
    }, 3500);
    return () => clearTimeout(t);
    // Only decide once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const tons = Math.round((recap.volume / 1000) * 10) / 10;

  return (
    <div
      className="fixed inset-0 z-[114] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: "rgba(6,6,8,0.72)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-grit bg-grit-card p-5"
        style={{ animation: "pro-pop 0.4s cubic-bezier(.2,.9,.3,1.2) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="icon-btn absolute top-3 right-3 text-grit-dim press"
        >
          <X size={18} />
        </button>
        <p className="label-cap text-[10px] flex items-center gap-1.5 text-accent-red">
          <CalendarRange size={12} /> Your week in review
        </p>
        <h2 className="display text-3xl font-extrabold uppercase text-grit leading-none mt-1 mb-4">
          7 days, logged
        </h2>
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Stat icon={Dumbbell} label="Sessions" value={String(recap.count)} />
          <Stat icon={Trophy} label="New PRs" value={String(recap.prs)} accent />
          <Stat icon={Dumbbell} label="Volume" value={`${tons}t`} />
          <Stat icon={Flame} label="Streak" value={`${recap.streak}d`} accent />
        </div>
        <p className="text-xs text-grit-dim mb-4">
          {recap.prs > 0
            ? `${recap.prs} new PR${recap.prs > 1 ? "s" : ""} this week — momentum's yours. Keep stacking.`
            : recap.count >= 3
              ? "Consistent week. This is how it's built."
              : "Every session counts. Let's stack a few more next week."}
        </p>
        <button onClick={() => setOpen(false)} className="btn-grit w-full rounded-xl">
          Let's Go Again
        </button>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-grit bg-[#141414] p-3">
      <Icon size={14} className={accent ? "text-accent-red" : "text-grit-dim"} />
      <p className="display text-2xl font-extrabold text-grit leading-none mt-1.5">{value}</p>
      <p className="label-cap text-[9px] text-grit-dim mt-0.5">{label}</p>
    </div>
  );
}
