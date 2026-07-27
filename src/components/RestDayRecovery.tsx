import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, ChevronRight } from "lucide-react";
import { muscleRecovery, recoveryLabel, type MuscleGroup } from "@/lib/recovery";
import type { AppState } from "@/lib/types";

const NICE: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  ARMS: "Arms",
  LEGS: "Legs",
  CORE: "Core",
};

/**
 * Rest-day recovery read: which muscles are still recovering from recent work,
 * with a mobility CTA. Turns a dead "Rest Day" screen into something useful.
 */
export function RestDayRecovery({ state }: { state: AppState }) {
  const rows = useMemo(() => {
    return muscleRecovery(state)
      .filter((r) => r.lastTrained) // only muscles actually trained recently
      .sort((a, b) => a.pct - b.pct) // most fatigued first
      .slice(0, 3);
  }, [state]);

  if (rows.length === 0) return null;

  const focus = rows[0];

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4 mt-3 text-left">
      <p className="label-cap text-[10px] flex items-center gap-1.5 mb-3">
        <Heart size={12} className="text-accent-red" /> Recovery status
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const meta = recoveryLabel(r.pct);
          return (
            <div key={r.muscle} className="flex items-center gap-3">
              <span className="text-xs text-grit w-20 shrink-0">{NICE[r.muscle]}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#0a0a0a] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.pct}%`, background: meta.color }}
                />
              </div>
              <span
                className="label-cap text-[9px] w-16 text-right shrink-0"
                style={{ color: meta.color }}
              >
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-grit-dim mt-3">
        {focus.pct < 60
          ? `Your ${NICE[focus.muscle].toLowerCase()} is still recovering — keep it light and mobilise.`
          : "You're fresh — a mobility flow keeps you loose for tomorrow."}
      </p>
      <Link
        to="/recovery"
        className="mt-2 inline-flex items-center gap-1 label-cap text-[10px] text-accent-red press"
      >
        Recovery &amp; mobility <ChevronRight size={12} />
      </Link>
    </div>
  );
}
