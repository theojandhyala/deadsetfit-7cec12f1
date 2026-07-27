import { useMemo } from "react";
import { TrendingUp, ArrowUp, Minus, Lock } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { progressionBoard } from "@/lib/progression";

/**
 * "Progression Ready" — scans every trained lift and tells you what to load
 * next session, powered by the RPE-aware engine. Ready-to-move-up first.
 * Progression is a Pro feature, so details are gated consistently with the
 * live logger (blurred + lock for free users).
 */
export function ProgressionBoard() {
  const [state] = useAppState();
  const { isPro, loading } = usePro();
  const board = useMemo(() => progressionBoard(state), [state]);

  if (board.length === 0) return null;
  const locked = !loading && !isPro;
  const readyCount = board.filter((b) => b.suggestion.kind === "up").length;

  return (
    <section className="px-5 mb-6 animate-slide-up">
      <div className="deadset-3d-panel bg-grit-card border border-grit rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-accent-red" />
            <h2 className="display text-lg font-extrabold uppercase text-grit leading-none">
              Progression Ready
            </h2>
          </div>
          {readyCount > 0 && (
            <span className="label-cap text-[9px] rounded-full border border-accent-red/40 bg-accent-red/10 px-2 py-0.5 text-accent-red">
              {readyCount} to move up
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {board.slice(0, 6).map((e) => {
            const up = e.suggestion.kind === "up";
            return (
              <button
                key={e.exerciseId}
                onClick={() => locked && openPaywall("progression")}
                className="flex items-center justify-between gap-3 rounded-xl border border-grit bg-[#080808] px-3 py-2.5 text-left press"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-grit truncate">{e.name}</p>
                  <p
                    className={
                      "text-[10px] text-grit-dim mt-0.5" + (locked ? " blur-[4px] select-none" : "")
                    }
                  >
                    {e.suggestion.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={
                      "display text-lg font-extrabold leading-none" +
                      (locked ? " blur-[5px] select-none" : "")
                    }
                    style={{ color: up ? "#e63222" : "#8A8A8A" }}
                  >
                    {e.suggestion.weightKg}kg
                  </span>
                  {locked ? (
                    <Lock size={13} className="text-accent-red" />
                  ) : up ? (
                    <ArrowUp size={16} className="text-accent-red" />
                  ) : (
                    <Minus size={16} className="text-grit-dim" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {locked && (
          <button
            onClick={() => openPaywall("progression")}
            className="mt-3 w-full text-center label-cap text-[10px] text-accent-red press"
          >
            Unlock progression intelligence →
          </button>
        )}
      </div>
    </section>
  );
}
