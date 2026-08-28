import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/storage";
import { calculateGritScore, gritBadge, badgeColor } from "@/lib/calc";
import { CircleHelp } from "lucide-react";
import { GritLogo } from "@/components/GritLogo";

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
  const lastScore = useRef<number | null>(null);
  const [scorePop, setScorePop] = useState(false);

  const score = state.profile ? calculateGritScore(state).total : 0;
  const badge = gritBadge(score);
  const color = badgeColor(badge);
  const { pct } = progressToNext(score);

  useEffect(() => {
    if (lastScore.current == null || score <= lastScore.current) {
      lastScore.current = score;
      return;
    }
    lastScore.current = score;
    setScorePop(false);
    const start = requestAnimationFrame(() => setScorePop(true));
    const stop = setTimeout(() => setScorePop(false), 650);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(stop);
    };
  }, [score]);

  if (!state.profile) return null;

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
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-2 px-4"
      style={{
        // No backdrop-filter: fixed bars with backdrop blur intermittently
        // composite as solid BLACK while scrolling in WKWebView/iOS Safari.
        // A near-opaque gradient reads the same without the blur.
        background: "linear-gradient(180deg, rgba(18,19,22,0.995), rgba(8,8,9,0.985))",
        borderBottom: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 16px 38px rgba(0,0,0,0.36), inset 0 -2px 0 rgba(230,50,34,0.18)",
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: "14px",
        height: "calc(env(safe-area-inset-top) + 72px)",
      }}
    >
      {/* Logo */}
      <GritLogo className="w-[104px] shrink-0" />

      {/* Right: score + avatar */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Was an unlabelled grey circle — the app's only always-visible route
            into the guide, and effectively invisible. It now says "Help". */}
        <Link
          to="/guide"
          aria-label="How DEADSET works"
          className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 press"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.11)",
            color: "#c9c9c9",
          }}
        >
          <CircleHelp size={16} />
          <span className="hidden text-[10px] font-bold uppercase tracking-wider min-[400px]:inline">
            Help
          </span>
        </Link>
        {/* XP pill */}
        <div
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 ${scorePop ? "grit-score-pop" : ""}`}
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))",
            border: "1px solid rgba(255,255,255,0.11)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden="true"
          />
          <span
            className="hidden text-[10px] font-bold uppercase tracking-wider min-[400px]:inline"
            style={{ color }}
          >
            {badge}
          </span>
          <span className="text-[11px] font-bold text-white">{score}</span>
          <span className="sr-only">{badge}</span>
        </div>

        {/* Avatar with progress ring */}
        <Link to="/profile" aria-label={`Profile · ${score} XP`} className="tap-44">
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
