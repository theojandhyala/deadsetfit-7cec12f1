import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { restoreSupabaseSession, supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/account-restore";
import { getInviteUrl } from "@/lib/referral";
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
  toggleFollow,
  getMyFollowStats,
  updateMyLocation,
  getMyLocation,
  getNearbyAthletes,
  type FeedScope,
} from "@/lib/social.functions";
import { RankShareCard } from "@/components/RankShareCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_tabs/friends")({
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

type Tab = "FRIENDS" | "FEED" | "ARENA" | "INVITE";

function FriendsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<{ userId: string } | null | "loading">("loading");
  const [tab, setTab] = useState<Tab>("FRIENDS");

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
          <h1 className="display text-4xl font-extrabold text-grit leading-none mt-1">YOUR CREW</h1>
        </div>
        <NotificationsBell />
      </header>
      <div className="px-5 mt-3 flex gap-2 border-b border-grit overflow-x-auto">
        {(["FRIENDS", "FEED", "ARENA", "INVITE"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="label-cap pb-3 pt-1 border-b-2 whitespace-nowrap"
            style={{
              borderColor: tab === t ? "#e63222" : "transparent",
              color: tab === t ? "#f5f5f0" : "#8a8a8a",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tab === "FEED" && <Feed userId={session.userId} />}
        {tab === "FRIENDS" && <Friends />}
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
  const [scope, setScope] = useState<FeedScope>("global");

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
            : "Feed is empty. Be the first to post."}
        </div>
      )}

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
                  <FeedStat label="Exercises" v={Number((p.metadata as { exercises?: number }).exercises) || 0} />
                  <FeedStat label="Sets" v={Number((p.metadata as { sets?: number }).sets) || 0} />
                  <FeedStat
                    label="Volume"
                    v={`${Math.round((Number((p.metadata as { volume?: number }).volume) || 0) / 1000 * 10) / 10}t`}
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
              <Link to="/athlete/$id" params={{ id: c.author.id }} className="font-bold text-grit press">
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
        <button onClick={send} disabled={busy || !text.trim()} className="btn-grit px-3">
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
  switch (l) {
    case "ELITE":
      return "#a78bfa";
    case "DIAMOND":
      return "#67e8f9";
    case "GOLD":
      return "#fbbf24";
    case "SILVER":
      return "#cbd5e1";
    default:
      return "#b45309";
  }
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
      {/* Pro status */}
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
          <p className="text-sm text-[#8a8a8a]">Free tier. Earn Pro by inviting mates.</p>
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
          const labels: Record<number, string> = { 1: "First Recruit", 3: "Squad Builder", 5: "Recruiter", 10: "Ambassador", 25: "Legend" };
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
                    <div className="h-full bg-accent-red rounded-full" style={{ width: `${Math.round(prog * 100)}%` }} />
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

const COUNTRY_ALIASES: Record<string, string> = {
  "united kingdom of great britain and northern ireland": "United Kingdom",
  "russian federation": "Russia",
  "korea, republic of": "South Korea",
  "korea (the republic of)": "South Korea",
  "korea, democratic people's republic of": "North Korea",
  "iran, islamic republic of": "Iran",
  "syrian arab republic": "Syria",
  "viet nam": "Vietnam",
  "czechia": "Czech Republic",
  "türkiye": "Turkey",
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

function Friends() {
  const _search = searchAthletes;
  const _suggest = getSuggestedAthletes;
  const _toggle = toggleFollow;
  const _stats = getMyFollowStats;
  const _nearby = getNearbyAthletes;
  const _getLoc = getMyLocation;
  const _setLoc = updateMyLocation;

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [suggested, setSuggested] = useState<Suggested[] | null>(null);
  const [stats, setStats] = useState<{ following: number; followers: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Awaited<ReturnType<typeof getNearbyAthletes>> | null>(null);
  const [myLoc, setMyLoc] = useState<{ city: string | null; country: string | null } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [countryInput, setCountryInput] = useState("");
  // These DOM-owned fields are also set programmatically (initial load, GPS,
  // normalize-on-save), so their .value must be synced imperatively — a
  // defaultValue alone only applies at mount.
  const cityRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);

  const loadFriendsHome = useCallback(() => {
    _suggest()
      .then(setSuggested)
      .catch(() => {
        // Failed suggestions render as an empty list, not an endless spinner.
        setSuggested((cur) => cur ?? []);
      });
    _stats()
      .then(setStats)
      .catch(() => {});
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
      .catch(() => {});
    _nearby()
      .then(setNearby)
      .catch(() => {});
  }, [_getLoc, _nearby, _stats, _suggest]);

  useEffect(() => {
    loadFriendsHome();
  }, [loadFriendsHome]);

  const runSearch = useCallback(async () => {
    return _search({ data: { q: q.trim() } });
  }, [_search, q]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        setResults(await runSearch());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Search failed");
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q, runSearch]);

  async function follow(id: string, currentlyFollowing: boolean) {
    setBusy(id);
    setResults(
      (arr) =>
        arr?.map((r) => (r.id === id ? { ...r, following: !currentlyFollowing } : r)) ?? null,
    );
    setSuggested((arr) => arr?.filter((r) => r.id !== id) ?? null);
    setNearby((n) =>
      n
        ? {
            ...n,
            athletes: n.athletes.map((a) =>
              a.id === id ? { ...a, following: !currentlyFollowing } : a,
            ),
          }
        : n,
    );
    try {
      await _toggle({ data: { userId: id } });
      setStats((s) => (s ? { ...s, following: s.following + (currentlyFollowing ? -1 : 1) } : s));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      // Revert the optimistic flip — the server recorded nothing.
      setResults(
        (arr) =>
          arr?.map((r) => (r.id === id ? { ...r, following: currentlyFollowing } : r)) ?? null,
      );
      setNearby((n) =>
        n
          ? {
              ...n,
              athletes: n.athletes.map((a) =>
                a.id === id ? { ...a, following: currentlyFollowing } : a,
              ),
            }
          : n,
      );
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
      const j = await r.json();
      const city = j.city || j.locality || j.principalSubdivision || "";
      const country = normalizeCountry(j.countryName) || j.countryName || "";
      if (!city || !country) throw new Error("Couldn't resolve city");
      setCityInput(city);
      setCountryInput(country);
      if (cityRef.current) cityRef.current.value = city;
      if (countryRef.current) countryRef.current.value = country;
      await _setLoc({ data: { city, country, region: j.principalSubdivision || null } });
      toast.success(`Set to ${city}, ${country}`);
      setMyLoc({ city, country });
      setNearby(await _nearby());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Location denied");
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
    try {
      const city = cityInput.trim();
      const country = normalizeCountry(countryInput) || countryInput.trim();
      setCountryInput(country);
      if (countryRef.current) countryRef.current.value = country;
      await _setLoc({
        data: { city, country, region: null },
      });
      setMyLoc({ city, country });
      toast.success("Saved");
      setNearby(await _nearby());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLocBusy(false);
    }
  }

  return (
    <div className="px-5 pb-6">
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

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-grit-card border border-grit rounded-2xl p-3 text-center">
          <p className="display font-extrabold text-grit text-2xl leading-none">
            {stats?.following ?? "—"}
          </p>
          <p className="label-cap text-[10px] text-[#8a8a8a] mt-1">Following</p>
        </div>
        <div className="bg-grit-card border border-grit rounded-2xl p-3 text-center">
          <p className="display font-extrabold text-grit text-2xl leading-none">
            {stats?.followers ?? "—"}
          </p>
          <p className="label-cap text-[10px] text-[#8a8a8a] mt-1">Followers</p>
        </div>
      </div>

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
          <button onClick={saveCity} disabled={locBusy} className="btn-grit flex-1 py-2 text-xs">
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
                  busy={busy === a.id}
                  onToggle={() => follow(a.id, a.following)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* search */}
      <div className="bg-grit-card border border-grit p-3 mb-4 flex items-center gap-2">
        <Search size={16} className="text-[#8a8a8a]" />
        <input
          defaultValue={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or @username"
          className="input-grit flex-1 border-0 bg-transparent"
          maxLength={40}
        />
      </div>

      {results && results.length === 0 && (
        <p className="text-center text-sm text-[#8a8a8a] py-6">No athletes match "{q}".</p>
      )}

      {results &&
        results.map((r) => (
          <AthleteRow
            key={r.id}
            a={r}
            busy={busy === r.id}
            onToggle={() => follow(r.id, r.following)}
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
                busy={busy === r.id}
                onToggle={() => follow(r.id, false)}
              />
            ))}
        </>
      )}
    </div>
  );
}

function AthleteRow({
  a,
  busy,
  onToggle,
}: {
  a: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    level: string | null;
    following: boolean;
    grit_points?: number | null;
  };
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-grit-card border border-grit p-3 mb-2 flex items-center gap-3">
      <Link
        to="/athlete/$id"
        params={{ id: a.id }}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="w-10 h-10 bg-[#1a1a1a] border border-grit flex items-center justify-center display font-extrabold text-grit overflow-hidden">
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
            {a.grit_points ? ` · ${a.grit_points} DS` : ""}
          </p>
        </div>
      </Link>
      <button
        onClick={onToggle}
        disabled={busy}
        className={
          a.following
            ? "btn-ghost px-3 py-2 text-xs flex items-center gap-1.5"
            : "btn-grit px-3 py-2 text-xs flex items-center gap-1.5"
        }
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" />
        ) : a.following ? (
          <>
            <UserCheck size={12} /> FOLLOWING
          </>
        ) : (
          <>
            <UserPlus size={12} /> FOLLOW
          </>
        )}
      </button>
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
