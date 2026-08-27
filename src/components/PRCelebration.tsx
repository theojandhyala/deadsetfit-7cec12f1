import { useEffect } from "react";

import { hapticPersonalRecord } from "@/lib/haptics";
import { Trophy, X } from "lucide-react";

const PARTICLES = Array.from({ length: 56 });
const COLORS = ["#e63222", "#f5c542", "#f5f5f0", "#ff6b35", "#ffffff"];

export function PRCelebration({
  exerciseName,
  weight,
  reps,
  prevBest = 0,
  onClose,
}: {
  exerciseName: string;
  weight: number;
  reps: number;
  prevBest?: number;
  onClose: () => void;
}) {
  const delta = prevBest > 0 ? Math.round((weight - prevBest) * 10) / 10 : 0;

  useEffect(() => {
    hapticPersonalRecord();
    const t = setTimeout(onClose, 6500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center px-6 overflow-hidden"
      style={{ background: "radial-gradient(circle at center, #2a0800 0%, #0a0a0a 65%)" }}
      onClick={onClose}
    >
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map((_, i) => {
          const left = (i * 19 + 3) % 100;
          const delay = (i % 9) * 0.1;
          const size = 5 + (i % 5) * 3;
          const color = COLORS[i % COLORS.length];
          const rotate = i * 31;
          const duration = 1.4 + (i % 4) * 0.2;
          return (
            <span
              key={i}
              className="absolute block"
              style={{
                left: `${left}%`,
                top: `-${size + 4}px`,
                width: size,
                height: size,
                background: color,
                animationName: "pr-fall",
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                animationTimingFunction: "ease-in",
                animationFillMode: "forwards",
                transform: `rotate(${rotate}deg)`,
                borderRadius: i % 3 === 0 ? "50%" : "0",
              }}
            />
          );
        })}
      </div>

      <button
        onClick={onClose}
        aria-label="Close"
        className="icon-btn absolute top-4 right-4 text-grit-dim z-10 p-2"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <X size={24} />
      </button>

      <div
        className="relative text-center"
        style={{ animation: "pr-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ring */}
        <div
          className="mx-auto mb-5 flex items-center justify-center"
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "rgba(230,50,34,0.15)",
            border: "2px solid rgba(230,50,34,0.4)",
            boxShadow: "0 0 40px rgba(230,50,34,0.5), 0 0 80px rgba(230,50,34,0.2)",
            animation: "pr-pulse 1s ease-in-out infinite alternate",
          }}
        >
          <Trophy size={44} strokeWidth={2} style={{ color: "#e63222" }} />
        </div>

        <p
          className="label-cap text-sm tracking-[0.5em] mb-3"
          style={{ color: "#e63222", animation: "pr-flash 0.6s ease-in-out 4" }}
        >
          NEW PERSONAL RECORD
        </p>

        <h1 className="display text-4xl font-extrabold uppercase text-white leading-tight mb-6 px-2">
          {exerciseName}
        </h1>

        <div className="mb-2">
          <span
            className="display font-extrabold leading-none text-white"
            style={{ fontSize: "clamp(64px,18vw,96px)" }}
          >
            {weight}
          </span>
          <span className="text-2xl text-grit-dim ml-2">kg</span>
        </div>
        <p className="label-cap text-grit-dim mb-6">
          × {reps} {reps === 1 ? "REP" : "REPS"}
        </p>

        {delta > 0 && (
          <div
            className="inline-flex items-center gap-2 px-5 py-2.5 mb-2"
            style={{
              background: "rgba(245,197,66,0.15)",
              border: "1px solid rgba(245,197,66,0.4)",
            }}
          >
            <span className="display text-2xl font-extrabold" style={{ color: "#f5c542" }}>
              +{delta}kg
            </span>
            <span className="label-cap text-xs" style={{ color: "#f5c542" }}>
              OVER YOUR LAST PR
            </span>
          </div>
        )}
        {delta === 0 && prevBest === 0 && (
          <p className="label-cap text-xs text-grit-dim">FIRST TIME LOGGED</p>
        )}
      </div>

      <style>{`
        @keyframes pr-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(115vh) rotate(900deg); opacity: 0; }
        }
        @keyframes pr-pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pr-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.15; }
        }
        @keyframes pr-pulse {
          from { box-shadow: 0 0 30px rgba(230,50,34,0.4), 0 0 60px rgba(230,50,34,0.15); }
          to   { box-shadow: 0 0 50px rgba(230,50,34,0.7), 0 0 100px rgba(230,50,34,0.3); }
        }
      `}</style>
    </div>
  );
}
