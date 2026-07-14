import { getRank, rankProgress, pointsToNextTier } from "@/lib/rank";

export function RankEmblem({
  gritPoints,
  size = "md",
  showProgress = false,
  showLabel = true,
}: {
  gritPoints: number;
  size?: "sm" | "md" | "lg" | "xl";
  showProgress?: boolean;
  showLabel?: boolean;
}) {
  const rank = getRank(gritPoints);
  const progress = rankProgress(gritPoints);
  const toNext = pointsToNextTier(gritPoints);

  const dim = { sm: 48, md: 72, lg: 96, xl: 140 }[size];
  const labelSize = { sm: "0.55rem", md: "0.65rem", lg: "0.75rem", xl: "1rem" }[size];
  const stroke = Math.max(2, dim * 0.035);
  const plateInset = dim * 0.14;
  const coreInset = dim * 0.28;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Premium rank plate — original DEADSET ladder art */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{
          width: dim,
          height: dim,
          filter: `drop-shadow(0 14px ${size === "xl" ? 28 : 18}px rgba(0,0,0,.42)) drop-shadow(0 0 ${size === "xl" ? 24 : 14}px ${rank.glowColor}33)`,
        }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
          <defs>
            <linearGradient id={`rank-shell-${rank.tier}-${size}`} x1="12" y1="10" x2="88" y2="92">
              <stop offset="0" stopColor="#f8fafc" stopOpacity=".82" />
              <stop offset=".2" stopColor={rank.color} stopOpacity=".86" />
              <stop offset=".56" stopColor={rank.gradient[0]} />
              <stop offset="1" stopColor="#050505" />
            </linearGradient>
            <linearGradient id={`rank-core-${rank.tier}-${size}`} x1="24" y1="16" x2="78" y2="92">
              <stop offset="0" stopColor={rank.color} stopOpacity=".95" />
              <stop offset=".48" stopColor={rank.gradient[1]} stopOpacity=".78" />
              <stop offset="1" stopColor={rank.gradient[0]} />
            </linearGradient>
          </defs>
          <path
            d="M50 4 84 20 96 50 78 86 50 98 22 86 4 50 16 20Z"
            fill={`url(#rank-shell-${rank.tier}-${size})`}
            stroke="rgba(255,255,255,.22)"
            strokeWidth={stroke}
          />
          <path
            d="M50 13 76 25 86 51 70 78 50 88 30 78 14 51 24 25Z"
            fill="#08090b"
            stroke={rank.color}
            strokeOpacity=".52"
            strokeWidth="1.6"
          />
          <path
            d="M50 22 68 50 50 78 32 50Z"
            fill={`url(#rank-core-${rank.tier}-${size})`}
            stroke="rgba(255,255,255,.38)"
            strokeWidth="1.2"
          />
          <path d="M50 29 59 50 50 71 41 50Z" fill="rgba(255,255,255,.28)" />
          <path d="M26 51H13M87 51H74" stroke={rank.color} strokeOpacity=".62" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M39 20 50 13 61 20M39 80 50 88 61 80" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>

        <div
          className="absolute rounded-full"
          style={{
            inset: plateInset,
            border: `1px solid ${rank.color}22`,
            boxShadow: `inset 0 0 18px rgba(0,0,0,.65)`,
          }}
        />
        <div
          className="absolute flex items-center justify-center rounded-full bg-black/70"
          style={{
            width: dim - coreInset * 2,
            height: dim - coreInset * 2,
            border: `1px solid ${rank.color}66`,
          }}
        >
          <span
            className="block h-1/2 w-[2px] rounded-full"
            style={{
              background: `linear-gradient(180deg, #fff, ${rank.color})`,
              boxShadow: `0 0 12px ${rank.glowColor}`,
              transform: "skewX(-12deg)",
            }}
          />
        </div>

        {rank.division && (
          <div
            className="absolute left-1/2 -bottom-1 -translate-x-1/2 flex items-center justify-center font-black tracking-widest text-black"
            style={{
              minWidth: dim * 0.32,
              height: dim * 0.18,
              padding: `0 ${dim * 0.05}px`,
              borderRadius: dim,
              background: `linear-gradient(180deg, #ffffff, ${rank.color})`,
              fontSize: dim * 0.14,
              boxShadow: `0 6px 12px rgba(0,0,0,.42), 0 0 10px ${rank.glowColor}55`,
            }}
          >
            {rank.division}
          </div>
        )}
      </div>

      {showLabel && (
        <div className="flex flex-col items-center">
          <span
            className="font-black tracking-widest uppercase"
            style={{ fontSize: labelSize, color: rank.color, letterSpacing: "0.15em" }}
          >
            {rank.label}
          </span>
          {showProgress && rank.tier !== "DEADSET" && (
            <span
              className="font-semibold mt-0.5"
              style={{ fontSize: `calc(${labelSize} * 0.9)`, color: "#6b7280" }}
            >
              {toNext} pts to {rank.nextTier}
            </span>
          )}
        </div>
      )}

      {showProgress && rank.tier !== "DEADSET" && (
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 4, background: "#1f2937", maxWidth: dim * 1.4 }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background: `linear-gradient(90deg, ${rank.gradient[0]}, ${rank.color})`,
              boxShadow: `0 0 6px ${rank.glowColor}`,
            }}
          />
        </div>
      )}
    </div>
  );
}
