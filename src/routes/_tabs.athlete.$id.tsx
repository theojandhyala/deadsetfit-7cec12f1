import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { ArrowLeft, Loader2, UserPlus, UserCheck, Trophy, Flag, Ban } from "lucide-react";
import { toast } from "sonner";
import { askConfirm, askText } from "@/lib/confirm";
import { getAthleteCard, toggleFollow } from "@/lib/social.functions";
import { blockUser, unblockUser, isBlocked, reportContent } from "@/lib/account.functions";
import { FifaCard } from "@/components/FifaCard";
import { gritBadge, badgeColor } from "@/lib/calc";

export const Route = createFileRoute("/_tabs/athlete/$id")({
  head: () => ({ meta: [{ title: "DEADSET — Athlete" }] }),
  component: AthletePage,
});

type Card = Awaited<ReturnType<typeof getAthleteCard>>;

function AthletePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const _get = getAthleteCard;
  const _toggle = toggleFollow;
  const _block = blockUser;
  const _unblock = unblockUser;
  const _isBlocked = isBlocked;
  const _report = reportContent;
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const loadAthlete = useCallback(() => {
    _get({ data: { userId: id } })
      .then(setCard)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed");
        navigate({ to: "/friends" });
      });
    _isBlocked({ data: { userId: id } })
      .then((r) => setBlocked(r.blocked))
      .catch(() => {});
  }, [_get, _isBlocked, id, navigate]);

  useEffect(() => {
    loadAthlete();
  }, [loadAthlete]);

  async function follow() {
    if (!card || card.isMe) return;
    setBusy(true);
    const next = !card.following;
    setCard({ ...card, following: next, followerCount: card.followerCount + (next ? 1 : -1) });
    try {
      await _toggle({ data: { userId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setCard({ ...card, following: !next, followerCount: card.followerCount });
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!card || card.isMe) return;
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
    setBlocked(next);
    try {
      if (next) await _block({ data: { userId: id } });
      else await _unblock({ data: { userId: id } });
      toast.success(next ? "Blocked" : "Unblocked");
      if (next) {
        setCard({ ...card, following: false });
      }
    } catch (e) {
      setBlocked(!next);
      toast.error(e instanceof Error ? e.message : "Failed");
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
  const badge = gritBadge(Number(card.grit_points ?? 0));
  const badgeC = badgeColor(badge);

  return (
    <div className="pb-10">
      <header className="px-5 pt-4 pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/friends" })}
          aria-label="Back"
          className="p-1.5 -ml-1.5"
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

      {/* Follow + counts */}
      {!card.isMe && (
        <section className="px-5 mb-5">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Tile label="Followers" v={card.followerCount} />
            <Tile label="Following" v={card.followingCount} />
            <Tile label="DS PTS" v={card.grit_points ?? 0} />
          </div>
          <button
            onClick={follow}
            disabled={busy}
            className={
              card.following
                ? "btn-ghost w-full py-3 flex items-center justify-center gap-2"
                : "btn-grit w-full py-3 flex items-center justify-center gap-2"
            }
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : card.following ? (
              <>
                <UserCheck size={14} /> FOLLOWING
              </>
            ) : (
              <>
                <UserPlus size={14} /> FOLLOW
              </>
            )}
          </button>
          <div className="flex gap-2 mt-2">
            <button
              onClick={report}
              className="flex-1 py-2.5 text-xs label-cap inline-flex items-center justify-center gap-1.5 border border-grit text-grit-dim hover:text-grit transition-colors"
            >
              <Flag size={12} /> Report
            </button>
            <button
              onClick={toggleBlock}
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
                  {pr.value}
                  <span className="text-xs ml-1 text-grit-dim">{pr.unit}</span>
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

      {card.bio && (
        <section className="px-5">
          <div className="bg-grit-card border border-grit p-4 text-sm text-grit">{card.bio}</div>
        </section>
      )}

      <div className="px-5 mt-6">
        <Link to="/friends" className="block text-center label-cap text-grit-dim">
          ← Back to Friends
        </Link>
      </div>
    </div>
  );
}

function Tile({ label, v }: { label: string; v: number }) {
  return (
    <div className="bg-grit-card border border-grit p-3 text-center">
      <p className="display font-extrabold text-grit text-xl leading-none">{v}</p>
      <p className="label-cap text-[10px] text-grit-dim mt-1">{label}</p>
    </div>
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
