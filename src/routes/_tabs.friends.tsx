import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  MessageCircle,
  Trophy,
  Share2,
  Loader2,
  Send,
  Plus,
  Gift,
  Copy,
  Check,
  Crown,
  Users,
  Search,
  UserPlus,
  UserCheck,
  MapPin,
  Swords,
  Dumbbell,
  BookOpen,
  Flame,
  MoreVertical,
  Flag,
  Ban,
  X,
  Building2,
  Lock,
} from "lucide-react";
import { restoreSupabaseSession, supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/account-restore";
import { getInviteUrl } from "@/lib/referral";
import { isNativeIos } from "@/lib/platform";
import { CrewPanel } from "@/components/CrewPanel";
import { NotificationsBell } from "@/components/NotificationsBell";
import { blockUser, reportContent } from "@/lib/account.functions";
import { askConfirm, askText } from "@/lib/confirm";
import {
  getFeed,
  createPost,
  toggleLike,
  addComment,
  getComments,
  getLeaderboard,
  getMyReferralInfo,
  redeemReferral,
  updateMyProfile,
  searchAthletes,
  getSuggestedAthletes,
  getFriendConnections,
  updateFriendship,
  updateMyLocation,
  getMyLocation,
  getNearbyAthletes,
  searchLocalGyms,
  updateMyGym,
  getGymHub,
  type GymAthlete,
  type GymHub,
  type LocalGymOption,
  type FriendAction,
  type FriendConnections,
  type FriendStatus,
  type FeedScope,
} from "@/lib/social.functions";
import { hapticFailure, hapticPlanUpdated, hapticSelection } from "@/lib/haptics";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { RankShareCard } from "@/components/RankShareCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_tabs/friends")({
  validateSearch: (search: Record<string, unknown>): { section?: Tab } => ({
    section: ["FRIENDS", "GYM", "CREW", "FEED", "ARENA", "INVITE"].includes(String(search.section))
      ? (search.section as Tab)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "DEADSET — Friends" },
      { name: "description", content: "Share lifts, climb leagues and invite mates on DEADSET." },
      { property: "og:title", content: "DEADSET — Friends" },
      {
        property: "og:description",
        content: "Share lifts, climb leagues and invite mates on DEADSET.",
      },
      { property: "og:url", content: "https://deadsetfit.org/friends" },
      { name: "twitter:title", content: "DEADSET — Friends" },
      {
        name: "twitter:description",
        content: "Share lifts, climb leagues and invite mates on DEADSET.",
      },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/friends" }],
  }),
  component: FriendsPage,
});

type Tab = "FRIENDS" | "GYM" | "CREW" | "FEED" | "ARENA" | "INVITE";

function FriendsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<{ userId: string } | null | "loading">("loading");
  const { section } = Route.useSearch();
  const tab = section ?? "FRIENDS";

  useEffect(() => {
    let cancelled = false;
    // Be patient here: a slow auth restore should not look like a logout.
    const timeout = setTimeout(() => {
      if (!cancelled) setSession((s) => (s === "loading" ? null : s));
    }, 8000);

    (async () => {
      await withTimeout(restoreSupabaseSession(), undefined, 2500);
      return withTimeout(
        supabase.auth.getSession(),
        { data: { session: null }, error: null },
        4500,
      );
    })()
      .then(({ data }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setSession(data.session ? { userId: data.session.user.id } : null);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeout);
        setSession(null);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (cancelled) return;
      clearTimeout(timeout);
      setSession(s ? { userId: s.user.id } : null);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  if (session === "loading") {
    return (
      <div className="flex items-center justify-center pt-20">
        <Loader2 className="animate-spin text-accent-red" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-6 pt-4">
        <header className="mb-8">
          <p className="label-cap">FRIENDS</p>
          <h1 className="display text-5xl font-extrabold text-grit leading-none mt-1">
            FIND YOUR
            <br />
            FRIENDS.
          </h1>
        </header>
        <div className="bg-grit-card border border-grit p-6">
          <p className="text-sm text-[#8a8a8a] mb-4">
            Sign in to share lifts, climb leagues and invite mates.
          </p>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="btn-grit w-full py-3 label-cap"
          >
            Sign in / Create account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="px-5 pt-4 pb-2 flex items-start justify-between">
        <div>
          <p className="label-cap">FRIENDS</p>
          <h1 className="display text-4xl font-extrabold text-grit leading-none mt-1">
            LIFT TOGETHER
          </h1>
          <p className="mt-2 max-w-[32ch] text-xs leading-relaxed text-grit-dim">
            Your people. Your gym. More reasons to show up.
          </p>
        </div>
        <NotificationsBell />
      </header>
      <nav aria-label="Community sections" className="px-5 mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ["FRIENDS", "People", "Friends & nearby", Users],
            ["GYM", "My gym", "Join & compete", Building2],
            ["CREW", "Crews", "Your group", Dumbbell],
            ["FEED", "Feed", "Lifts & updates", Flame],
            ["ARENA", "Rankings", "Climb the board", Trophy],
            ["INVITE", "Invite", "Bring your mates", UserPlus],
          ] as const
        ).map(([t, label, description, Icon]) => (
          <button
            key={t}
            type="button"
            aria-current={tab === t ? "page" : undefined}
            onClick={() => {
              hapticSelection();
              void navigate({ to: "/friends", search: { section: t }, replace: true });
            }}
            className={`press min-h-20 min-w-0 rounded-2xl border p-2 text-left transition-colors motion-reduce:transition-none ${tab === t ? "border-accent-red/60 bg-accent-red/15 text-grit" : "border-white/10 bg-grit-card text-grit-dim"}`}
          >
            <Icon size={16} className="mb-2 text-accent-red" />
            <span className="block text-xs font-black">{label}</span>
            <span className="mt-1 block text-[9px] leading-relaxed">{description}</span>
          </button>
        ))}
      </nav>
      <div className="pt-4">
        {tab === "FEED" && <Feed userId={session.userId} />}
        {tab === "FRIENDS" && <Friends />}
        {tab === "GYM" && <Friends key="gym" initialView="GYM" />}
        {tab === "CREW" && <CrewPanel />}
        {tab === "ARENA" && <League userId={session.userId} />}
        {tab === "INVITE" && <Invite />}
      </div>
    </div>
  );
}

// ============ FEED ============
type FeedPost = Awaited<ReturnType<typeof getFeed>>[number];

function FeedStat({ label, v }: { label: string; v: number | string }) {
  return (
    <div>
      <p className="display font-extrabold text-grit text-lg leading-none tabular-nums">{v}</p>
      <p className="label-cap text-[9px] text-grit-dim mt-0.5">{label}</p>
    </div>
  );
}

