import type { HeadlinePR } from "@/lib/fifa-stats";
import { RankEmblem } from "@/components/RankEmblem";
import { getRank } from "@/lib/rank";
import { ProBadge } from "@/components/ProBadge";

const PRO_GOLD = "#f4c33a";

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
  gritPoints,
  prs,
  weightKg,
  heightCm,
  goal,
  experience,
  compact,
  isPro = false,
}: {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  badge: string;
  badgeColor: string;
  overall: number;
  gritPoints?: number;
  prs: HeadlinePR[];
  weightKg?: number;
  heightCm?: number;
  goal?: string;
  experience?: string;
  compact?: boolean;
  /** When true, the card wears the gold DEADSET Pro treatment. */
  isPro?: boolean;
}) {
  const rank = getRank(gritPoints ?? overall ?? 0);
  const edge = isPro ? PRO_GOLD : badgeC;
  return (
    <div
      className={
        "relative overflow-hidden border " + (compact ? "rounded-2xl p-3" : "rounded-[22px] p-4")
      }
      style={{
        borderColor: isPro ? `${PRO_GOLD}99` : `${badgeC}66`,
        background: isPro
          ? "radial-gradient(circle at 90% 0%, rgba(244,195,58,0.22), transparent 40%), linear-gradient(145deg, rgba(26,23,14,.98), rgba(12,10,6,.98) 62%, rgba(0,0,0,.98))"
          : "radial-gradient(circle at 90% 0%, rgba(230,50,34,0.18), transparent 36%), linear-gradient(145deg, rgba(22,23,27,.98), rgba(9,9,10,.98) 62%, rgba(0,0,0,.98))",
        boxShadow: isPro
          ? `0 18px 48px rgba(0,0,0,.34), 0 0 30px rgba(234,178,18,.20), inset 0 1px 0 rgba(255,255,255,.08)`
          : `0 18px 48px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.06)`,
      }}
    >
      {isPro && (
        <div className="absolute top-3 right-3 z-10">
          <ProBadge size={compact ? "sm" : "md"} />
        </div>
      )}
      {/* Header row: rank + badge + avatar */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center" style={{ minWidth: compact ? 48 : 56 }}>
          <RankEmblem gritPoints={gritPoints ?? overall ?? 0} size="sm" showLabel={false} />
          <span
            className="label-cap text-[8px] mt-1.5 text-center leading-tight"
            style={{ color: rank.color }}
          >
            {rank.label}
          </span>
        </div>
        <div
          className="rounded-full border overflow-hidden bg-[#1a1a1a] flex items-center justify-center shrink-0"
          style={{
            borderColor: `${edge}99`,
            width: compact ? 52 : 62,
            height: compact ? 52 : 62,
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="display text-xl font-extrabold text-grit">
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
            <span>{overall || "—"} OVR</span>
            <span>· {badge}</span>
            {goal && <span>{goal}</span>}
            {experience && <span>· {experience}</span>}
            {weightKg && <span>· {weightKg}kg</span>}
            {heightCm && <span>· {heightCm}cm</span>}
          </div>
        </div>
      </div>

      {/* PR grid — 6 headline lifts */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {prs.map((pr) => (
          <PRTile
            key={pr.id}
            label={pr.label}
            value={pr.value}
            unit={pr.unit}
            estimated={pr.estimated}
            color={badgeC}
          />
        ))}
      </div>
    </div>
  );
}

function PRTile({
  label,
  value,
  unit,
  estimated,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  estimated?: boolean;
  color: string;
}) {
  const hasValue = value > 0;
  // "≈" is the whole fix: the number stays a comparable 1RM (which is what the
  // leaderboard ranks on) but no longer silently contradicts the PR list, where
  // the same lift reads as the raw weight x reps that was actually performed.
  const isEstimate = hasValue && estimated === true;
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-2 py-2">
      <p className="label-cap text-[9px] text-grit-dim leading-none">{label}</p>
      <p
        className="display font-extrabold tabular-nums leading-none mt-1.5"
        style={{ color: hasValue ? color : "#4a4a4a", fontSize: "1.25rem" }}
      >
        {isEstimate && (
          <span
            className="text-[11px] mr-0.5 text-grit-dim font-normal"
            title="Estimated 1RM from your best multi-rep set"
          >
            ≈
          </span>
        )}
        {hasValue ? value : "—"}
        {hasValue && <span className="text-[9px] ml-0.5 text-grit-dim font-normal">{unit}</span>}
      </p>
    </div>
  );
}
