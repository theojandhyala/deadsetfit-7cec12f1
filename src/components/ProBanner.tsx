import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Crown, X } from "lucide-react";

import { usePro } from "@/hooks/usePro";
import { hapticSelection } from "@/lib/haptics";
import { proPitch } from "@/lib/pro-pitch";
import { useAppState } from "@/lib/storage";

const DISMISS_KEY = "deadset_pro_banner_dismissed_session";

/**
 * The upgrade prompt, built from what this athlete has actually done.
 *
 * It used to say the same sentence to everybody — "Training Autopilot, Streak
 * Armor, head-to-head challenges and deep analytics" — a feature list in a
 * private vocabulary that means nothing on day one and nothing on day two
 * hundred. Now it leads with a number they earned: their streak, the muscles
 * they have graded, the records they hold. "23 sessions logged" is theirs;
 * "deep analytics" was ours.
 *
 * The gold sweep runs three times and stops. A banner is on screen the whole
 * time somebody is reading the page behind it, and an animation that loops
 * forever there is not premium, it is a flashing advert.
 */
export function ProBanner() {
  const { isPro, loading } = usePro();
  const [state] = useAppState();
  const [dismissed, setDismissed] = useState(false);
  const pitch = useMemo(() => proPitch(state), [state]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) setDismissed(true);
    } catch {
      /* Session storage is unavailable in some restricted browser modes. */
    }
  }, []);

  if (loading || isPro || dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    hapticSelection();
    setDismissed(true);
  }

  return (
    <section
      // Keyed on the pitch so a changed headline animates in rather than
      // swapping text under the reader mid-glance.
      key={pitch.id}
      className="pro-banner relative mx-4 mt-3 overflow-hidden rounded-2xl border border-accent-red/35 bg-[#141013] p-3.5"
      aria-label="DEADSET Pro"
    >
      <span className="pro-banner-sheen" aria-hidden />

      <div className="relative flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent-red/40 bg-accent-red/15">
          <Crown size={16} className="text-accent-red" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="label-cap text-[9px] text-accent-red">{pitch.eyebrow}</p>
          <p className="display mt-0.5 text-base font-extrabold uppercase leading-tight text-grit">
            {pitch.headline}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-grit-dim">{pitch.detail}</p>
        </div>

        <button
          onClick={dismiss}
          aria-label="Dismiss Pro banner"
          className="-mr-1 -mt-1 shrink-0 p-1.5 text-grit-dim press"
        >
          <X size={14} />
        </button>
      </div>

      <Link
        to="/upgrade"
        onClick={hapticSelection}
        className="btn-grit relative mt-3 min-h-11 w-full"
      >
        See what Pro adds
        <ChevronRight size={15} className="ml-1.5" />
      </Link>
    </section>
  );
}
