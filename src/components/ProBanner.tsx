import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, Crown, Gauge, Swords, X } from "lucide-react";
import { usePro } from "@/hooks/usePro";

const DISMISS_KEY = "deadset_pro_banner_dismissed_session";

export function ProBanner() {
  const { isPro, loading } = usePro();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) setDismissed(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (loading || isPro || dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="mx-4 mt-3 rounded-lg border border-accent-red/40 bg-gradient-to-r from-accent-red/20 via-[#171717] to-accent-red/5 p-3">
      <div className="flex items-center gap-3">
        <div className="shrink-0 grid place-items-center w-9 h-9 rounded-md bg-accent-red/20 border border-accent-red/40">
          <Crown size={16} className="text-accent-red" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs uppercase tracking-widest text-grit-text">
            Upgrade your training
          </p>
          <p className="text-[11px] text-grit mt-0.5">
            Training Autopilot, Streak Armor, head-to-head challenges and deep analytics.
          </p>
        </div>
        <Link
          to="/upgrade"
          className="shrink-0 rounded bg-accent-red px-3 py-1.5 font-display text-[10px] uppercase tracking-widest text-white hover:bg-accent-red/90"
        >
          Go Pro
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="icon-btn shrink-0 -mr-1 p-1 text-grit hover:text-grit-text"
        >
          <X size={14} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "Autopilot", Icon: Gauge },
          { label: "H2H", Icon: Swords },
          { label: "Analytics", Icon: BarChart3 },
        ].map(({ label, Icon }) => (
          <div
            key={label}
            className="flex items-center justify-center gap-1 rounded border border-accent-red/20 bg-black/25 px-2 py-1"
          >
            <Icon size={11} className="text-accent-red" />
            <span className="label-cap text-[8px] text-grit">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
