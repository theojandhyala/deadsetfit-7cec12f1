import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Crown, Check, X } from "lucide-react";
import { usePro } from "@/hooks/usePro";
import { maybeNudge, type NudgePayload } from "@/lib/upgrade-prompts";
import { useAppState } from "@/lib/storage";

const PERKS = [
  "Volume Optimizer + Plateau Breaker",
  "Strength projections & milestone dates",
  "Full leagues, H2H & Streak Armor",
];

/**
 * Global, frequency-capped "Go Pro" prompt. Listens for upgrade-nudge events
 * (fired at high-intent moments) and also fires a soft weekly nudge on app
 * open. Never shows for Pro users or on native iOS (handled upstream).
 */
export function UpgradeNudge() {
  const { isPro, loading } = usePro();
  const [state] = useAppState();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<NudgePayload | null>(null);

  useEffect(() => {
    const onNudge = (e: Event) => {
      if (isPro) return;
      setPayload((e as CustomEvent<NudgePayload>).detail);
    };
    window.addEventListener("deadset:upgrade-nudge", onNudge);
    return () => window.removeEventListener("deadset:upgrade-nudge", onNudge);
  }, [isPro]);

  // Soft weekly nudge shortly after the app settles — only for confirmed free users.
  useEffect(() => {
    if (loading || isPro || (state.sessions?.length ?? 0) < 2) return;
    const t = setTimeout(() => maybeNudge("weekly"), 5000);
    return () => clearTimeout(t);
  }, [loading, isPro, state.sessions?.length]);

  if (!payload || isPro) return null;

  const dismiss = () => setPayload(null);
  const goPro = () => {
    dismiss();
    navigate({ to: "/upgrade" });
  };

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      // No backdrop-filter: composites as solid black while scrolling in WKWebView/iOS Safari.
      style={{ background: "rgba(6,5,2,0.86)" }}
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-pro pro-glow p-5"
        style={{
          background: "linear-gradient(160deg, #201a0c 0%, #2b2108 45%, #0d0a04 100%)",
          animation: "pro-pop 0.4s cubic-bezier(.2,.9,.3,1.2) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="icon-btn absolute top-3 right-3 text-[#8a8a8a] press"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-2">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full shrink-0"
            style={{ background: "radial-gradient(circle at 50% 35%, #f8d566, #eab212 70%)" }}
          >
            <Crown size={18} strokeWidth={2.5} className="text-[#14110a]" />
          </div>
          <p className="display text-lg font-extrabold uppercase text-pro-gradient leading-none">
            {payload.title}
          </p>
        </div>
        <p className="text-[13px] text-[#c9bfa6] leading-relaxed mb-3">{payload.message}</p>
        <div className="flex flex-col gap-1.5 mb-4">
          {PERKS.map((p) => (
            <div key={p} className="flex items-center gap-2 text-[12px] text-grit">
              <Check size={13} strokeWidth={3} className="text-pro shrink-0" />
              <span>{p}</span>
            </div>
          ))}
        </div>
        <button
          onClick={goPro}
          className="w-full rounded-lg py-3 font-display font-extrabold uppercase tracking-wide text-[#14110a] press"
          style={{ background: "linear-gradient(180deg, #f8d566, #eab212)" }}
        >
          See Pro
        </button>
        <button onClick={dismiss} className="w-full text-center text-xs text-grit-dim mt-2.5 press">
          Maybe later
        </button>
      </div>
    </div>
  );
}
