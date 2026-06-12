import { Link } from "@tanstack/react-router";
import { useAppState } from "@/lib/storage";
import { calculateGritScore, gritBadge, badgeColor } from "@/lib/calc";
import { Bell, Settings } from "lucide-react";

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

  const size = 36;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  const initial = (state.profile.username || "U").slice(0, 1).toUpperCase();
  const avatar = state.profile.avatarDataUrl;
  const displayName = state.profile.username || "Athlete";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
      style={{
        background: "rgba(17,18,21,0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #262626",
        paddingTop: "calc(env(safe-area-inset-top) + 8px)",
        paddingBottom: "10px",
        height: "calc(env(safe-area-inset-top) + 56px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span
          className="display font-extrabold text-xl tracking-widest"
          style={{ fontStyle: "italic", letterSpacing: "0.12em" }}
        >
          <span style={{ color: "#ffffff" }}>DEAD</span>
          <span style={{ color: "#E10600" }}>SET</span>
        </span>
      </div>

      {/* Right: score + avatar */}
      <div className="flex items-center gap-3">
        {/* XP pill */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: "#141414", border: "1px solid #262626" }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color }}
          >
            {badge}
          </span>
          <span
            className="text-[10px] font-bold"
            style={{ color: "#8A8A8A" }}
          >
            {score}
          </span>
        </div>

        {/* Avatar with progress ring */}
        <Link to="/profile" aria-label={`Profile · ${score} XP`}>
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
              className="absolute flex items-center justify-center overflow-hidden"
              style={{
                inset: stroke + 2,
                borderRadius: "50%",
                background: "#141414",
              }}
            >
              {avatar ? (
                <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="display font-extrabold text-white" style={{ fontSize: 13 }}>
                  {initial}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
