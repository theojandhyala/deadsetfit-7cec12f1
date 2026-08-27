import { useState } from "react";
import { Sparkles, X } from "lucide-react";

import { WHATS_NEW, WHATS_NEW_VERSION, readWhatsNewSeen, dismissWhatsNew } from "@/lib/whats-new";

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
      <div className="relative overflow-hidden rounded-2xl border border-accent-red/50 bg-grit-card p-4">
        <div className="flex items-start justify-between">
          <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
            <Sparkles size={12} /> New in 1.1
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

        <div className="mt-2 divide-y divide-white/5">
          {WHATS_NEW.map((f) => (
            <div key={f.title} className="py-2.5 first:pt-1 last:pb-0">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="display min-w-0 text-[12px] font-extrabold uppercase text-grit">
                  {f.title}
                </p>
                <span className="label-cap shrink-0 text-[8px] text-accent-red/80">{f.where}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-grit-dim">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
