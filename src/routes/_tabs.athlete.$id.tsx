import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ArrowLeft,
  Loader2,
  UserPlus,
  UserCheck,
  Trophy,
  Flag,
  Ban,
  Swords,
  MapPin,
  Dumbbell,
  Flame,
  Layers3,
} from "lucide-react";
import { toast } from "sonner";
import { askConfirm, askText } from "@/lib/confirm";
import { getAthleteCard, setAthleteFollow } from "@/lib/social.functions";
import { ProfileConnections } from "@/components/ProfileConnections";
import { followLabel } from "@/lib/social-connections";
import { blockUser, unblockUser, isBlocked, reportContent } from "@/lib/account.functions";
import { FifaCard } from "@/components/FifaCard";
import { RARITY_COLOR, type AchievementRarity } from "@/lib/achievements";
import { gritBadge, badgeColor } from "@/lib/calc";
import { hapticFailure, hapticPlanUpdated, hapticSelection } from "@/lib/haptics";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { GRADED_MUSCLES, TIER_COLOR, type StrengthTier } from "@/lib/strength-grades";

export const Route = createFileRoute("/_tabs/athlete/$id")({
  head: () => ({ meta: [{ title: "DEADSET — Athlete" }] }),
  component: AthleteRoute,
});

type Card = Awaited<ReturnType<typeof getAthleteCard>>;

function AthleteRoute() {
  const { id } = Route.useParams();
  return <AthletePage key={id} id={id} />;
}

