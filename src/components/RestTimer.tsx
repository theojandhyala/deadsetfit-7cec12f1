import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { restDoneChime } from "@/lib/feedback";

export function RestTimer({
  seconds,
  onDone,
  onDisable,
}: {
  seconds: number;
  onDone: () => void;
  onDisable?: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  useEffect(() => {
    if (left <= 0) {
      restDoneChime();
      onDone();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-md px-4 animate-slide-up">
      <div className="deadset-3d-panel bg-grit-card border border-accent-red p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="label-cap text-accent-red text-[10px]">REST</div>
            <div className="display text-4xl font-extrabold text-grit leading-none">{left}s</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLeft((s) => s + 15);
                setTotal((t) => Math.max(t, left + 15));
              }}
              className="btn-ghost px-3 py-2 text-xs"
            >
              <Plus size={14} className="mr-1" />
              15s
            </button>
            <button onClick={onDone} className="btn-grit px-3 py-2 text-xs">
              <X size={14} className="mr-1" />
              Skip
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-[#080808] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-red rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        {onDisable && (
          <button
            onClick={onDisable}
            className="mt-2.5 w-full text-center label-cap text-[9px] text-grit-dim press"
          >
            Turn off auto-rest
          </button>
        )}
      </div>
    </div>
  );
}
