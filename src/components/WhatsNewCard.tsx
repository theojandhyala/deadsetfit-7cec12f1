import { useState } from "react";
import { Sparkles, X } from "lucide-react";

import {
  WHATS_NEW,
  WHATS_NEW_VERSION,
  readWhatsNewSeen,
  dismissWhatsNew,
} from "@/lib/whats-new";

/**
 * Feature discovery — new engines are useless if nobody knows they exist.
 * One dismissible card; dismissing remembers the version so only genuinely
 * new drops bring it back.
 */
export function WhatsNewCard() {
  const [dismissed, setDismissed] = useState(() => readWhatsNewSeen() >= WHATS_NEW_VERSION);

  if (dismissed || !WHATS_NEW.length) return null;

  return (
    <section className="px-5 mb-6">
      <div className="bg-grit-card border border-accent-red/50 rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent-red/15 blur-2xl" />
        <div className="flex items-start justify-between">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
            <Sparkles size={12} /> New in DEADSET
          </p>
          <button
            type="button"
            aria-label="Dismiss what's new"
            className="icon-btn -mr-2 -mt-2 text-grit-dim"
            onClick={() => {
              dismissWhatsNew();
              setDismissed(true);
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 mt-1">
          {WHATS_NEW.map((f) => (
            <div key={f.title} className="flex items-baseline gap-2">
              <p className="text-[11px] leading-relaxed text-grit-dim min-w-0">
                <span className="display font-extrabold uppercase text-grit">{f.title}</span>{" "}
                <span className="text-accent-red/80 label-cap text-[8px]">{f.where}</span> —{" "}
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