function Feed({ userId }: { userId: string }) {
  const _getFeed = getFeed;
  const _createPost = createPost;
  const _toggleLike = toggleLike;
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [composing, setComposing] = useState(false);
  const [postKind, setPostKind] = useState<"text" | "pr">("text");
  const [text, setText] = useState("");
  const [prLift, setPrLift] = useState("");
  const [prWeight, setPrWeight] = useState("");
  const [prReps, setPrReps] = useState("");
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [scope, setScope] = useState<FeedScope>("following");

  const load = useCallback(async () => {
    try {
      const r = await _getFeed(scope);
      setPosts(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feed failed");
      // Show the empty state instead of an infinite spinner on failure.
      setPosts((cur) => cur ?? []);
    }
  }, [_getFeed, scope]);
  useEffect(() => {
    load();
  }, [load]);

  async function publish() {
    setPosting(true);
    try {
      if (postKind === "pr") {
        const w = Number(prWeight);
        if (!prLift.trim() || !w) {
          toast.error("Lift + weight required");
          setPosting(false);
          return;
        }
        await _createPost({
          data: {
            kind: "pr",
            content: text.trim(),
            metadata: {
              lift: prLift.trim().toUpperCase(),
              weight: w,
              reps: prReps ? Number(prReps) : 1,
            },
          },
        });
      } else {
        if (!text.trim()) {
          setPosting(false);
          return;
        }
        await _createPost({ data: { kind: "text", content: text.trim(), metadata: {} } });
      }
      setText("");
      setPrLift("");
      setPrWeight("");
      setPrReps("");
      setComposing(false);
      setPostKind("text");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPosting(false);
    }
  }

  async function reportPost(p: FeedPost) {
    setMenuFor(null);
    const reason = await askText({
      title: "Report this post",
      message: "Briefly describe the issue — harassment, spam, hateful or explicit content, etc.",
      placeholder: "What's wrong with it?",
      confirmLabel: "Report",
    });
    if (!reason || !reason.trim()) return;
    try {
      await reportContent({
        data: { userId: p.user_id, postId: p.id, reason: reason.trim().slice(0, 500) },
      });
      toast.success("Report submitted — we review within 24 hours");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send report");
    }
  }

  async function blockAuthor(p: FeedPost) {
    setMenuFor(null);
    const ok = await askConfirm({
      title: `Block ${p.author.username ? "@" + p.author.username : "this athlete"}?`,
      message: "You won't see their posts, comments or profile, and they won't see yours.",
      confirmLabel: "Block",
      danger: true,
    });
    if (!ok) return;
    try {
      await blockUser({ data: { userId: p.user_id } });
      toast.success("Blocked");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't block");
    }
  }

  async function react(p: FeedPost, reaction: "fire" | "beast" | "respect" | "goat") {
    setPickerFor(null);
    const wasMine = p.myReaction;
    const sameOff = wasMine === reaction;
    // optimistic
    setPosts(
      (arr) =>
        arr?.map((x) => {
          if (x.id !== p.id) return x;
          const reactions = { ...(x.reactions || {}) };
          if (wasMine) reactions[wasMine] = Math.max(0, (reactions[wasMine] || 1) - 1);
          if (!sameOff) reactions[reaction] = (reactions[reaction] || 0) + 1;
          return {
            ...x,
            myReaction: sameOff ? null : reaction,
            liked: !sameOff,
            likeCount: x.likeCount + (sameOff ? -1 : wasMine ? 0 : 1),
            reactions,
          };
        }) ?? null,
    );
    try {
      await _toggleLike({ data: { postId: p.id, reaction } });
    } catch {
      load();
    }
  }

  async function share(p: FeedPost) {
    const url = await getInviteUrl();
    if (navigator.share)
      try {
        await navigator.share({ title: "DEADSET", text: p.content, url });
        return;
      } catch {
        /* user cancelled */
      }
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  if (!posts)
    return (
      <div className="px-5 pt-10 flex justify-center">
        <Loader2 className="animate-spin text-accent-red" />
      </div>
    );

  return (
    <div className="px-5 pb-6">
      <div className="flex gap-1 mb-4 p-1 bg-grit-card border border-grit rounded-xl">
        {(["following", "crew", "global"] as FeedScope[]).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`flex-1 py-2 rounded-lg label-cap text-[11px] transition-colors press ${
              scope === s ? "bg-accent-red text-white" : "text-grit-dim"
            }`}
          >
            {s === "following" ? "Following" : s === "crew" ? "Crew" : "Global"}
          </button>
        ))}
      </div>
      {!composing ? (
        <button
          onClick={() => setComposing(true)}
          className="w-full mb-4 bg-grit-card border border-grit p-4 flex items-center gap-3 text-left"
        >
          <div className="w-9 h-9 bg-accent-red flex items-center justify-center">
            <Plus size={16} className="text-grit" />
          </div>
          <span className="text-sm text-[#8a8a8a]">Drop a lift, PR or thought…</span>
        </button>
      ) : (
        <div className="mb-4 bg-grit-card border border-grit p-4">
          <div className="flex gap-2 mb-3">
            {(["text", "pr"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setPostKind(k)}
                className="label-cap px-3 py-1 border"
                style={{
                  borderColor: postKind === k ? "#e63222" : "#262626",
                  color: postKind === k ? "#e63222" : "#8a8a8a",
                }}
              >
                {k === "text" ? "POST" : "NEW PR"}
              </button>
            ))}
          </div>
          {postKind === "pr" && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input
                defaultValue={prLift}
                onChange={(e) => setPrLift(e.target.value)}
                placeholder="Bench"
                maxLength={20}
                className="input-grit text-xs col-span-3"
              />
              <input
                defaultValue={prWeight}
                onChange={(e) => setPrWeight(e.target.value)}
                inputMode="decimal"
                placeholder="kg"
                className="input-grit text-xs col-span-2"
              />
              <input
                defaultValue={prReps}
                onChange={(e) => setPrReps(e.target.value)}
                inputMode="numeric"
                placeholder="reps"
                className="input-grit text-xs"
              />
            </div>
          )}
          <textarea
            defaultValue={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={
              postKind === "pr"
                ? "Say something about the PR (optional)…"
                : "What did you smash today?"
            }
            className="input-grit w-full resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-[#8a8a8a]">{text.length}/500</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setComposing(false);
                  setText("");
                  setPostKind("text");
                }}
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button onClick={publish} disabled={posting} className="btn-grit px-4 py-1.5 text-xs">
                {posting ? <Loader2 size={12} className="animate-spin" /> : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div className="bg-grit-card border border-grit p-6 text-center text-sm text-[#8a8a8a]">
          {scope === "following"
            ? "No posts from people you follow yet. Follow athletes in the Friends tab to fill this feed."
            : scope === "crew"
              ? "Nothing from your crew yet. Join or start one in the Crew tab, then get them posting."
              : "Feed is empty. Be the first to post."}
        </div>
      )}

      {(() => {
        const weekAgo = Date.now() - 7 * 86400000;
        const prs = posts.filter(
          (p) =>
            p.kind === "pr" &&
            p.metadata &&
            typeof p.metadata === "object" &&
            "lift" in p.metadata &&
            "weight" in p.metadata &&
            new Date(p.created_at).getTime() >= weekAgo,
        );
        if (prs.length === 0) return null;
        const top = prs.reduce((a, b) =>
          Number((b.metadata as { weight?: number }).weight) >
          Number((a.metadata as { weight?: number }).weight)
            ? b
            : a,
        );
        const m = top.metadata as { lift?: string; weight?: number };
        const name = top.author?.display_name || top.author?.username || "Athlete";
        return (
          <div
            className="rounded-2xl p-4 mb-3 border border-accent-red"
            style={{ background: "linear-gradient(135deg, rgba(230,50,34,0.14), #141414)" }}
          >
            <p className="label-cap text-[10px] text-accent-red flex items-center gap-1.5">
              <Trophy size={12} /> PR of the week
            </p>
            <p className="display text-2xl font-extrabold uppercase text-grit mt-1">
              {String(m.lift)} · {String(m.weight)}kg
            </p>
            <p className="text-xs text-grit-dim mt-0.5">by {name}</p>
          </div>
        );
      })()}

      {posts.map((p) => (
        <article key={p.id} className="bg-grit-card border border-grit p-4 mb-3">
          <header className="flex items-center gap-3 mb-3">
            <Link
              to="/athlete/$id"
              params={{ id: p.user_id }}
              className="flex items-center gap-3 flex-1 min-w-0 press"
            >
              <div className="w-10 h-10 bg-[#1a1a1a] border border-grit flex items-center justify-center display font-extrabold text-grit shrink-0">
                {(p.author.display_name || "A")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-grit text-sm truncate">
                  {p.author.display_name || "Athlete"}
                </p>
                <p className="text-[10px] text-[#8a8a8a] label-cap">
                  {p.author.username ? `@${p.author.username} · ` : ""}
                  {p.author.level} · {timeAgo(p.created_at)}
                </p>
              </div>
            </Link>
            {p.kind !== "text" && (
              <span className="label-cap text-[9px] px-2 py-0.5 border border-accent-red text-accent-red shrink-0">
                {p.kind}
              </span>
            )}
            {p.user_id !== userId && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                  className="p-1.5 -mr-1 text-grit-dim press"
                  aria-label="Post options"
                >
                  <MoreVertical size={16} />
                </button>
                {menuFor === p.id && (
                  <div className="absolute right-0 top-8 z-20 w-40 bg-grit-card border border-grit rounded-xl overflow-hidden shadow-xl">
                    <button
                      onClick={() => reportPost(p)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-grit hover:bg-white/[0.04] text-left"
                    >
                      <Flag size={14} className="text-accent-red" /> Report post
                    </button>
                    <button
                      onClick={() => blockAuthor(p)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-grit hover:bg-white/[0.04] text-left border-t border-grit"
                    >
                      <Ban size={14} className="text-accent-red" /> Block user
                    </button>
                  </div>
                )}
              </div>
            )}
          </header>
          {p.image_url && (
            <img src={p.image_url} alt="" className="w-full mb-3 border border-grit" />
          )}
          {p.content && <p className="text-sm text-grit mb-3 whitespace-pre-wrap">{p.content}</p>}
          {p.metadata &&
            typeof p.metadata === "object" &&
            "h2h" in p.metadata &&
            (p.metadata as { h2h?: boolean }).h2h && (
              <Link
                to="/challenges"
                className="border border-accent-red bg-accent-red/10 p-3 mb-3 flex items-center gap-3 press"
              >
                <Swords className="text-accent-red shrink-0" size={20} />
                <div className="min-w-0 flex-1">
                  <p className="label-cap text-accent-red text-[10px]">HEAD-TO-HEAD CHALLENGE</p>
                  <p className="text-xs text-grit-dim mt-0.5">
                    Tap to open Challenges and post your best.
                  </p>
                </div>
                <span className="label-cap text-[9px] text-accent-red shrink-0">ACCEPT</span>
              </Link>
            )}
          {p.kind === "pr" &&
            p.metadata &&
            typeof p.metadata === "object" &&
            "lift" in p.metadata && (
              <div className="border border-accent-red p-3 mb-3 flex items-center gap-3">
                <Trophy className="text-accent-red" size={20} />
                <div>
                  <p className="label-cap text-accent-red">NEW PR</p>
                  <p className="display font-extrabold text-grit text-xl leading-none">
                    {String((p.metadata as { lift?: string }).lift)} ·{" "}
                    {String((p.metadata as { weight?: number }).weight)}kg
                  </p>
                </div>
              </div>
            )}
          {(p.kind === "workout" || p.kind === "pr") &&
            p.metadata &&
            typeof p.metadata === "object" &&
            "sets" in p.metadata && (
              <div className="bg-grit-card border border-grit rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell size={16} className="text-accent-red" />
                  <p className="display font-extrabold uppercase text-grit text-base leading-none">
                    {String((p.metadata as { label?: string }).label ?? "Workout")}
                  </p>
                  {Number((p.metadata as { prCount?: number }).prCount) > 0 && (
                    <span className="ml-auto label-cap text-[9px] bg-accent-red text-white px-1.5 py-0.5 rounded">
                      {Number((p.metadata as { prCount?: number }).prCount)} PR
                    </span>
                  )}
                </div>
                <div className="flex gap-4">
                  <FeedStat
                    label="Exercises"
                    v={Number((p.metadata as { exercises?: number }).exercises) || 0}
                  />
                  <FeedStat label="Sets" v={Number((p.metadata as { sets?: number }).sets) || 0} />
                  <FeedStat
                    label="Volume"
                    v={`${Math.round(((Number((p.metadata as { volume?: number }).volume) || 0) / 1000) * 10) / 10}t`}
                  />
                </div>
              </div>
            )}
          <footer className="flex items-center gap-3 text-[#8a8a8a] relative">
            <button
              onClick={() => setPickerFor(pickerFor === p.id ? null : p.id)}
              className="flex items-center gap-1.5 text-xs"
            >
              <span className="text-base leading-none">{reactionEmoji(p.myReaction)}</span>
              <span>{p.likeCount}</span>
            </button>
            {pickerFor === p.id && (
              <div className="absolute -top-12 left-0 bg-grit-card border border-accent-red px-2 py-1.5 flex gap-2 z-10 shadow-lg">
                {(["fire", "beast", "respect", "goat"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => react(p, r)}
                    className="text-xl leading-none hover:scale-125 transition-transform"
                    style={{ opacity: p.myReaction === r ? 1 : 0.85 }}
                  >
                    {reactionEmoji(r)}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setOpenComments(openComments === p.id ? null : p.id)}
              className="flex items-center gap-1.5 text-xs"
            >
              <MessageCircle size={16} /> {p.commentCount}
            </button>
            <button onClick={() => share(p)} className="flex items-center gap-1.5 text-xs ml-auto">
              <Share2 size={16} />
            </button>
          </footer>
          {openComments === p.id && <CommentsPanel postId={p.id} onPosted={load} />}
        </article>
      ))}
    </div>
  );
}

function reactionEmoji(r: string | null) {
  switch (r) {
    case "fire":
      return "🔥";
    case "beast":
      return "💪";
    case "respect":
      return "🙌";
    case "goat":
      return "🐐";
    default:
      return "🔥";
  }
}

function CommentsPanel({ postId, onPosted }: { postId: string; onPosted: () => void }) {
  const _get = getComments;
  const _add = addComment;
  const [items, setItems] = useState<Awaited<ReturnType<typeof getComments>> | null>(null);
  const [text, setText] = useState("");
  const textRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await _get({ data: { postId } }));
    } catch {
      // Failed load renders as "no comments yet" instead of a stuck spinner.
      setItems((cur) => cur ?? []);
    }
  }, [_get, postId]);
  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await _add({ data: { postId, content: text.trim() } });
      setText("");
      if (textRef.current) textRef.current.value = "";
      await load();
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-grit">
      {!items ? (
        <Loader2 className="animate-spin text-[#8a8a8a]" size={14} />
      ) : items.length === 0 ? (
        <p className="text-xs text-[#8a8a8a]">No comments yet.</p>
      ) : (
        items.map((c) => (
          <div key={c.id} className="mb-2 text-xs">
            {c.author?.id ? (
              // Tappable so a commenter can be reported/blocked from their profile (UGC 1.2).
              <Link
                to="/athlete/$id"
                params={{ id: c.author.id }}
                className="font-bold text-grit press"
              >
                {c.author?.display_name || "User"}
              </Link>
            ) : (
              <span className="font-bold text-grit">{c.author?.display_name || "User"}</span>
            )}
            <span className="text-[#8a8a8a] ml-2">{c.content}</span>
          </div>
        ))
      )}
      <div className="flex gap-2 mt-2">
        <input
          ref={textRef}
          defaultValue=""
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          maxLength={500}
          className="input-grit flex-1 text-xs"
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          aria-label="Send reply"
          className="btn-grit px-3"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ============ LEAGUE ============
