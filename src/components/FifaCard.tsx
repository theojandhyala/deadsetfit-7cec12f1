import type { HeadlinePR } from "@/lib/fifa-stats";

/**
 * FIFA-style athlete card.
 * Used on the user's own profile and on /athlete/$id pages.
 * The 6 stat tiles show the athlete's headline PRs (Bench, Squat, etc.).
 */
export function FifaCard({
  name,
  username,
  avatarUrl,
  badge,
  badgeColor: badgeC,
  overall,
  prs,
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
  overall: number;
  prs: HeadlinePR[];
  weightKg?: number;
  heightCm?: number;
  goal?: string;
  experience?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={"relative border-2 overflow-hidden " + (compact ? "p-3" : "p-5")}
      style={{
        borderColor: badgeC,
        background: "linear-gradient(135deg, #0d0d0d 0%, #1a0a08 45%, #2a0d0a 100%)",
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
          {username && <p className="text-[11px] text-grit-dim truncate">@{username}</p>}
          <div className="text-[10px] text-grit-dim mt-1 flex gap-2 flex-wrap label-cap">
            {goal && <span>{goal}</span>}
            {experience && <span>· {experience}</span>}
            {weightKg && <span>· {weightKg}kg</span>}
            {heightCm && <span>· {heightCm}cm</span>}
          </div>
        </div>
      </div>

      {/* PR grid — 6 headline lifts */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {prs.map((pr) => (
          <PRTile key={pr.id} label={pr.label} value={pr.value} unit={pr.unit} color={badgeC} />
        ))}
      </div>
    </div>
  );
}

function PRTile({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  const hasValue = value > 0;
  return (
    <div className="border border-[#262626] bg-black/40 px-2 py-2">
      <p className="label-cap text-[9px] text-grit-dim leading-none">{label}</p>
      <p
        className="display font-extrabold tabular-nums leading-none mt-1.5"
        style={{ color: hasValue ? color : "#4a4a4a", fontSize: "1.25rem" }}
      >
        {hasValue ? value : "—"}
        {hasValue && <span className="text-[9px] ml-0.5 text-grit-dim font-normal">{unit}</span>}
      </p>
    </div>
  );
}
