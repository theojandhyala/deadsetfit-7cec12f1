import { useEffect } from "react";
import { Trophy, X, Share2 } from "lucide-react";

const PARTICLES = Array.from({ length: 28 });

export function PRCelebration({
  exerciseName,
  weight,
  reps,
  onClose,
  onShare,
}: {
  exerciseName: string;
  weight: number;
  reps: number;
  onClose: () => void;
  onShare?: () => void;
}) {
  useEffect(() => {
    try { navigator.vibrate?.([100, 50, 100, 50, 200]); } catch { /* noop */ }
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-6 overflow-hidden"
      style={{ background: "radial-gradient(circle at center, #2a0d0a 0%, #0a0a0a 70%)" }}
    >
      {/* confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map((_, i) => {
          const left = (i * 37) % 100;
          const delay = (i % 7) * 0.12;
          const size = 6 + (i % 4) * 3;
          const color = ["#e63222", "#f5c542", "#f5f5f0"][i % 3];
          return (
            <span
              key={i}
              className="absolute block animate-[pr-fall_1.6s_ease-in_forwards]"
              style={{
                left: `${left}%`,
                top: `-${size}px`,
                width: size,
                height: size,
                background: color,
                animationDelay: `${delay}s`,
                transform: `rotate(${i * 23}deg)`,
              }}
            />
          );
        })}
      </div>

      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 text-grit-dim z-10"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <X size={24} />
      </button>

      <div className="relative text-center animate-[pr-pop_0.5s_ease-out]">
        <Trophy size={64} className="text-accent-red mx-auto mb-4 drop-shadow-lg" strokeWidth={2.5} />
        <p className="label-cap text-sm tracking-[0.4em] animate-[pr-flash_0.8s_ease-in-out_3]" style={{ color: "#e63222" }}>NEW PR</p>
        <h1 className="display text-5xl sm:text-6xl font-extrabold uppercase text-grit leading-none mt-3">
          {exerciseName}
        </h1>
        <p className="display text-7xl sm:text-8xl font-extrabold text-grit mt-6 leading-none">
          {weight}<span className="text-3xl text-grit-dim ml-2">kg</span>
        </p>
        <p className="label-cap text-grit-dim mt-2">× {reps} REPS</p>

        {onShare && (
          <button
            onClick={onShare}
            className="btn-grit mt-8 inline-flex items-center"
          >
            <Share2 size={16} className="mr-2" /> Share This PR
          </button>
        )}
      </div>

      <style>{`
        @keyframes pr-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pr-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pr-flash {
          0%, 100% { opacity: 1; text-shadow: 0 0 0 transparent; }
          50% { opacity: 0.2; text-shadow: 0 0 20px #e63222; }
        }
      `}</style>
    </div>
  );
}
