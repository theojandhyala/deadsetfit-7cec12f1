import { useEffect, useRef, useState } from "react";
import { Crown, Check } from "lucide-react";
import { usePro } from "@/hooks/usePro";

const WELCOME_FLAG = "deadset_pro_welcomed_v1";

const UNLOCKED = [
  "Streak Armor — your streak is now protected",
  "Progression intelligence + Ghost Mode",
  "Full Weekly Leagues + Head-to-Head",
  "Advanced analytics & strength standards",
  "Unlimited custom programs + featured plans",
  "Muscle recovery & advanced nutrition",
];

/**
 * One-time gold celebration shown the moment a user becomes Pro.
 * Fires only on a genuine non-Pro → Pro transition; users who were already
 * Pro before this shipped are marked silently and never interrupted.
 * Mounted globally inside ProProvider so it catches embedded-checkout and
 * redirect-return flows alike.
 */
export function ProWelcome() {
  const { isPro } = usePro();
  const [show, setShow] = useState(false);
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    let welcomed = false;
    try {
      welcomed = localStorage.getItem(WELCOME_FLAG) === "1";
    } catch {
      /* storage unavailable — treat as not welcomed */
    }

    // First observation this session.
    if (prev.current === null) {
      prev.current = isPro;
      // Already Pro before the celebration existed → mark seen, don't interrupt.
      if (isPro && !welcomed) {
        try {
          localStorage.setItem(WELCOME_FLAG, "1");
        } catch {
          /* ignore */
        }
      }
      return;
    }

    // Genuine upgrade: non-Pro → Pro, and we haven't celebrated yet.
    if (!prev.current && isPro && !welcomed) {
      setShow(true);
      try {
        localStorage.setItem(WELCOME_FLAG, "1");
      } catch {
        /* ignore */
      }
    }
    prev.current = isPro;
  }, [isPro]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      style={{ background: "rgba(6,5,2,0.82)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      onClick={() => setShow(false)}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-pro pro-glow p-6 text-center"
        style={{
          background: "linear-gradient(160deg, #201a0c 0%, #2b2108 45%, #0d0a04 100%)",
          animation: "pro-pop 0.5s cubic-bezier(.2,.9,.3,1.2) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold shine sweep */}
        <div
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,240,190,0.35), transparent)",
            animation: "pro-sweep 1.6s ease-in-out 0.35s both",
          }}
        />
        <div
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 35%, #f8d566, #eab212 70%)",
            boxShadow: "0 0 34px rgba(234,178,18,0.6)",
          }}
        >
          <Crown size={30} strokeWidth={2.5} className="text-[#14110a]" />
        </div>
        <p className="label-cap text-[10px] tracking-[0.28em] text-pro">Welcome to</p>
        <h2 className="display text-4xl font-extrabold uppercase text-pro-gradient leading-none mt-1">
          DEADSET Pro
        </h2>
        <p className="text-xs text-[#b7ac8e] mt-3 mb-4">
          You just unlocked the full arsenal. Here's everything that's now yours:
        </p>
        <div className="grid grid-cols-1 gap-1.5 text-left mb-5">
          {UNLOCKED.map((item) => (
            <div key={item} className="flex items-center gap-2 text-[12px] text-grit">
              <Check size={13} strokeWidth={3} className="text-pro shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShow(false)}
          className="w-full rounded-lg py-3 font-display font-extrabold uppercase tracking-wide text-[#14110a]"
          style={{ background: "linear-gradient(180deg, #f8d566, #eab212)" }}
        >
          Let's Go
        </button>
      </div>
    </div>
  );
}
