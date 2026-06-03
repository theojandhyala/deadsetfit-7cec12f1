import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, UserPlus, UserCheck, Trophy, Flag, Ban } from "lucide-react";
import { toast } from "sonner";
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
  const _get = useServerFn(getAthleteCard);
  const _toggle = useServerFn(toggleFollow);
  const _block = useServerFn(blockUser);
  const _unblock = useServerFn(unblockUser);
  const _isBlocked = useServerFn(isBlocked);
  const _report = useServerFn(reportContent);
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    _get({ data: { userId: id } })
      .then(setCard)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed");
        navigate({ to: "/squad" });
      });
    _isBlocked({ data: { userId: id } }).then((r) => setBlocked(r.blocked)).catch(() => {});
  }, [id]);


  async function follow() {
    if (!card || card.isMe) return;
    setBusy(true);
    const next = !card.following;
    setCard({ ...card, following: next, followerCount: card.followerCount + (next ? 1 : -1) });
    try { await _toggle({ data: { userId: id } }); }
    catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setCard({ ...card, following: !next, followerCount: card.followerCount });
    } finally { setBusy(false); }
  }

  if (!card) return <div className="flex items-center justify-center pt-20"><Loader2 className="animate-spin text-accent-red" /></div>;

  const stats = (card.public_stats as Record<string, unknown>) || {};
  const overall = Number(stats.overall) || 0;
  const topPRs = (stats.topPRs as Array<{ id: string; label: string; value: number; unit: string }>) || [];
  // Fallback to empty 6-tile shape if profile hasn't pushed stats yet.
  const HEADLINE_FALLBACK = [
    { id: "bench-press", label: "BENCH", unit: "kg" },
    { id: "squat",       label: "SQUAT", unit: "kg" },
    { id: "deadlift",    label: "DEAD",  unit: "kg" },
    { id: "ohp",         label: "OHP",   unit: "kg" },
    { id: "pull-ups",    label: "PULL",  unit: "reps" },
    { id: "push-ups",    label: "PUSH",  unit: "reps" },
  ];
  const prs = HEADLINE_FALLBACK.map((h) => {
    const found = topPRs.find((p) => p.id === h.id);
    return { id: h.id, label: h.label, unit: h.unit, value: found?.value ?? 0 };
  });
  const badge = gritBadge(overall * 10);
  const badgeC = badgeColor(badge);

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="pb-10">
      <header className="px-5 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/squad" })} aria-label="Back" className="p-1.5 -ml-1.5">
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
            className={card.following ? "btn-ghost w-full py-3 flex items-center justify-center gap-2" : "btn-grit w-full py-3 flex items-center justify-center gap-2"}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> :
              card.following ? <><UserCheck size={14} /> FOLLOWING</> : <><UserPlus size={14} /> FOLLOW</>}
          </button>
        </section>
      )}

      {/* Headline PRs */}
      <section className="px-5 mb-5">
        <p className="label-cap mb-2 flex items-center gap-2"><Trophy size={12} className="text-accent-red" /> Personal Records</p>
        {topPRs.length === 0 ? (
          <div className="bg-grit-card border border-grit p-5 text-center text-sm text-grit-dim">
            No PRs shared yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {topPRs.map((pr) => (
              <div key={pr.id} className="bg-grit-card border border-grit p-3">
                <p className="label-cap text-[9px] truncate">{pr.label}</p>
                <p className="display text-2xl font-extrabold text-grit leading-none mt-1">
                  {pr.value}<span className="text-xs ml-1 text-grit-dim">{pr.unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {card.bio && (
        <section className="px-5">
          <div className="bg-grit-card border border-grit p-4 text-sm text-grit">{card.bio}</div>
        </section>
      )}

      <div className="px-5 mt-6">
        <Link to="/squad" className="block text-center label-cap text-grit-dim">← Back to Squad</Link>
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