function AthletePage({ id }: { id: string }) {
  const navigate = useNavigate();
  const _get = getAthleteCard;
  const _block = blockUser;
  const _unblock = unblockUser;
  const _report = reportContent;
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const request = useRef(0);
  const mounted = useRef(true);

  const loadAthlete = useCallback(async () => {
    if (!mounted.current) return;
    const version = ++request.current;
    try {
      const block = await isBlocked({ data: { userId: id } });
      if (version !== request.current) return;
      setBlocked(block.blocked);
      if (block.blocked) {
        setCard(null);
        return;
      }
      const next = await _get({ data: { userId: id } });
      if (version === request.current) setCard(next);
    } catch (e) {
      if (version === request.current) {
        toast.error(e instanceof Error ? e.message : "Failed");
        void navigate({ to: "/friends" });
      }
    }
  }, [_get, id, navigate]);

  useEffect(() => {
    mounted.current = true;
    setCard(null);
    setBlocked(false);
    void loadAthlete();
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, [loadAthlete]);

  async function follow() {
    if (!card || card.isMe || busy || blocked) return;
    if (card.following) {
      const confirmed = await askConfirm({
        title: `Unfollow ${card.display_name || card.username || "this athlete"}?`,
        message:
          "Their posts leave your following feed. If you're mutual friends, progress comparison will also close. Their follow is unchanged.",
        confirmLabel: "Unfollow",
      });
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      const result = await setAthleteFollow({ userId: id, following: !card.following });
      hapticPlanUpdated();
      toast.success(
        result.following
          ? card.followsMe
            ? "Following each other — you're friends"
            : "Following athlete"
          : "Unfollowed",
      );
      await loadAthlete();
    } catch (e) {
      hapticFailure();
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!card || card.isMe || busy) return;
    const next = !blocked;
    const verb = next ? "Block" : "Unblock";
    if (next) {
      const ok = await askConfirm({
        title: `${verb} ${card.username || "this athlete"}?`,
        message: "They won't appear in your feed or search.",
        confirmLabel: verb,
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    setBlocked(next);
    try {
      if (next) await _block({ data: { userId: id } });
      else await _unblock({ data: { userId: id } });
      toast.success(next ? "Blocked" : "Unblocked");
      if (next) {
        request.current += 1;
        setCard(null);
      }
    } catch (e) {
      setBlocked(!next);
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    if (!card || card.isMe) return;
    const reason = await askText({
      title: "Report this athlete",
      message: "Briefly describe the issue — harassment, spam, fake account, etc.",
      placeholder: "What happened?",
      confirmLabel: "Report",
    });
    if (!reason || !reason.trim()) return;
    try {
      await _report({ data: { userId: id, reason: reason.trim().slice(0, 500) } });
      toast.success("Report submitted — we review within 24 hours");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send report");
    }
  }

  if (blocked)
    return (
      <section className="m-5 rounded-2xl border border-white/10 bg-grit-card p-5 text-grit">
        <h1 className="display text-2xl font-black uppercase">Athlete blocked</h1>
        <p className="mt-2 text-sm text-grit-dim">
          Their profile is hidden. Unblocking does not restore follows or friendships.
        </p>
        <button
          type="button"
          disabled={busy}
          className="btn-ghost mt-4 min-h-11 w-full"
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await _unblock({ data: { userId: id } });
              await loadAthlete();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't unblock");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Unblocking…" : "Unblock athlete"}
        </button>
        <Link to="/friends" className="mt-3 block py-3 text-center text-xs text-grit-dim">
          Back to community
        </Link>
      </section>
    );

  if (!card)
    return (
      <div className="flex items-center justify-center pt-20">
        <Loader2 className="animate-spin text-accent-red" />
      </div>
    );

  const stats = (card.public_stats as Record<string, unknown>) || {};
  const overall = Number(stats.overall) || 0;
  const topPRs =
    (stats.topPRs as Array<{ id: string; label: string; value: number; unit: string }>) || [];
  // Fallback to empty 6-tile shape if profile hasn't pushed stats yet.
  const HEADLINE_FALLBACK = [
    { id: "bench-press", label: "BENCH", unit: "kg" },
    { id: "squat", label: "SQUAT", unit: "kg" },
    { id: "deadlift", label: "DEAD", unit: "kg" },
    { id: "ohp", label: "OHP", unit: "kg" },
    { id: "pull-ups", label: "PULL", unit: "reps" },
    { id: "push-ups", label: "PUSH", unit: "reps" },
  ];
  const prs = HEADLINE_FALLBACK.map((h) => {
    const found = topPRs.find((p) => p.id === h.id);
    return { id: h.id, label: h.label, unit: h.unit, value: found?.value ?? 0 };
  });
  const badgeWall =
    (stats.badges as {
      earned?: number;
      total?: number;
      top?: { id: string; label: string; icon: string; rarity: string }[];
    } | null) || null;
  const badge = gritBadge(Number(card.grit_points ?? 0));
  const badgeC = badgeColor(badge);
  const friends = Boolean(card.following && card.followsMe);
  const theirStrengthMap = publicStrengthMap(stats.strengthMap);
  const myStrengthMap = publicStrengthMap(
    (card.my_public_stats as Record<string, unknown> | null)?.strengthMap,
  );
  const totalWorkouts = Number(stats.totalWorkouts) || 0;
  const totalWorkingSets = Number(stats.totalWorkingSets) || 0;
  const totalPRs = Number(stats.totalPRs) || 0;
  const publicStreak = Number(stats.streak) || 0;
  const location = [card.city, card.country].filter(Boolean).join(", ");

  return (
    <div className="pb-10">
      <header className="px-5 pt-4 pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/friends" })}
          aria-label="Back"
          className="icon-btn -ml-1.5"
        >
          <ArrowLeft size={20} className="text-grit" />
        </button>
        <p className="label-cap">ATHLETE</p>
      </header>

      <section className="px-5 mb-4">
        <FifaCard
          name={card.display_name || card.username || "Athlete"}
          username={card.username}
          avatarUrl={card.avatar_url}
          badge={badge}
          badgeColor={badgeC}
          overall={overall}
          gritPoints={card.grit_points ?? overall}
          prs={prs}
          weightKg={Number(stats.weightKg) || undefined}
          heightCm={Number(stats.heightCm) || undefined}
          goal={String(stats.goal || "")}
          experience={String(stats.experience || "")}
        />
      </section>

      <section className="px-5 mb-5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_90%_0%,rgba(230,50,34,0.17),transparent_38%),linear-gradient(145deg,#17181c,#0b0b0d)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="display text-xl font-black uppercase text-grit">
              {card.display_name || card.username || "Athlete"}
            </p>
            <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[8px] font-black uppercase text-grit-dim">
              {card.level}
            </span>
          </div>
          {card.username && (
            <p className="mt-0.5 text-xs font-bold text-accent-red">@{card.username}</p>
          )}
          {location && (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-grit-dim">
              <MapPin size={11} className="text-accent-red" /> {location}
            </p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-grit">
            {card.bio || "This athlete has not added a bio yet."}
          </p>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {[
              { Icon: Dumbbell, value: totalWorkouts, label: "Workouts" },
              { Icon: Layers3, value: totalWorkingSets, label: "Sets" },
              { Icon: Flame, value: publicStreak, label: "Streak" },
              { Icon: Trophy, value: totalPRs, label: "PRs" },
            ].map(({ Icon, value, label }) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-black/25 p-2 text-center"
              >
                <Icon size={12} className="mx-auto text-accent-red" />
                <p className="display mt-1 text-lg font-black leading-none text-grit">{value}</p>
                <p className="mt-1 text-[6px] font-black uppercase tracking-wide text-grit-dim">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="px-5 mb-5">
        <ProfileConnections
          key={id}
          userId={id}
          counts={{ followers: card.followerCount, following: card.followingCount }}
          onChange={() => void loadAthlete()}
        />
      </div>

      {badgeWall?.top?.length ? (
        <section className="px-5 mb-5">
          <div className="deadset-section-title mb-2">
            <h2 className="display text-lg font-extrabold uppercase leading-none text-grit">
              Badges
            </h2>
            <span className="label-cap text-[10px] text-grit-dim">
              {badgeWall.earned ?? 0}/{badgeWall.total ?? 0}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {badgeWall.top.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-1.5 border px-2 py-1.5"
                style={{ borderColor: RARITY_COLOR[b.rarity as AchievementRarity] ?? "#262626" }}
                title={b.label}
              >
                <span className="text-base">{b.icon}</span>
                <span className="label-cap text-[9px] text-grit">{b.label}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Follow + counts */}
      {!card.isMe && (
        <section className="px-5 mb-5">
          {(card as { followsMe?: boolean }).followsMe && (
            <div className="mb-2 inline-flex items-center gap-1 label-cap text-[10px] text-grit-dim border border-grit rounded px-2 py-0.5">
              Follows you
            </div>
          )}
          <button
            onClick={() => {
              hapticSelection();
              void follow();
            }}
            disabled={busy}
            className={
              card.following
                ? "btn-ghost w-full py-3 flex items-center justify-center gap-2"
                : "btn-grit w-full py-3 flex items-center justify-center gap-2"
            }
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : friends ? (
              <>
                <UserCheck size={14} /> FRIENDS · FOLLOWING
              </>
            ) : card.followsMe ? (
              <>
                <UserPlus size={14} /> {followLabel(false, true)}
              </>
            ) : card.following ? (
              <>
                <UserCheck size={14} /> Following
              </>
            ) : (
              <>
                <UserPlus size={14} /> Follow athlete
              </>
            )}
          </button>
          {friends && (
            <Link
              to="/challenges"
              className="btn-grit mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-[10px]"
            >
              <Swords size={14} /> Challenge this friend
            </Link>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={report}
              className="flex-1 py-2.5 text-xs label-cap inline-flex items-center justify-center gap-1.5 border border-grit text-grit-dim hover:text-grit transition-colors"
            >
              <Flag size={12} /> Report
            </button>
            <button
              onClick={toggleBlock}
              disabled={busy}
              className={`flex-1 py-2.5 text-xs label-cap inline-flex items-center justify-center gap-1.5 border transition-colors ${
                blocked
                  ? "border-accent-red text-accent-red"
                  : "border-grit text-grit-dim hover:text-grit"
              }`}
            >
              <Ban size={12} /> {blocked ? "Unblock" : "Block"}
            </button>
          </div>
        </section>
      )}

      {/* Head-to-head summary vs you */}
      {!card.isMe && (
        <VersusPanel
          myOverall={Number((card.my_public_stats as Record<string, unknown> | null)?.overall) || 0}
          themOverall={overall}
          myGrit={Number(card.my_grit_points ?? 0)}
          themGrit={Number(card.grit_points ?? 0)}
          mine={
            ((card.my_public_stats as Record<string, unknown> | null)?.topPRs as Array<{
              id: string;
              value: number;
            }>) || []
          }
          them={topPRs}
          themName={card.username || card.display_name || "them"}
        />
      )}

      {!card.isMe && (
        <MuscleHeadToHead
          mine={myStrengthMap}
          theirs={theirStrengthMap}
          themName={card.username || card.display_name || "them"}
          unlocked={friends}
          onAddFriend={() => void follow()}
        />
      )}

      {/* Headline PRs + head-to-head vs you */}
      <section className="px-5 mb-5">
        <p className="label-cap mb-2 flex items-center gap-2">
          <Trophy size={12} className="text-accent-red" /> Personal Records
        </p>
        {topPRs.length === 0 ? (
          <div className="bg-grit-card border border-grit p-5 text-center text-sm text-grit-dim">
            No PRs shared yet.
          </div>
        ) : card.isMe ? (
          <div className="grid grid-cols-2 gap-2">
            {topPRs.map((pr) => (
              <div key={pr.id} className="bg-grit-card border border-grit p-3">
                <p className="label-cap text-[9px] truncate">{pr.label}</p>
                <p className="display text-2xl font-extrabold text-grit leading-none mt-1">
                  {pr.value > 0 ? (
                    <>
                      {pr.value}
                      <span className="text-xs ml-1 text-grit-dim">{pr.unit}</span>
                    </>
                  ) : (
                    <span className="text-grit-dim">—</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <PRHeadToHead
            them={topPRs}
            mine={
              ((card.my_public_stats as Record<string, unknown> | null)?.topPRs as Array<{
                id: string;
                label: string;
                value: number;
                unit: string;
              }>) || []
            }
            themName={card.username || card.display_name || "them"}
          />
        )}
      </section>

      <div className="px-5 mt-6">
        <Link to="/friends" className="block text-center label-cap text-grit-dim">
          ← Back to Friends
        </Link>
      </div>
    </div>
  );
}

type PublicStrengthMap = {
  score: number;
  tier: StrengthTier;
  muscles: Array<{ muscle: string; score: number; tier: StrengthTier }>;
};

function publicStrengthMap(value: unknown): PublicStrengthMap | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PublicStrengthMap>;
  if (!Array.isArray(candidate.muscles)) return null;
  return {
    score: Number(candidate.score) || 0,
    tier: candidate.tier ?? "BEGINNER",
    muscles: candidate.muscles.filter(
      (muscle): muscle is { muscle: string; score: number; tier: StrengthTier } =>
        Boolean(muscle) &&
        typeof muscle.muscle === "string" &&
        Number.isFinite(Number(muscle.score)) &&
        typeof muscle.tier === "string" &&
        muscle.tier in TIER_COLOR,
    ),
  };
}

function MuscleHeadToHead({
  mine,
  theirs,
  themName,
  unlocked,
  onAddFriend,
}: {
  mine: PublicStrengthMap | null;
  theirs: PublicStrengthMap | null;
  themName: string;
  unlocked: boolean;
  onAddFriend: () => void;
}) {
  if (!unlocked) {
    return (
      <section className="px-5 mb-5">
        <div className="overflow-hidden rounded-2xl border border-accent-red/35 bg-[linear-gradient(135deg,rgba(230,50,34,.14),#121212)] p-4">
          <p className="label-cap text-[9px] text-accent-red">FRIENDS-ONLY COMPARISON</p>
          <h2 className="display mt-1 text-xl font-black uppercase text-grit">
            Compare muscle maps
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-grit-dim">
            Add each other to compare bodyweight-adjusted muscle scores, PRs and the areas each of
            you can improve next.
          </p>
          <button onClick={onAddFriend} className="btn-grit mt-3 min-h-11 w-full">
            Add @{themName}
          </button>
        </div>
      </section>
    );
  }

  const mineByMuscle = new Map(mine?.muscles.map((muscle) => [muscle.muscle, muscle]));
  const theirsByMuscle = new Map(theirs?.muscles.map((muscle) => [muscle.muscle, muscle]));
  const myColors = Object.fromEntries(
    (mine?.muscles ?? []).map((muscle) => [muscle.muscle, TIER_COLOR[muscle.tier]]),
  );
  const theirColors = Object.fromEntries(
    (theirs?.muscles ?? []).map((muscle) => [muscle.muscle, TIER_COLOR[muscle.tier]]),
  );

  return (
    <section className="px-5 mb-5">
      <p className="label-cap mb-2 flex items-center gap-2">
        <Swords size={12} className="text-accent-red" /> Muscle Map Versus
      </p>
      <div className="overflow-hidden rounded-2xl border border-grit bg-grit-card">
        <div className="grid grid-cols-2 border-b border-grit bg-[#17181b] px-2 py-3 text-center">
          <div>
            <p className="label-cap text-[8px] text-grit-dim">YOU</p>
            <p className="display text-xl font-black text-grit">{mine?.score ?? "—"}</p>
          </div>
          <div>
            <p className="label-cap truncate text-[8px] text-grit-dim">@{themName}</p>
            <p className="display text-xl font-black text-grit">{theirs?.score ?? "—"}</p>
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-3 bg-[#17181b] px-4 pb-3">
          <MuscleDiagram view="both" gradeColors={myColors} size={196} />
          <MuscleDiagram view="both" gradeColors={theirColors} size={196} />
        </div>
        <div className="border-t border-grit px-4 py-2">
          {GRADED_MUSCLES.map((muscle) => {
            const myScore = mineByMuscle.get(muscle)?.score ?? 0;
            const theirScore = theirsByMuscle.get(muscle)?.score ?? 0;
            return (
              <div
                key={muscle}
                className="grid grid-cols-[42px_1fr_42px] items-center gap-2 py-1.5"
              >
                <span
                  className={myScore > theirScore ? "font-black text-emerald-400" : "text-grit-dim"}
                >
                  {myScore || "—"}
                </span>
                <span className="label-cap text-center text-[8px] text-grit-dim">{muscle}</span>
                <span
                  className={`text-right ${theirScore > myScore ? "font-black text-accent-red" : "text-grit-dim"}`}
                >
                  {theirScore || "—"}
                </span>
              </div>
            );
          })}
        </div>
        {(!mine || !theirs) && (
          <p className="border-t border-grit px-4 py-3 text-[9px] leading-relaxed text-grit-dim">
            A map is waiting for its next account sync. Finish or save a workout, then reopen this
            comparison.
          </p>
        )}
      </div>
    </section>
  );
}

function VersusPanel({
  myOverall,
  themOverall,
  myGrit,
  themGrit,
  mine,
  them,
  themName,
}: {
  myOverall: number;
  themOverall: number;
  myGrit: number;
  themGrit: number;
  mine: Array<{ id: string; value: number }>;
  them: Array<{ id: string; value: number }>;
  themName: string;
}) {
  // Tally lift wins across shared PRs.
  let myWins = 0;
  let themWins = 0;
  const myMap = new Map(mine.map((p) => [p.id, p.value]));
  for (const t of them) {
    const m = myMap.get(t.id) ?? 0;
    if (m > t.value) myWins += 1;
    else if (t.value > m) themWins += 1;
  }

  const Row = ({ label, a, b }: { label: string; a: number; b: number }) => {
    const youWin = a > b;
    const themWin = b > a;
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span
          className="display text-lg font-extrabold tabular-nums w-14 text-left"
          style={{ color: youWin ? "#22c55e" : themWin ? "#8a8a8a" : "#f5f5f0" }}
        >
          {a}
        </span>
        <span className="flex-1 text-center label-cap text-[10px] text-grit-dim">{label}</span>
        <span
          className="display text-lg font-extrabold tabular-nums w-14 text-right"
          style={{ color: themWin ? "#e63222" : youWin ? "#8a8a8a" : "#f5f5f0" }}
        >
          {b}
        </span>
      </div>
    );
  };

  const overallLead =
    myWins + (myOverall > themOverall ? 1 : 0) >= themWins + (themOverall > myOverall ? 1 : 0);

  return (
    <section className="px-5 mb-5">
      <p className="label-cap mb-2 flex items-center gap-2">
        <Swords size={12} className="text-accent-red" /> Head-to-Head
      </p>
      <div className="bg-grit-card border border-grit rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="label-cap text-[10px] text-grit">You</span>
          <span
            className="label-cap text-[10px] font-bold"
            style={{ color: overallLead ? "#22c55e" : "#e63222" }}
          >
            {overallLead ? "You lead" : "You trail"}
          </span>
          <span className="label-cap text-[10px] text-grit truncate max-w-[38%] text-right">
            @{themName}
          </span>
        </div>
        <div className="divide-y divide-[#222]">
          <Row label="OVR" a={myOverall} b={themOverall} />
          <Row label="DS PTS" a={myGrit} b={themGrit} />
          <Row label="Lifts won" a={myWins} b={themWins} />
        </div>
      </div>
    </section>
  );
}

type PR = { id: string; label: string; value: number; unit: string };
function PRHeadToHead({ them, mine, themName }: { them: PR[]; mine: PR[]; themName: string }) {
  const mineById = new Map(mine.map((p) => [p.id, p]));
  let myWins = 0;
  let theirWins = 0;
  const rows = them.map((t) => {
    const m = mineById.get(t.id);
    const myV = m?.value ?? 0;
    const theirV = t.value;
    const diff = myV - theirV;
    if (diff > 0) myWins++;
    else if (diff < 0) theirWins++;
    return { ...t, myV, theirV, diff };
  });
  return (
    <div className="bg-grit-card border border-grit p-3">
      <div className="grid grid-cols-3 text-center mb-2 pb-2 border-b border-grit">
        <div>
          <p className="display font-extrabold text-grit text-xl leading-none">{myWins}</p>
          <p className="label-cap text-[9px] text-grit-dim mt-1">YOU</p>
        </div>
        <div>
          <p className="display font-extrabold text-accent-red text-xs leading-none mt-1.5">VS</p>
        </div>
        <div>
          <p className="display font-extrabold text-grit text-xl leading-none">{theirWins}</p>
          <p className="label-cap text-[9px] text-grit-dim mt-1 truncate">
            {themName.toUpperCase()}
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const youWin = r.diff > 0;
          const tie = r.diff === 0;
          return (
            <div key={r.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
              <p className={`text-right font-bold ${youWin ? "text-accent-red" : "text-grit-dim"}`}>
                {r.myV}
                <span className="text-[10px] ml-1 text-grit-dim">{r.unit}</span>
              </p>
              <p className="label-cap text-[9px] text-grit-dim px-1.5">{r.label}</p>
              <p
                className={`text-left font-bold ${!youWin && !tie ? "text-accent-red" : "text-grit-dim"}`}
              >
                {r.theirV}
                <span className="text-[10px] ml-1 text-grit-dim">{r.unit}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
