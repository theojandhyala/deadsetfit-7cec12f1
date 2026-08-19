import { useState } from "react";
import { Check } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { FEEL_EMOJI, FEEL_LABEL } from "@/lib/session-feel";
import type { SessionFeel } from "@/lib/types";

const FEELS: SessionFeel[] = [1, 2, 3, 4, 5];

/**
 * Post-session reflection on the finish screen. Rating is one tap and the note
 * is optional — asked once, while the session is still fresh, and never
 * blocking the way out of the workout.
 */
export function SessionReflection({ sessionId }: { sessionId: string }) {
  const [state, set] = useAppState();
  const session = state.sessions.find((s) => s.id === sessionId);
  const [note, setNote] = useState(session?.note ?? "");
  const [saved, setSaved] = useState(false);

  function update(patch: { feel?: SessionFeel; note?: string }) {
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === sessionId ? { ...x, ...patch } : x)),
    }));
  }

  const feel = session?.feel;

  return (
    <div className="deadset-3d-panel border border-grit bg-grit-card p-4">
      <p className="label-cap text-[10px] text-grit-dim">How did that feel?</p>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {FEELS.map((f) => (
          <button
            key={f}
            onClick={() => update({ feel: f })}
            aria-label={FEEL_LABEL[f]}
            aria-pressed={feel === f}
            className="flex min-h-[56px] flex-col items-center justify-center rounded-lg border transition-colors"
            style={{
              borderColor: feel === f ? "#e63222" : "#262626",
              background: feel === f ? "rgba(230,50,34,0.12)" : "transparent",
            }}
          >
            <span className="text-lg">{FEEL_EMOJI[f]}</span>
            <span className="mt-0.5 text-[8px] uppercase tracking-wide text-grit-dim">
              {FEEL_LABEL[f]}
            </span>
          </button>
        ))}
      </div>

      <textarea
        defaultValue={session?.note ?? ""}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything worth remembering? Sleep, niggles, what worked."
        rows={2}
        maxLength={500}
        className="mt-3 w-full resize-none rounded-lg border border-grit bg-[#101010] px-3 py-2 text-sm text-white placeholder:text-grit-dim"
      />
      <button
        onClick={() => {
          update({ note: note.trim() });
          setSaved(true);
        }}
        className="btn-ghost mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 text-xs"
      >
        {saved ? (
          <>
            <Check size={14} /> Saved
          </>
        ) : (
          "Save note"
        )}
      </button>
    </div>
  );
}
