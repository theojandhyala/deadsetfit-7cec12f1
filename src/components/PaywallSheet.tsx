import { useNavigate } from "@tanstack/react-router";
import { Crown, X, Check } from "lucide-react";
import { usePaywall } from "@/hooks/usePro";

const PRO_PERKS = [
  "Physique Scan — AI-powered body analysis & weakness detection",
  "AI Coach — unlimited messages",
  "Featured training programs (5/3/1, nSuns, PHUL, more)",
  "Advanced analytics & PR history charts",
  "Schedule generation tuned to your physique scan results",
  "Share workouts & PRs as cards",
  "Priority support",
];

export function PaywallSheet() {
  const { state, close } = usePaywall();
  const navigate = useNavigate();

  if (!state.open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div
        className="relative w-full max-w-md bg-grit-bg border-t border-grit-card rounded-t-2xl p-6 pb-10 animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 text-grit hover:text-grit-text"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Crown size={18} className="text-accent-red" />
          <span className="font-display text-xs uppercase tracking-widest text-accent-red">
            DEADSET Pro
          </span>
        </div>

        <h2 className="font-display text-2xl uppercase tracking-wider text-grit-text leading-tight">
          {state.feature} is a Pro feature
        </h2>
        {state.description && <p className="mt-2 text-sm text-grit">{state.description}</p>}

        <ul className="mt-6 space-y-3">
          {PRO_PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-3 text-sm text-grit-text">
              <Check size={16} className="text-accent-red mt-0.5 shrink-0" />
              <span>{perk}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-3xl text-grit-text">$4.99</span>
          <span className="text-xs text-grit uppercase tracking-widest">/ month</span>
          <span className="ml-auto text-[10px] text-grit uppercase tracking-widest">
            or $39.99/yr
          </span>
        </div>

        <button
          onClick={() => {
            close();
            navigate({ to: "/upgrade" });
          }}
          className="mt-5 w-full rounded-md bg-accent-red px-6 py-3.5 font-display text-sm uppercase tracking-widest text-white hover:bg-accent-red/90 transition-colors"
        >
          Go Pro
        </button>
        <button
          onClick={close}
          className="mt-2 w-full text-center text-[11px] text-grit uppercase tracking-widest hover:text-grit-text"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