function League({ userId }: { userId: string }) {
  const _get = getLeaderboard;
  const [data, setData] = useState<Awaited<ReturnType<typeof getLeaderboard>> | null>(null);
  const [sharing, setSharing] = useState(false);
  const [scope, setScope] = useState<FeedScope>("global");

  useEffect(() => {
    _get(scope)
      .then(setData)
      .catch(() => {
        toast.error("Leaderboard failed");
        // Render the empty board rather than spinning forever.
        setData((cur) => cur ?? { top: [], me: null });
      });
  }, [_get, scope]);

  if (!data)
    return (
      <div className="px-5 pt-10 flex justify-center">
        <Loader2 className="animate-spin text-accent-red" />
      </div>
    );

  return (
    <div className="px-5 pb-6">
      <div className="border border-accent-red bg-grit-card p-5 mb-4 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-red/20 blur-2xl" />
        <p className="label-cap text-accent-red text-[10px] flex items-center gap-1.5">
          <Swords size={12} /> DEADSET ARENAS
        </p>
        <h2 className="display text-3xl font-extrabold uppercase text-grit leading-none mt-1">
          Compete this week
        </h2>
        <p className="text-xs text-grit-dim mt-2 leading-relaxed">
          Arena rank is built from grit, workouts, PRs and consistency. Challenge friends, post PRs
          and climb the boards.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Link
            to="/challenges"
            className="btn-grit py-3 text-xs flex items-center justify-center gap-2"
          >
            <Swords size={14} /> Challenge
          </Link>
          <Link
            to="/leaderboard"
            className="btn-ghost py-3 text-xs flex items-center justify-center gap-2"
          >
            <Trophy size={14} /> PR Boards
          </Link>
        </div>
      </div>

      {/* Scope: friends vs global */}
      <div className="flex gap-1 mb-4 p-1 bg-grit-card border border-grit rounded-xl">
        {(["following", "global"] as FeedScope[]).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`flex-1 py-2 rounded-lg label-cap text-[11px] transition-colors press ${
              scope === s ? "bg-accent-red text-white" : "text-grit-dim"
            }`}
          >
            {s === "following" ? "Following" : "Global"}
          </button>
        ))}
      </div>

      {/* My league card */}
      {data.me && (
        <div className="bg-grit-card border border-grit p-5 mb-4 flex items-center gap-4">
          <div
            className="w-16 h-16 flex items-center justify-center"
            style={{ background: leagueColor(data.me.league) }}
          >
            <Crown size={28} className="text-grit-bg" style={{ color: "#0a0a0a" }} />
          </div>
          <div className="flex-1">
            <p className="label-cap" style={{ color: leagueColor(data.me.league) }}>
              {data.me.league} LEAGUE
            </p>
            <p className="display font-extrabold text-grit text-3xl leading-none">
              #{data.me.rank || "—"}
            </p>
            <p className="text-xs text-[#8a8a8a]">{data.me.grit_points} DS pts</p>
          </div>
          <button
            onClick={() => setSharing(true)}
            className="btn-grit px-3 py-2 text-xs flex items-center gap-1.5"
            aria-label="Share rank"
          >
            <Share2 size={12} /> SHARE
          </button>
        </div>
      )}
      {sharing && data.me && (
        <RankShareCard
          gritPoints={data.me.grit_points ?? 0}
          displayName={data.me.display_name || "Athlete"}
          username={data.me.username}
          streak={0}
          prs={[]}
          sessions={0}
          overall={0}
          onClose={() => setSharing(false)}
        />
      )}

      <Link
        to="/leaderboard"
        className="bg-grit-card border border-accent-red mb-3 px-4 py-3 flex items-center gap-3 hover:bg-[#1a1a1a] transition-colors"
      >
        <Trophy size={18} className="text-accent-red" />
        <div className="flex-1">
          <p className="label-cap text-accent-red text-[11px]">STRENGTH LEADERBOARD</p>
          <p className="text-xs text-grit-dim">
            Ranked by Overall · Bench · Squat · Deadlift · Total
          </p>
        </div>
        <span className="label-cap text-grit-dim text-[10px]">VIEW →</span>
      </Link>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <ArenaTile icon={<Flame size={14} />} title="Rank" sub="Grit ladder" />
        <ArenaTile icon={<Dumbbell size={14} />} title="Big 3" sub="Bench + Squat + Dead" />
        <ArenaTile icon={<MessageCircle size={14} />} title="Feed" sub="Call outs" />
      </div>

      <div className="bg-grit-card border border-grit">
        {data.top.length === 0 && (
          <p className="p-5 text-sm text-[#8a8a8a] text-center">No athletes yet.</p>
        )}
        {data.top.slice(0, 50).map((p) => (
          <Link
            key={p.id}
            to="/athlete/$id"
            params={{ id: p.id }}
            className="flex items-center gap-3 px-4 py-3 border-b border-grit last:border-b-0 hover:bg-[#1a1a1a]"
            style={{ background: p.id === userId ? "rgba(230,50,34,0.08)" : undefined }}
          >
            <div className="display font-extrabold text-grit text-lg w-7 text-center">
              {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : p.rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-grit text-sm truncate">{p.display_name || "Athlete"}</p>
              <p className="text-[10px] text-[#8a8a8a] label-cap">
                {p.username ? `@${p.username} · ` : ""}
                <span style={{ color: leagueColor(p.league) }}>{p.league}</span>
              </p>
            </div>
            <span className="display font-extrabold text-accent-red text-base">
              {p.grit_points}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ArenaTile({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="bg-grit-card border border-grit p-3">
      <div className="text-accent-red mb-2">{icon}</div>
      <p className="display font-extrabold uppercase text-grit text-sm leading-none">{title}</p>
      <p className="text-[9px] text-grit-dim mt-1 leading-tight">{sub}</p>
    </div>
  );
}

function leagueColor(l: string) {
  if (l.startsWith("DEADSET")) return "#e63222";
  if (l.startsWith("UNREAL")) return "#22d3ee";
  if (l.startsWith("CHAMPION")) return "#f43f5e";
  if (l.startsWith("ELITE")) {
    return "#a78bfa";
  }
  if (l.startsWith("DIAMOND")) {
    return "#67e8f9";
  }
  if (l.startsWith("PLATINUM")) return "#67e8f9";
  if (l.startsWith("GOLD")) {
    return "#fbbf24";
  }
  if (l.startsWith("SILVER")) {
    return "#cbd5e1";
  }
  return "#b45309";
}

// ============ INVITE ============
function Invite() {
  const _info = getMyReferralInfo;
  const _redeem = redeemReferral;
  const _profile = updateMyProfile;
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getMyReferralInfo>> | null>(null);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    _info()
      .then(setInfo)
      .catch(() => {
        toast.error("Failed");
        // Render the invite screen without a code instead of spinning forever.
        setInfo((cur) => cur ?? ({ code: null } as Awaited<ReturnType<typeof getMyReferralInfo>>));
      });
  }, [_info]);

  async function copy() {
    if (!info?.code) return;
    await navigator.clipboard.writeText(`${window.location.origin}/?ref=${info.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await _redeem({ data: { code: code.trim() } });
      toast.success("Both got 30 days Pro!");
      setCode("");
      if (codeRef.current) codeRef.current.value = "";
      setInfo(await _info());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveUsername() {
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      toast.error("3-24 letters, numbers, underscore");
      return;
    }
    setBusy(true);
    try {
      await _profile({ data: { username } });
      toast.success("Username saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!info)
    return (
      <div className="px-5 pt-10 flex justify-center">
        <Loader2 className="animate-spin text-accent-red" />
      </div>
    );

  return (
    <div className="px-5 pb-6 space-y-4">
      {/* Referral Pro time is account-based and follows the member across devices. */}
      <div className="bg-grit-card border border-grit p-5">
        <p className="label-cap text-accent-red mb-1">DEADSET PRO</p>
        {info.proUntil && new Date(info.proUntil) > new Date() ? (
          <>
            <p className="display font-extrabold text-grit text-3xl leading-none">ACTIVE</p>
            <p className="text-xs text-[#8a8a8a] mt-1">
              Until {new Date(info.proUntil).toLocaleDateString()}
            </p>
          </>
        ) : (
          <p className="text-sm text-[#8a8a8a]">Invite mates to earn bonus membership time.</p>
        )}
      </div>

      {/* Username */}
      <div className="bg-grit-card border border-grit p-5">
        <p className="label-cap mb-2 flex items-center gap-2">
          <Users size={12} /> Public username
        </p>
        <div className="flex gap-2">
          <input
            defaultValue={username}
            onChange={(e) => {
              const c = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
              e.target.value = c;
              setUsername(c);
            }}
            placeholder="yourname"
            maxLength={24}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="input-grit flex-1"
          />
          <button onClick={saveUsername} disabled={busy || !username} className="btn-grit px-3">
            Save
          </button>
        </div>
        <p className="text-[10px] text-[#8a8a8a] mt-1">Shown on your posts and league entries.</p>
      </div>

      {/* Your invite code */}
      <div className="bg-grit-card border border-accent-red p-5">
        <div className="flex items-center gap-2 mb-2">
          <Gift size={14} className="text-accent-red" />
          <p className="label-cap text-accent-red">Invite a mate, both get 30 days Pro</p>
        </div>
        <div className="display font-extrabold text-grit text-4xl leading-none my-3 tracking-wider">
          {info.code}
        </div>
        <button
          onClick={copy}
          className="btn-grit w-full py-2 flex items-center justify-center gap-2"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="label-cap text-xs">{copied ? "Copied" : "Copy invite link"}</span>
        </button>
        {(() => {
          const tiers = [1, 3, 5, 10, 25];
          const labels: Record<number, string> = {
            1: "First Recruit",
            3: "Squad Builder",
            5: "Recruiter",
            10: "Ambassador",
            25: "Legend",
          };
          const count = info.count ?? 0;
          const next = tiers.find((t) => count < t) ?? null;
          const cur = [...tiers].reverse().find((t) => count >= t) ?? null;
          const prev = cur ?? 0;
          const prog = next ? Math.min(1, (count - prev) / (next - prev)) : 1;
          return (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#8a8a8a]">
                  Invited <span className="text-grit font-bold">{count}</span> · earned{" "}
                  <span className="text-grit font-bold">{count * 30}</span> Pro days
                </span>
                {cur && <span className="label-cap text-[9px] text-accent-red">{labels[cur]}</span>}
              </div>
              {next && (
                <>
                  <div className="h-1.5 rounded-full bg-[#0a0a0a] overflow-hidden">
                    <div
                      className="h-full bg-accent-red rounded-full"
                      style={{ width: `${Math.round(prog * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#8a8a8a] mt-1">
                    {next - count} more to {labels[next]}
                  </p>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Redeem */}
      <div className="bg-grit-card border border-grit p-5">
        <p className="label-cap mb-2">Got a code from a mate?</p>
        <div className="flex gap-2">
          <input
            ref={codeRef}
            defaultValue={code}
            onChange={(e) => {
              const c = e.target.value.toUpperCase();
              e.target.value = c;
              setCode(c);
            }}
            placeholder="CODE"
            maxLength={16}
            className="input-grit flex-1 tracking-wider"
          />
          <button onClick={redeem} disabled={busy || !code} className="btn-grit px-4">
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Redeem"}
          </button>
        </div>
      </div>

      <Link to="/profile" className="block text-center label-cap text-[#8a8a8a] mt-6">
        Manage account →
      </Link>
    </div>
  );
}

// ============ FRIENDS ============
type SearchHit = Awaited<ReturnType<typeof searchAthletes>>[number];
type Suggested = Awaited<ReturnType<typeof getSuggestedAthletes>>[number];
type FriendView = "CREW" | "REQUESTS" | "DISCOVER" | "GYM";

const COUNTRY_ALIASES: Record<string, string> = {
  "united kingdom of great britain and northern ireland": "United Kingdom",
  "russian federation": "Russia",
  "korea, republic of": "South Korea",
  "korea (the republic of)": "South Korea",
  "korea, democratic people's republic of": "North Korea",
  "iran, islamic republic of": "Iran",
  "syrian arab republic": "Syria",
  "viet nam": "Vietnam",
  czechia: "Czech Republic",
  türkiye: "Turkey",
  "tanzania, united republic of": "Tanzania",
  "bolivia (plurinational state of)": "Bolivia",
  "venezuela (bolivarian republic of)": "Venezuela",
  "moldova, republic of": "Moldova",
  "lao people's democratic republic": "Laos",
  "united states of america": "United States",
};

function normalizeCountry(raw: string | null | undefined): string {
  if (!raw) return "";
  // Strip trailing " (the)" and similar UN formal suffixes
  let s = raw.replace(/\s*\(the\)\s*$/i, "").trim();
  const key = s.toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  // Drop trailing parenthetical qualifier e.g. "Micronesia (Federated States of)"
  s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return s;
}

function Friends({ initialView = "CREW" }: { initialView?: FriendView }) {
  const _search = searchAthletes;
  const _suggest = getSuggestedAthletes;
  const _connections = getFriendConnections;
  const _updateFriendship = updateFriendship;
  const _nearby = getNearbyAthletes;
  const _getLoc = getMyLocation;
  const _setLoc = updateMyLocation;
  const _searchGyms = searchLocalGyms;
  const _setGym = updateMyGym;
  const _gymHub = getGymHub;
  const { isPro, loading: proLoading } = usePro();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [suggested, setSuggested] = useState<Suggested[] | null>(null);
  const [connections, setConnections] = useState<FriendConnections | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Awaited<ReturnType<typeof getNearbyAthletes>> | null>(null);
  const [myLoc, setMyLoc] = useState<{ city: string | null; country: string | null } | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [countryInput, setCountryInput] = useState("");
  const [gymInput, setGymInput] = useState("");
  const [gymHub, setGymHub] = useState<GymHub | null>(null);
  const [localGyms, setLocalGyms] = useState<LocalGymOption[]>([]);
  const [gymBusy, setGymBusy] = useState(false);
  const [gymError, setGymError] = useState<string | null>(null);
  const [view, setView] = useState<FriendView>(initialView);
  // These DOM-owned fields are also set programmatically (initial load, GPS,
  // normalize-on-save), so their .value must be synced imperatively — a
  // defaultValue alone only applies at mount.
  const cityRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const gymRef = useRef<HTMLInputElement>(null);

  const loadFriendsHome = useCallback(() => {
    setFriendsError(null);
    setLocationError(null);
    _suggest()
      .then(setSuggested)
      .catch((error) => {
        // Failed suggestions render as an empty list, not an endless spinner.
        setSuggested((cur) => cur ?? []);
        setFriendsError(error instanceof Error ? error.message : "Couldn't load athletes");
      });
    _connections()
      .then(setConnections)
      .catch((error) => {
        setFriendsError(error instanceof Error ? error.message : "Couldn't load your friends");
      });
    _getLoc()
      .then((l) => {
        const c = normalizeCountry(l.country);
        setMyLoc({ city: l.city, country: c || l.country });
        const city = l.city ?? "";
        const country = c || (l.country ?? "");
        setCityInput(city);
        setCountryInput(country);
        if (cityRef.current) cityRef.current.value = city;
        if (countryRef.current) countryRef.current.value = country;
      })
      .catch((error) => {
        setLocationError(error instanceof Error ? error.message : "Couldn't load your city");
      });
    _nearby()
      .then(setNearby)
      .catch((error) => {
        setLocationError(error instanceof Error ? error.message : "Couldn't load nearby athletes");
      });
    _gymHub()
      .then((hub) => {
        setGymHub(hub);
        const gymName = hub.gymName ?? "";
        setGymInput(gymName);
        if (gymRef.current) gymRef.current.value = gymName;
      })
      .catch((error) => {
        setGymError(error instanceof Error ? error.message : "Couldn't load your gym");
      });
    _searchGyms({ data: {} })
      .then((result) => setLocalGyms(result.gyms))
      .catch(() => setLocalGyms([]));
  }, [_connections, _getLoc, _gymHub, _nearby, _searchGyms, _suggest]);

  useEffect(() => {
    loadFriendsHome();
  }, [loadFriendsHome]);

  const runSearch = useCallback(async () => {
    return _search({ data: { q: q.trim() } });
  }, [_search, q]);

  const retrySearch = useCallback(async () => {
    setSearchBusy(true);
    setSearchError(null);
    try {
      setResults(await runSearch());
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search failed");
    } finally {
      setSearchBusy(false);
    }
  }, [runSearch]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      setSearchError(null);
      setSearchBusy(false);
      return;
    }
    let cancelled = false;
    setSearchBusy(true);
    setSearchError(null);
    const id = setTimeout(async () => {
      try {
        const nextResults = await runSearch();
        if (!cancelled) setResults(nextResults);
      } catch (e) {
        if (!cancelled) {
          setResults(null);
          setSearchError(e instanceof Error ? e.message : "Search failed");
        }
      } finally {
        if (!cancelled) setSearchBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, runSearch]);

  const statusById = useMemo(() => {
    const statuses = new Map<string, FriendStatus>();
    connections?.friends.forEach((person) => statuses.set(person.id, "FRIEND"));
    connections?.incoming.forEach((person) => statuses.set(person.id, "INCOMING"));
    connections?.outgoing.forEach((person) => statuses.set(person.id, "OUTGOING"));
    return statuses;
  }, [connections]);

  async function changeConnection(id: string, status: FriendStatus, forcedAction?: FriendAction) {
    const action =
      forcedAction ??
      (status === "NONE"
        ? "send"
        : status === "INCOMING"
          ? "accept"
          : status === "OUTGOING"
            ? "cancel"
            : "remove");
    if (action === "remove") {
      const confirmed = await askConfirm({
        title: "Remove this friend?",
        message: "Their PRs and Strength Map will no longer appear in your friends comparisons.",
        confirmLabel: "Remove friend",
        danger: true,
      });
      if (!confirmed) return;
    }
    setBusy(id);
    try {
      const result = await _updateFriendship({ data: { userId: id, action } });
      hapticPlanUpdated();
      toast.success(
        result.status === "FRIEND"
          ? "Friend added — open their profile to compare"
          : result.status === "OUTGOING"
            ? "Friend request sent"
            : action === "decline"
              ? "Request declined"
              : action === "cancel"
                ? "Request cancelled"
                : "Friend removed",
      );
      setConnections(await _connections());
      setSuggested((current) =>
        result.status === "OUTGOING" || result.status === "FRIEND"
          ? (current?.filter((person) => person.id !== id) ?? null)
          : current,
      );
    } catch (e) {
      hapticFailure();
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function useGPS() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setLocBusy(true);
    setLocationError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        }),
      );
      // City-level precision only (~1 km): the UI promises "never exact
      // location", so full-precision GPS must not leave the device.
      const lat = pos.coords.latitude.toFixed(2);
      const lon = pos.coords.longitude.toFixed(2);
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      );
      if (!r.ok) throw new Error("City lookup is temporarily unavailable. Type your city below.");
      const j = (await r.json()) as {
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryName?: string;
      };
      const city = j.city || j.locality || j.principalSubdivision || "";
      const country = normalizeCountry(j.countryName) || j.countryName || "";
      if (!city || !country) throw new Error("Couldn't resolve city");
      setCityInput(city);
      setCountryInput(country);
      if (cityRef.current) cityRef.current.value = city;
      if (countryRef.current) countryRef.current.value = country;
      await _setLoc({ data: { city, country, region: j.principalSubdivision || null } });
      hapticPlanUpdated();
      toast.success(`Set to ${city}, ${country}`);
      setMyLoc({ city, country });
      setNearby(await _nearby());
      const [nextGymHub, gymOptions] = await Promise.all([_gymHub(), _searchGyms({ data: {} })]);
      setGymHub(nextGymHub);
      setLocalGyms(gymOptions.gyms);
      setGymInput(nextGymHub.gymName ?? "");
      if (gymRef.current) gymRef.current.value = nextGymHub.gymName ?? "";
    } catch (e) {
      hapticFailure();
      const geolocationCode =
        typeof e === "object" && e !== null && "code" in e ? Number(e.code) : null;
      const message =
        geolocationCode !== null
          ? geolocationCode === 1
            ? "Location access is off. Allow it in iPhone Settings, or type your city instead."
            : "Your location couldn't be read. Type your city instead."
          : e instanceof Error
            ? e.message
            : "Location couldn't be read. Type your city instead.";
      setLocationError(message);
      toast.error(message);
    } finally {
      setLocBusy(false);
    }
  }

  async function saveCity() {
    if (!cityInput.trim() || !countryInput.trim()) {
      toast.error("City and country required");
      return;
    }
    setLocBusy(true);
    setLocationError(null);
    try {
      const city = cityInput.trim();
      const country = normalizeCountry(countryInput) || countryInput.trim();
      setCountryInput(country);
      if (countryRef.current) countryRef.current.value = country;
      await _setLoc({
        data: { city, country, region: null },
      });
      setMyLoc({ city, country });
      hapticPlanUpdated();
      toast.success("Saved");
      setNearby(await _nearby());
      const [nextGymHub, gymOptions] = await Promise.all([_gymHub(), _searchGyms({ data: {} })]);
      setGymHub(nextGymHub);
      setLocalGyms(gymOptions.gyms);
      setGymInput(nextGymHub.gymName ?? "");
      if (gymRef.current) gymRef.current.value = nextGymHub.gymName ?? "";
    } catch (e) {
      hapticFailure();
      const message = e instanceof Error ? e.message : "Couldn't save your city";
      setLocationError(message);
      toast.error(message);
    } finally {
      setLocBusy(false);
    }
  }

  async function saveGym(name = gymInput) {
    const gymName = name.trim();
    if (!myLoc?.city || !myLoc?.country) {
      setView("DISCOVER");
      toast.error("Set your city first, then choose your gym");
      return;
    }
    if (gymName.length < 2) {
      toast.error("Enter your gym name");
      return;
    }
    setGymBusy(true);
    setGymError(null);
    try {
      await _setGym({ data: { gymName } });
      const [nextHub, gymOptions] = await Promise.all([_gymHub(), _searchGyms({ data: {} })]);
      setGymHub(nextHub);
      setLocalGyms(gymOptions.gyms);
      setGymInput(nextHub.gymName ?? gymName);
      if (gymRef.current) gymRef.current.value = nextHub.gymName ?? gymName;
      hapticPlanUpdated();
      toast.success(`Joined ${nextHub.gymName ?? gymName}`);
    } catch (error) {
      hapticFailure();
      const message = error instanceof Error ? error.message : "Couldn't save your gym";
      setGymError(message);
      toast.error(message);
    } finally {
      setGymBusy(false);
    }
  }

  async function leaveGym() {
    const confirmed = await askConfirm({
      title: "Leave this gym?",
      message:
        "You will disappear from its local board. Your friends and training data stay intact.",
      confirmLabel: "Leave gym",
      danger: true,
    });
    if (!confirmed) return;
    setGymBusy(true);
    try {
      await _setGym({ data: { gymName: "" } });
      const nextHub = await _gymHub();
      setGymHub(nextHub);
      setGymInput("");
      if (gymRef.current) gymRef.current.value = "";
      hapticPlanUpdated();
      toast.success("Gym removed");
    } catch (error) {
      hapticFailure();
      toast.error(error instanceof Error ? error.message : "Couldn't leave the gym");
    } finally {
      setGymBusy(false);
    }
  }

  return (
    <div className="px-5 pb-6">
      {view !== "GYM" && (
        <>
          <div className="border border-accent-red/70 bg-grit-card rounded-2xl p-4 mb-4 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent-red/20 blur-2xl" />
            <p className="label-cap text-accent-red text-[10px] flex items-center gap-1.5">
              <Swords size={12} /> BUILD YOUR CREW
            </p>
            <h2 className="display text-[1.65rem] font-extrabold uppercase text-grit leading-none mt-1">
              Add rivals. Chase PRs.
            </h2>
            <p className="text-xs text-grit-dim mt-2 leading-relaxed">
              Search usernames, follow local lifters, invite mates, then compete in arenas and
              leaderboards.
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Link
                to="/challenges"
                className="btn-ghost py-2 text-[10px] flex items-center justify-center gap-1.5"
              >
                <Swords size={12} /> Arena
              </Link>
              <Link
                to="/leaderboard"
                className="btn-ghost py-2 text-[10px] flex items-center justify-center gap-1.5"
              >
                <Trophy size={12} /> Boards
              </Link>
              <Link
                to="/guide"
                className="btn-ghost py-2 text-[10px] flex items-center justify-center gap-1.5"
              >
                <BookOpen size={12} /> Guide
              </Link>
            </div>
          </div>

          {/* Friendship stats */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-grit-card border border-grit rounded-2xl p-3 text-center">
              <p className="display font-extrabold text-grit text-2xl leading-none">
                {connections?.friends.length ?? "—"}
              </p>
              <p className="label-cap text-[10px] text-[#8a8a8a] mt-1">Friends</p>
            </div>
            <div className="bg-grit-card border border-grit rounded-2xl p-3 text-center">
              <p className="display font-extrabold text-grit text-2xl leading-none">
                {connections?.incoming.length ?? "—"}
              </p>
              <p className="label-cap text-[10px] text-[#8a8a8a] mt-1">Requests</p>
            </div>
          </div>
        </>
      )}
      <div
        className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1"
        role="tablist"
        aria-label="Friend sections"
      >
        {(
          [
            ["CREW", "Friends", connections?.friends.length ?? 0, Users],
            ["REQUESTS", "Requests", connections?.incoming.length ?? 0, UserPlus],
            ["DISCOVER", "Nearby", null, Search],
            ["GYM", "Gym", gymHub?.athletes.length ?? null, Building2],
          ] as const
        ).map(([id, label, count, Icon]) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                hapticSelection();
                setView(id);
              }}
              className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[8px] font-black uppercase tracking-[0.05em] transition-colors ${
                active ? "bg-accent-red text-white shadow-lg" : "text-grit-dim"
              }`}
            >
              <Icon size={13} /> {label}
              {count ? (
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[8px] ${
                    active ? "bg-white text-accent-red" : "bg-accent-red text-white"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {friendsError && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-accent-red/40 bg-accent-red/10 p-3"
        >
          <p className="text-xs font-bold text-grit">Friends couldn't refresh</p>
          <p className="mt-1 text-[10px] leading-relaxed text-grit-dim">{friendsError}</p>
          <button
            type="button"
            onClick={loadFriendsHome}
            className="btn-ghost mt-3 min-h-10 px-4 text-[10px]"
          >
            Try again
          </button>
        </div>
      )}

      {view === "REQUESTS" && connections && connections.incoming.length > 0 && (
        <div className="mb-4">
          <p className="label-cap mb-2 flex items-center gap-1.5 text-accent-red">
            <UserPlus size={11} /> Friend requests
          </p>
          {connections.incoming.map((person) => (
            <AthleteRow
              key={person.id}
              a={person}
              status="INCOMING"
              busy={busy === person.id}
              onToggle={() => changeConnection(person.id, "INCOMING")}
              onDecline={() => changeConnection(person.id, "INCOMING", "decline")}
            />
          ))}
        </div>
      )}

      {view === "REQUESTS" && connections && connections.outgoing.length > 0 && (
        <div className="mb-4">
          <p className="label-cap mb-2 flex items-center gap-1.5 text-grit-dim">
            <Send size={11} /> Sent requests
          </p>
          {connections.outgoing.map((person) => (
            <AthleteRow
              key={person.id}
              a={person}
              status="OUTGOING"
              busy={busy === person.id}
              onToggle={() => changeConnection(person.id, "OUTGOING")}
            />
          ))}
        </div>
      )}

      {view === "REQUESTS" &&
        connections &&
        connections.incoming.length === 0 &&
        connections.outgoing.length === 0 && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-grit-card p-6 text-center">
            <UserCheck size={24} className="mx-auto text-accent-red" />
            <p className="display mt-3 text-xl font-black uppercase text-grit">All caught up</p>
            <p className="mt-1 text-xs leading-relaxed text-grit-dim">
              Incoming requests and requests you have sent will live here.
            </p>
            <button
              type="button"
              onClick={() => setView("DISCOVER")}
              className="btn-ghost mt-4 min-h-11 w-full text-[10px]"
            >
              Find athletes
            </button>
          </div>
        )}

      {view === "CREW" && connections && connections.friends.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="label-cap flex items-center gap-1.5 text-grit">
              <Users size={11} className="text-accent-red" /> Your friends
            </p>
            <span className="label-cap text-[7px] text-grit-dim">TAP TO COMPARE</span>
          </div>
          {connections.friends.map((person) => (
            <AthleteRow
              key={person.id}
              a={person}
              status="FRIEND"
              busy={busy === person.id}
              onToggle={() => changeConnection(person.id, "FRIEND")}
            />
          ))}
        </div>
      )}

      {view === "CREW" && connections?.friends.length === 0 && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-grit-card p-6 text-center">
          <Users size={25} className="mx-auto text-accent-red" />
          <p className="display mt-3 text-xl font-black uppercase text-grit">
            Build your first crew
          </p>
          <p className="mt-1 text-xs leading-relaxed text-grit-dim">
            Add a gym mate to unlock side-by-side Strength Maps, PR comparisons and challenges.
          </p>
          <button
            type="button"
            onClick={() => setView("DISCOVER")}
            className="btn-grit mt-4 min-h-11 w-full text-[10px]"
          >
            Discover athletes
          </button>
        </div>
      )}

      {view === "GYM" && (
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-2xl border border-accent-red/45 bg-[linear-gradient(135deg,rgba(230,50,34,.2),rgba(12,12,13,.98)_62%)] p-4">
            <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-accent-red/20 blur-2xl" />
            <p className="label-cap flex items-center gap-1.5 text-[9px] text-accent-red">
              <Building2 size={12} /> LOCAL GYM HUB
            </p>
            <h3 className="display mt-1 text-2xl font-black uppercase leading-none text-white">
              {gymHub?.gymName ?? "Find your floor"}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-grit-dim">
              {myLoc?.city
                ? `See lifters and the weekly activity board at your gym in ${myLoc.city}.`
                : "Set your city first, then join your gym. DEADSET stores city-level location only."}
            </p>
            {gymHub?.gymName && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 label-cap text-[7px] text-white">
                  {gymHub.athletes.length} {gymHub.athletes.length === 1 ? "member" : "members"}
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 label-cap text-[7px] text-white">
                  Resets Monday
                </span>
              </div>
            )}
          </section>

          {!myLoc?.city ? (
            <button
              type="button"
              onClick={() => {
                hapticSelection();
                setView("DISCOVER");
              }}
              className="btn-grit min-h-12 w-full"
            >
              <MapPin size={14} className="mr-2 inline" /> Set my city
            </button>
          ) : (
            <section className="rounded-2xl border border-white/10 bg-grit-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="label-cap text-[9px] text-grit">
                    {gymHub?.gymName ? "CHANGE GYM" : "CHOOSE YOUR GYM"}
                  </p>
                  <p className="mt-1 text-[10px] text-grit-dim">
                    Public to athletes in {myLoc.city}; exact location is never shared.
                  </p>
                </div>
                {gymHub?.gymName && (
                  <button
                    type="button"
                    onClick={() => void leaveGym()}
                    disabled={gymBusy}
                    className="shrink-0 label-cap text-[8px] text-grit-dim"
                  >
                    Leave
                  </button>
                )}
              </div>
              <div className="grid min-w-0 grid-cols-[1fr_auto] gap-2">
                <input
                  ref={gymRef}
                  defaultValue={gymInput}
                  onChange={(event) => setGymInput(event.target.value)}
                  placeholder="e.g. PureGym Cheltenham"
                  className="input-grit min-w-0"
                  maxLength={80}
                  autoCapitalize="words"
                />
                <button
                  type="button"
                  onClick={() => void saveGym()}
                  disabled={gymBusy}
                  className="btn-grit min-h-11 px-4 text-[9px]"
                >
                  {gymBusy ? <Loader2 size={13} className="animate-spin" /> : "JOIN"}
                </button>
              </div>
              {gymError && (
                <p role="alert" className="mt-2 text-[10px] leading-relaxed text-accent-red">
                  {gymError}
                </p>
              )}
              {localGyms.length > 0 && (
                <div className="mt-3">
                  <p className="label-cap mb-2 text-[7px] text-grit-dim">
                    GYMS ATHLETES USE NEARBY
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {localGyms
                      .filter((gym) => gym.name !== gymHub?.gymName)
                      .slice(0, 4)
                      .map((gym) => (
                        <button
                          key={gym.key}
                          type="button"
                          onClick={() => {
                            setGymInput(gym.name);
                            if (gymRef.current) gymRef.current.value = gym.name;
                            void saveGym(gym.name);
                          }}
                          disabled={gymBusy}
                          className="press flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 text-left"
                        >
                          <span className="truncate text-xs font-bold text-grit">{gym.name}</span>
                          <span className="shrink-0 label-cap text-[7px] text-grit-dim">
                            {gym.memberCount} {gym.memberCount === 1 ? "lifter" : "lifters"}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {gymHub?.gymName && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="label-cap flex items-center gap-1.5 text-grit">
                    <Trophy size={11} className="text-accent-red" /> THIS WEEK
                  </p>
                  <p className="mt-1 text-[9px] text-grit-dim">
                    Ranked by verified workout activity, not likes.
                  </p>
                </div>
                {!isPro && !proLoading && (
                  <button
                    type="button"
                    onClick={() => openPaywall("leagues")}
                    className="label-cap flex items-center gap-1 text-[8px] text-pro"
                  >
                    <Crown size={10} /> Full board
                  </button>
                )}
              </div>
              {gymHub.athletes.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-grit-card p-5 text-center">
                  <Dumbbell size={22} className="mx-auto text-accent-red" />
                  <p className="display mt-3 text-lg font-black uppercase text-grit">
                    Log the first session
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-grit-dim">
                    Your gym board wakes up when a verified workout is saved this week.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(isPro ? gymHub.athletes : gymHub.athletes.slice(0, 3)).map((athlete) => (
                    <GymRankingRow
                      key={athlete.id}
                      athlete={athlete}
                      status={
                        statusById.get(athlete.id) ?? (athlete.following ? "OUTGOING" : "NONE")
                      }
                      busy={busy === athlete.id}
                      onToggle={() =>
                        changeConnection(
                          athlete.id,
                          statusById.get(athlete.id) ?? (athlete.following ? "OUTGOING" : "NONE"),
                        )
                      }
                    />
                  ))}
                  {!isPro && !proLoading && gymHub.athletes.length > 3 && (
                    <button
                      type="button"
                      onClick={() => openPaywall("leagues")}
                      className="press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-pro/30 bg-pro/10 label-cap text-[9px] text-pro"
                    >
                      <Lock size={12} /> Unlock all {gymHub.athletes.length} gym ranks
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {view === "DISCOVER" && (
        <>
          {/* Location card */}
          <div className="bg-grit-card border border-grit rounded-2xl p-4 mb-4">
            <p className="label-cap mb-2 flex items-center gap-2">
              <MapPin size={12} className="text-accent-red" /> Your city
            </p>
            {myLoc?.city ? (
              <p className="text-sm text-grit mb-3 break-words">
                <span className="font-bold">{myLoc.city}</span>
                {myLoc.country ? `, ${myLoc.country}` : ""}
              </p>
            ) : (
              <p className="text-xs text-[#8a8a8a] mb-3">
                Add your city to find lifters near you. City only — never exact location.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-2 mb-2">
              <input
                ref={cityRef}
                defaultValue={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="City"
                className="input-grit min-w-0"
                maxLength={80}
              />
              <input
                ref={countryRef}
                defaultValue={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                placeholder="Country"
                className="input-grit min-w-0"
                maxLength={80}
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={saveCity}
                disabled={locBusy}
                className="btn-grit flex-1 py-2 text-xs"
              >
                {locBusy ? <Loader2 size={12} className="animate-spin" /> : "Save"}
              </button>
              <button
                onClick={useGPS}
                disabled={locBusy}
                className="btn-ghost px-3 py-2 text-xs flex items-center gap-1.5"
              >
                <MapPin size={12} /> Use GPS
              </button>
            </div>
            {locationError && (
              <p role="alert" className="mt-2 text-[10px] leading-relaxed text-accent-red">
                {locationError}
              </p>
            )}
          </div>

          {/* Nearby */}
          {nearby?.myCity && (
            <>
              <p className="label-cap text-[#8a8a8a] mb-2 flex items-center gap-1">
                <MapPin size={10} /> In {nearby.myCity}
              </p>
              {nearby.athletes.length === 0 ? (
                <p className="bg-grit-card border border-grit p-4 text-xs text-[#8a8a8a] text-center mb-4">
                  No one else here yet — invite a gym mate.
                </p>
              ) : (
                <div className="mb-4">
                  {nearby.athletes.map((a) => (
                    <AthleteRow
                      key={a.id}
                      a={a}
                      status={statusById.get(a.id) ?? (a.following ? "OUTGOING" : "NONE")}
                      busy={busy === a.id}
                      onToggle={() =>
                        changeConnection(
                          a.id,
                          statusById.get(a.id) ?? (a.following ? "OUTGOING" : "NONE"),
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* search */}
          <div className="bg-grit-card border border-grit p-3 mb-2 flex items-center gap-2">
            <Search size={16} className="text-[#8a8a8a]" />
            <input
              defaultValue={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or @username"
              className="input-grit flex-1 border-0 bg-transparent"
              maxLength={80}
            />
            {searchBusy && <Loader2 size={15} className="shrink-0 animate-spin text-accent-red" />}
          </div>

          {searchError && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-accent-red/40 bg-accent-red/10 p-3"
            >
              <p className="text-xs text-grit">
                Search couldn't load. Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => void retrySearch()}
                className="mt-2 text-[10px] font-black uppercase tracking-wider text-accent-red"
              >
                Retry search
              </button>
            </div>
          )}

          {results && results.length === 0 && (
            <p className="text-center text-sm text-[#8a8a8a] py-6">No athletes match "{q}".</p>
          )}

          {results &&
            results.map((r) => (
              <AthleteRow
                key={r.id}
                a={r}
                status={statusById.get(r.id) ?? (r.following ? "OUTGOING" : "NONE")}
                busy={busy === r.id}
                onToggle={() =>
                  changeConnection(
                    r.id,
                    statusById.get(r.id) ?? (r.following ? "OUTGOING" : "NONE"),
                  )
                }
              />
            ))}

          {!results && (
            <>
              <p className="label-cap text-[#8a8a8a] mb-2 mt-2">Suggested rivals</p>
              {!suggested && (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin text-accent-red" />
                </div>
              )}
              {suggested && suggested.length === 0 && (
                <p className="text-sm text-[#8a8a8a] text-center py-4">
                  No suggestions yet — invite mates to get started.
                </p>
              )}
              {suggested &&
                suggested.map((r) => (
                  <AthleteRow
                    key={r.id}
                    a={{ ...r, following: false }}
                    status={statusById.get(r.id) ?? "NONE"}
                    busy={busy === r.id}
                    onToggle={() => changeConnection(r.id, statusById.get(r.id) ?? "NONE")}
                  />
                ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function AthleteRow({
  a,
  status,
  busy,
  onToggle,
  onDecline,
}: {
  a: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    level: string | null;
    following?: boolean;
    grit_points?: number | null;
    bio?: string | null;
    city?: string | null;
    country?: string | null;
    public_stats?: Record<string, unknown> | null;
  };
  status: FriendStatus;
  busy: boolean;
  onToggle: () => void;
  onDecline?: () => void;
}) {
  const overall = Number(a.public_stats?.overall) || 0;
  const streak = Number(a.public_stats?.streak) || 0;
  const location = [a.city, a.country].filter(Boolean).join(", ");
  return (
    <div className="mb-2 flex items-center gap-3 rounded-2xl border border-grit bg-grit-card p-3 shadow-[0_14px_32px_rgba(0,0,0,0.18)]">
      <Link
        to="/athlete/$id"
        params={{ id: a.id }}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-grit bg-[#1a1a1a] display font-extrabold text-grit">
          {a.avatar_url ? (
            <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            (a.display_name || a.username || "A")[0]
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-grit text-sm truncate">
            {a.display_name || a.username || "Athlete"}
          </p>
          <p className="text-[10px] text-[#8a8a8a] label-cap truncate">
            {a.username ? `@${a.username} · ` : ""}
            {a.level}
          </p>
          <div className="mt-1 flex items-center gap-2 overflow-hidden text-[9px] font-bold text-grit-dim">
            {overall > 0 && <span className="text-accent-red">{overall} OVR</span>}
            {streak > 0 && (
              <span className="flex items-center gap-0.5">
                <Flame size={9} className="text-accent-red" /> {streak}d
              </span>
            )}
            {location && (
              <span className="flex min-w-0 items-center gap-0.5 truncate">
                <MapPin size={9} /> {location}
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {status === "INCOMING" && onDecline && (
          <button
            type="button"
            onClick={() => {
              hapticSelection();
              onDecline();
            }}
            disabled={busy}
            className="grid h-10 w-10 place-items-center rounded-lg border border-grit text-grit-dim press"
            aria-label="Decline friend request"
          >
            <X size={13} />
          </button>
        )}
        <button
          onClick={() => {
            hapticSelection();
            onToggle();
          }}
          disabled={busy}
          className={`px-3 py-2 text-xs flex min-h-10 items-center gap-1.5 ${
            status === "NONE" || status === "INCOMING" ? "btn-grit" : "btn-ghost"
          }`}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : status === "FRIEND" ? (
            <>
              <UserCheck size={12} /> FRIENDS
            </>
          ) : status === "INCOMING" ? (
            <>
              <UserPlus size={12} /> ACCEPT
            </>
          ) : status === "OUTGOING" ? (
            <>
              <Check size={12} /> REQUESTED
            </>
          ) : (
            <>
              <UserPlus size={12} /> ADD
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function GymRankingRow({
  athlete,
  status,
  busy,
  onToggle,
}: {
  athlete: GymAthlete;
  status: FriendStatus;
  busy: boolean;
  onToggle: () => void;
}) {
  const medal =
    athlete.gymRank === 1
      ? "#f4c33a"
      : athlete.gymRank === 2
        ? "#c8cbd2"
        : athlete.gymRank === 3
          ? "#c27a43"
          : null;
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 ${
        athlete.isMe ? "border-accent-red/45 bg-accent-red/[.08]" : "border-white/10 bg-grit-card"
      }`}
    >
      <div
        className="display grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/30 text-lg font-black"
        style={{ color: medal ?? "#8a8a8a" }}
        aria-label={`Rank ${athlete.gymRank}`}
      >
        {athlete.gymRank}
      </div>
      <Link
        to="/athlete/$id"
        params={{ id: athlete.id }}
        className="flex min-w-0 flex-1 items-center gap-2.5"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] display font-black text-grit">
          {athlete.avatar_url ? (
            <img src={athlete.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (athlete.display_name || athlete.username || "A")[0]
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-grit">
            {athlete.display_name || athlete.username || "Athlete"}
            {athlete.isMe ? " · You" : ""}
          </p>
          <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wider text-grit-dim">
            {athlete.weeklyVolumeKg.toLocaleString()} kg · {athlete.weeklyPrs} PR
            {athlete.weeklyPrs === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
      <div className="shrink-0 text-right">
        <p className="display text-lg font-black leading-none text-accent-red">
          {athlete.weeklyScore}
        </p>
        <p className="label-cap mt-0.5 text-[6px] text-grit-dim">WEEK PTS</p>
      </div>
      {!athlete.isMe && (
        <button
          type="button"
          onClick={() => {
            hapticSelection();
            onToggle();
          }}
          disabled={busy}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            status === "NONE" || status === "INCOMING"
              ? "bg-accent-red text-white"
              : "border border-white/10 text-grit-dim"
          }`}
          aria-label={
            status === "FRIEND"
              ? "Remove friend"
              : status === "INCOMING"
                ? "Accept friend request"
                : status === "OUTGOING"
                  ? "Cancel friend request"
                  : "Add friend"
          }
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : status === "FRIEND" ? (
            <UserCheck size={14} />
          ) : status === "OUTGOING" ? (
            <Check size={14} />
          ) : (
            <UserPlus size={14} />
          )}
        </button>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
