import { Link } from "@tanstack/react-router";
import { useAppState } from "@/lib/storage";
import { calculateGritScore, gritBadge, badgeColor } from "@/lib/calc";

const TIERS: { name: string; min: number }[] = [
  { name: "RAW", min: 0 },
  { name: "ROOKIE", min: 100 },
  { name: "GRINDER", min: 250 },
  { name: "BEAST", min: 500 },
  { name: "ELITE", min: 750 },
  { name: "DEADSET GOD", min: 1000 },
];

function progressToNext(score: number) {
  const clamped = Math.max(0, Math.min(1000, score));
  let curr = TIERS[0];
  let next = TIERS[TIERS.length - 1];
  for (let i = 0; i < TIERS.length; i++) {
    if (clamped >= TIERS[i].min) {
      curr = TIERS[i];
      next = TIERS[i + 1] ?? TIERS[i];
    }
  }
  if (curr === next) return { pct: 1, curr, next };
  const pct = (clamped - curr.min) / (next.min - curr.min);
  return { pct: Math.max(0, Math.min(1, pct)), curr, next };
}

export function TopBar() {
  const [state] = useAppState();
  if (!state.profile) return null;

  const score = calculateGritScore(state).total;
  const badge = gritBadge(score);
  const color = badgeColor(badge);
  const { pct } = progressToNext(score);

  // Ring math
  const size = 44;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  const initial = (state.profile.username || "U").slice(0, 1).toUpperCase();
  const avatar = state.profile.avatarDataUrl;

  return (
    <Link
      to="/profile"
      className="fixed z-40 flex items-center gap-2 bg-grit-card/90 backdrop-blur border border-grit pl-2 pr-3 py-1.5 rounded-full hover:border-accent-red transition-colors"
      style={{
        top: "calc(env(safe-area-inset-top) + 10px)",
        right: 12,
      }}
      aria-label={`Profile · ${score} XP · ${badge}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#262626"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 400ms ease" }}
          />
        </svg>
        <div
          className="absolute inset-[5px] rounded-full overflow-hidden bg-grit flex items-center justify-center"
          style={{ borderColor: color }}
        >
          {avatar ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="display font-extrabold text-grit text-sm">{initial}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="display text-[10px] font-extrabold uppercase" style={{ color }}>
          {badge}
        </span>
        <span className="label-cap text-[9px] text-grit-dim">{score} XP</span>
      </div>
    </Link>
  );
}
