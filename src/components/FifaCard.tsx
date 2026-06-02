import type { FifaStats, PublicStats } from "@/lib/fifa-stats";

/**
 * FIFA-style athlete card.
 * Used on the user's own profile and on /athlete/$id pages.
 */
export function FifaCard({
  name,
  username,
  avatarUrl,
  badge,
  badgeColor: badgeC,
  stats,
  weightKg,
  heightCm,
  goal,
  experience,
  compact,
}: {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  badge: string;
  badgeColor: string;
  stats: FifaStats | PublicStats;
  weightKg?: number;
  heightCm?: number;
  goal?: string;
  experience?: string;
  compact?: boolean;
}) {
  const overall = stats.overall;
  return (
    <div
      className={"relative border-2 overflow-hidden " + (compact ? "p-3" : "p-5")}
      style={{
        borderColor: badgeC,
        background:
          "linear-gradient(135deg, #0d0d0d 0%, #1a0a08 45%, #2a0d0a 100%)",
        boxShadow: `0 0 24px -8px ${badgeC}`,
      }}
    >
      {/* Header row: overall + badge + avatar */}
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
          <span
            className="display font-extrabold leading-none"
            style={{ fontSize: compact ? "2.5rem" : "3.5rem", color: badgeC }}
          >
            {overall || "—"}
          </span>
          <span className="label-cap text-[10px] mt-1" style={{ color: badgeC }}>
            {badge}
          </span>
        </div>
        <div
          className="rounded-full border-2 overflow-hidden bg-[#1a1a1a] flex items-center justify-center shrink-0"
          style={{
            borderColor: badgeC,
            width: compact ? 56 : 72,
            height: compact ? 56 : 72,
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="display text-2xl font-extrabold text-grit">
              {(name || "A")[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="display font-extrabold text-grit text-lg leading-none truncate uppercase">
            {name || "Athlete"}
          </p>
          {username && (
            <p className="text-[11px] text-grit-dim truncate">@{username}</p>
          )}
          <div className="text-[10px] text-grit-dim mt-1 flex gap-2 flex-wrap label-cap">
            {goal && <span>{goal}</span>}
            {experience && <span>· {experience}</span>}
            {weightKg && <span>· {weightKg}kg</span>}
            {heightCm && <span>· {heightCm}cm</span>}
          </div>
        </div>
      </div>

      {/* Stat grid — FIFA-style 6 stats */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <Stat label="STR" value={stats.STR} color={badgeC} />
        <Stat label="PWR" value={stats.PWR} color={badgeC} />
        <Stat label="END" value={stats.END} color={badgeC} />
        <Stat label="HYP" value={stats.HYP} color={badgeC} />
        <Stat label="CON" value={stats.CON} color={badgeC} />
        <Stat label="DIE" value={stats.DIE} color={badgeC} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-2 border border-[#262626] bg-black/40 px-2 py-1.5">
      <span
        className="display font-extrabold tabular-nums leading-none text-xl"
        style={{ color: value >= 80 ? color : value >= 60 ? "#fbbf24" : value >= 40 ? "#cbd5e1" : "#6b7280" }}
      >
        {value || "—"}
      </span>
      <span className="label-cap text-[9px] text-grit-dim">{label}</span>
    </div>
  );
}
