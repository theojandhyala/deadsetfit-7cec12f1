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
  const iconSize = { sm: "1.4rem", md: "2rem", lg: "2.8rem", xl: "4rem" }[size];
  const labelSize = { sm: "0.55rem", md: "0.65rem", lg: "0.75rem", xl: "1rem" }[size];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Hexagon-style emblem */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{
          width: dim,
          height: dim,
          background: `linear-gradient(135deg, ${rank.gradient[0]}, ${rank.gradient[1]})`,
          borderRadius: size === "xl" ? 20 : 12,
          border: `2px solid ${rank.color}`,
          boxShadow: `0 0 ${size === "xl" ? 32 : 16}px ${rank.glowColor}60, inset 0 1px 0 ${rank.color}40`,
        }}
      >
        <span style={{ fontSize: iconSize, lineHeight: 1 }}>{rank.icon}</span>

        {/* Division badge */}
        {rank.division && (
          <div
            className="absolute bottom-0 right-0 translate-x-1 translate-y-1 flex items-center justify-center font-black"
            style={{
              width: dim * 0.35,
              height: dim * 0.35,
              borderRadius: 100,
              background: rank.color,
              color: "#000",
              fontSize: dim * 0.14,
              boxShadow: `0 2px 8px ${rank.glowColor}80`,
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
