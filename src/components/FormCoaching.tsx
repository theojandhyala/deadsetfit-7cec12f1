import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Wind } from "lucide-react";
import { coachingFor } from "@/lib/exercise-coaching";

/**
 * Form cues for a lift. Collapsed by default in the gym: someone mid-set wants
 * one glance, not an essay.
 */
export function FormCoaching({
  exerciseId,
  name,
  defaultOpen = false,
  compact = false,
}: {
  exerciseId: string;
  name?: string;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const coaching = coachingFor(exerciseId, name ?? "");
  const [open, setOpen] = useState(defaultOpen);
  if (!coaching) return null;

  return (
    <div
      className={
        compact
          ? "border-t border-grit pt-2"
          : "deadset-3d-panel border border-grit bg-grit-card p-4"
      }
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="label-cap text-[10px] text-grit">How to do it properly</span>
        {open ? (
          <ChevronUp size={16} className="text-grit-dim" />
        ) : (
          <ChevronDown size={16} className="text-grit-dim" />
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <div>
            <p className="label-cap mb-1 text-[9px] text-accent-red">Set up</p>
            <ul className="space-y-1">
              {coaching.setup.map((line) => (
                <li key={line} className="flex gap-2 text-[12px] leading-relaxed text-grit-dim">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-accent-red" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-cap mb-1 text-[9px] text-accent-red">The rep</p>
            <ul className="space-y-1">
              {coaching.execution.map((line) => (
                <li key={line} className="flex gap-2 text-[12px] leading-relaxed text-grit-dim">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-accent-red" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-cap mb-1 flex items-center gap-1 text-[9px] text-amber-300">
              <AlertTriangle size={10} /> Common mistakes
            </p>
            <ul className="space-y-1.5">
              {coaching.mistakes.map((m) => (
                <li key={m.wrong} className="text-[12px] leading-relaxed">
                  <span className="text-grit">{m.wrong}</span>
                  <span className="text-grit-dim"> — {m.fix}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-grit-dim">
            <Wind size={11} className="mt-0.5 shrink-0 text-grit-dim" />
            {coaching.breathing}
          </p>
        </div>
      )}
    </div>
  );
}
