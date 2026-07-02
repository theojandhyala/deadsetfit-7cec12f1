import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getFeed,
  createPost,
  toggleLike,
  addComment,
  getComments,
  getLeaderboard,
  getMyReferralInfo,
  redeemReferral,

  searchAthletes,
  getSuggestedAthletes,
  toggleFollow,
  getMyFollowStats,
  getMyFollowing,
  updateMyLocation,
  getMyLocation,
  getNearbyAthletes,
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

type Tab = "FRIENDS" | "FEED" | "LEAGUE" | "INVITE";

function FriendsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<{ userId: string } | null | "loading">("loading");
  const [tab, setTab] = useState<Tab>("FRIENDS");
  const [globalQ, setGlobalQ] = useState("");
  const [globalResults, setGlobalResults] = useState<SearchHit[] | null>(null);
  const [globalFollowed, setGlobalFollowed] = useState<Set<string>>(new Set());
  const _searchGlobal = useServerFn(searchAthletes);
  const _toggleGlobal = useServerFn(toggleFollow);

  useEffect(() => {
    if (globalQ.trim().length < 2) {
      setGlobalResults(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        setGlobalResults(await _searchGlobal({ data: { q: globalQ.trim() } }));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [globalQ]);

  useEffect(() => {
    let cancelled = false;
    // Timeout fallback: if session check hangs >4s, treat as unauthenticated
    // so user sees the sign-in prompt instead of a blank loading screen.
    const timeout = setTimeout(() => {
      if (!cancelled) setSession((s) => (s === "loading" ? null : s));
    }, 4000);

    supabase.auth
      .getSession()
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
        <Loader2 className="animate-spin text-[#E10600]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="px-6 pt-10">
        <header className="mb-8">
          <p className="label-cap">FRIENDS</p>
          <h1 className="display text-5xl font-extrabold text-white leading-none mt-1">
            FIND YOUR
            <br />
            FRIENDS.
          </h1>
        </header>
        <div className="rounded-2xl p-6">
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
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-2">
        <p className="label-cap">FRIENDS</p>
        <h1 className="display text-4xl font-extrabold text-white leading-none mt-1">YOUR CREW</h1>
      </header>

      {/* Prominent global search — always visible above tabs */}
      <div className="px-5 mt-4 relative">
        <div className="flex items-center gap-2 rounded-2xl bg-grit-card px-3 py-2.5">
          <Search size={16} className="text-[#E10600] shrink-0" />
          <input
            value={globalQ}
            onChange={(e) => setGlobalQ(e.target.value)}
            placeholder="Search athletes by username..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#8A8A8A] outline-none"
            maxLength={40}
          />
          {globalQ && (
            <button
              onClick={() => {
                setGlobalQ("");
                setGlobalResults(null);
              }}
              className="text-[#8A8A8A] hover:text-grit"
            >
              ✕
            </button>
          )}
        </div>
        {globalResults && globalResults.length > 0 && (
          <div className="absolute left-5 right-5 top-full z-20 rounded-2xl border-t-0 bg-[#0a0a0a] shadow-xl">
            {globalResults.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-grit last:border-b-0"
              >
                <Link
                  to="/athlete/$id"
                  params={{ id: r.id }}
                  onClick={() => {
                    setGlobalQ("");
                    setGlobalResults(null);
                  }}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-8 h-8 bg-[#0A0A0A] rounded-2xl flex items-center justify-center display font-extrabold text-white text-xs overflow-hidden shrink-0">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (r.display_name || r.username || "A")[0]
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {r.display_name || r.username || "Athlete"}
                    </p>
                    <p className="text-[10px] label-cap text-[#8A8A8A] truncate">
                      {r.username ? `@${r.username} · ` : ""}
                      {r.level}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={async () => {
                    const wasFollowing = r.following || globalFollowed.has(r.id);
                    if (!wasFollowing) {
                      setGlobalFollowed((prev) => new Set([...prev, r.id]));
                      try {
                        await _toggleGlobal({ data: { userId: r.id } });
                      } catch {
                        setGlobalFollowed((prev) => {
                          const s = new Set(prev);
                          s.delete(r.id);
                          return s;
                        });
                      }
                    }
                  }}
                  className={`label-cap text-[9px] px-2 py-1 border shrink-0 ${r.following || globalFollowed.has(r.id) ? "border-grit text-[#8A8A8A]" : "border-[#E10600] text-[#E10600]"}`}
                >
                  {r.following || globalFollowed.has(r.id) ? "Following ✓" : "+ Follow"}
                </button>
              </div>
            ))}
          </div>
        )}
        {globalResults && globalResults.length === 0 && (
          <div className="absolute left-5 right-5 top-full z-20 rounded-2xl border-t-0 bg-[#0a0a0a] p-4 text-sm text-[#8A8A8A] text-center">
            No athletes found for "{globalQ}"
          </div>
        )}
      </div>

      <div className="px-5 mt-4 flex gap-2 overflow-x-auto" style={{ borderBottom: "1px solid #262626" }}>
        {(["FRIENDS", "FEED", "LEAGUE", "INVITE"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="label-cap pb-3 pt-1 border-b-2 whitespace-nowrap"
            style={{
              borderColor: tab === t ? "#E10600" : "transparent",
              color: tab === t ? "#f5f5f0" : "#8A8A8A",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tab === "FEED" && <Feed userId={session.userId} />}
        {tab === "FRIENDS" && <Friends />}
        {tab === "LEAGUE" && <League userId={session.userId} />}
        {tab === "INVITE" && <Invite />}
      </div>
    </div>
  );
}

// ============ FEED ============
type FeedPost = Awaited<ReturnType<typeof getFeed>>[number];

function Feed({ userId }: { userId: string }) {
  const _getFeed = useServerFn(getFeed);
  const _createPost = useServerFn(createPost);
  const _toggleLike = useServerFn(toggleLike);
  const _toggleFollow = useServerFn(toggleFollow);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [postKind, setPostKind] = useState<"text" | "pr">("text");
  const [text, setText] = useState("");
  const [prLift, setPrLift] = useState("");
  const [prWeight, setPrWeight] = useState("");
  const [prReps, setPrReps] = useState("");
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  async function load() {
    try {
      const r = await _getFeed();
      setPosts(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feed failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

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

  async function followFromFeed(authorId: string) {
    setFollowedIds((prev) => new Set([...prev, authorId]));
    try {
      await _toggleFollow({ data: { userId: authorId } });
    } catch {
      setFollowedIds((prev) => {
        const s = new Set(prev);
        s.delete(authorId);
        return s;
      });
    }
  }

  async function share(p: FeedPost) {
    const url = window.location.href;
    if (navigator.share)
      try {
        await navigator.share({ title: "DEADSET", text: p.content, url });
        return;
      } catch {
        /* user cancelled */
      }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  if (!posts)
    return (
      <div className="px-5 pt-10 flex justify-center">
        <Loader2 className="animate-spin text-[#E10600]" />
      </div>
    );

  return (
    <div className="px-5 pb-6">
      {!composing ? (
        <button
          onClick={() => setComposing(true)}
          className="w-full mb-4 rounded-2xl p-4 flex items-center gap-3 text-left"
        >
          <div className="w-9 h-9 bg-[#E10600] flex items-center justify-center">
            <Plus size={16} className="text-white" />
          </div>
          <span className="text-sm text-[#8a8a8a]">Drop a lift, PR or thought…</span>
        </button>
      ) : (
        <div className="mb-4 rounded-2xl p-4">
          <div className="flex gap-2 mb-3">
            {(["text", "pr"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setPostKind(k)}
                className="label-cap px-3 py-1 border"
                style={{
                  borderColor: postKind === k ? "#E10600" : "#262626",
                  color: postKind === k ? "#E10600" : "#8A8A8A",
                }}
              >
                {k === "text" ? "POST" : "NEW PR"}
              </button>
            ))}
          </div>
          {postKind === "pr" && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input
                value={prLift}
                onChange={(e) => setPrLift(e.target.value)}
                placeholder="Bench"
                maxLength={20}
                className="input-grit text-xs col-span-3"
              />
              <input
                value={prWeight}
                onChange={(e) => setPrWeight(e.target.value)}
                inputMode="decimal"
                placeholder="kg"
                className="input-grit text-xs col-span-2"
              />
              <input
                value={prReps}
                onChange={(e) => setPrReps(e.target.value)}
                inputMode="numeric"
                placeholder="reps"
                className="input-grit text-xs"
              />
            </div>
          )}
          <textarea
            value={text}
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
        <div className="bg-grit-card border border-grit p-8 flex flex-col items-center text-center gap-4 rounded-2xl">
          <div className="p-4 border border-grit text-grit-dim rounded-2xl">
            <Users size={32} />
          </div>
          <div>
            <p className="display text-lg font-extrabold uppercase text-grit tracking-wide">
              Feed is quiet
            </p>
            <p className="text-xs text-grit-dim mt-1 uppercase tracking-wider">
              Follow athletes or drop the first post
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setComposing(true)}
              className="bg-accent-red text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-accent-red/90 rounded-2xl"
            >
              Post something
            </button>
          </div>
        </div>
      )}

      {posts.map((p) => (
        <article key={p.id} className="rounded-2xl p-4 mb-3">
          <header className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#0A0A0A] rounded-2xl flex items-center justify-center display font-extrabold text-grit">
              {(p.author.display_name || "A")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-white text-sm truncate">
                  {p.author.display_name || "Athlete"}
                </p>
                {p.author.id !== userId && !followedIds.has(p.author.id) && (
                  <button
                    onClick={() => followFromFeed(p.author.id)}
                    className="label-cap text-[9px] px-2 py-0.5 rounded-2xl text-[#E10600] flex items-center gap-1"
                  >
                    <UserPlus size={9} /> FOLLOW
                  </button>
                )}
                {p.author.id !== userId && followedIds.has(p.author.id) && (
                  <span className="label-cap text-[9px] px-2 py-0.5 rounded-2xl text-[#8A8A8A]">
                    Following ✓
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#8a8a8a] label-cap">
                {p.author.username ? `@${p.author.username} · ` : ""}
                {p.author.level} · {timeAgo(p.created_at)}
              </p>
            </div>
            {p.kind !== "text" && (
              <span className="label-cap text-[9px] px-2 py-0.5 rounded-2xl text-[#E10600]">
                {p.kind}
              </span>
            )}
          </header>
          {p.image_url && (
            <img src={p.image_url} alt="" className="w-full mb-3 rounded-2xl" />
          )}
          {p.content && <p className="text-sm text-white mb-3 whitespace-pre-wrap">{p.content}</p>}
          {p.kind === "pr" &&
            p.metadata &&
            typeof p.metadata === "object" &&
            "lift" in p.metadata && (
              <div className="rounded-2xl p-3 mb-3 flex items-center gap-3">
                <Trophy className="text-[#E10600]" size={20} />
                <div>
                  <p className="label-cap text-[#E10600]">NEW PR</p>
                  <p className="display font-extrabold text-white text-xl leading-none">
                    {String((p.metadata as { lift?: string }).lift)} ·{" "}
                    {String((p.metadata as { weight?: number }).weight)}kg
                  </p>
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
              <div className="absolute -top-12 left-0 bg-grit-card rounded-2xl px-2 py-1.5 flex gap-2 z-10 shadow-lg">
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
  const _get = useServerFn(getComments);
  const _add = useServerFn(addComment);
  const [items, setItems] = useState<Awaited<ReturnType<typeof getComments>> | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setItems(await _get({ data: { postId } }));
    } catch {
      /* */
    }
  }
  useEffect(() => {
    load();
  }, [postId]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await _add({ data: { postId, content: text.trim() } });
      setText("");
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
            <span className="font-bold text-grit">{c.author?.display_name || "User"}</span>
            <span className="text-[#8a8a8a] ml-2">{c.content}</span>
          </div>
        ))
      )}
      <div className="flex gap-2 mt-2">
        <input
          value={text}
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
  const _get = useServerFn(getLeaderboard);
  const [data, setData] = useState<Awaited<ReturnType<typeof getLeaderboard>> | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    _get()
      .then(setData)
      .catch(() => toast.error("Leaderboard failed"));
  }, []);

  if (!data)
    return (
      <div className="px-5 pt-10 flex justify-center">
        <Loader2 className="animate-spin text-[#E10600]" />
      </div>
    );

  return (
    <div className="px-5 pb-6">
      {/* My league card */}
      {data.me && (
        <div className="rounded-2xl p-5 mb-4 flex items-center gap-4">
          <div
            className="w-16 h-16 flex items-center justify-center"
            style={{ background: leagueColor(data.me.league) }}
          >
            <Crown size={28} className="text-grit-bg" style={{ color: "#0A0A0A" }} />
          </div>
          <div className="flex-1">
            <p className="label-cap" style={{ color: leagueColor(data.me.league) }}>
              {data.me.league} LEAGUE
            </p>
            <p className="display font-extrabold text-white text-3xl leading-none">
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
        className="bg-grit-card rounded-2xl mb-3 px-4 py-3 flex items-center gap-3 hover:bg-[#0A0A0A] transition-colors"
      >
        <Trophy size={18} className="text-[#E10600]" />
        <div className="flex-1">
          <p className="label-cap text-[#E10600] text-[11px]">STRENGTH LEADERBOARD</p>
          <p className="text-xs text-[#8A8A8A]">
            Ranked by Overall · Bench · Squat · Deadlift · Total
          </p>
        </div>
        <span className="label-cap text-[#8A8A8A] text-[10px]">VIEW →</span>
      </Link>

      <div className="rounded-2xl">
        {data.top.length === 0 && (
          <p className="p-5 text-sm text-[#8a8a8a] text-center">No athletes yet.</p>
        )}
        {data.top.slice(0, 50).map((p) => (
          <Link
            key={p.id}
            to="/athlete/$id"
            params={{ id: p.id }}
            className="flex items-center gap-3 px-4 py-3 border-b border-grit last:border-b-0 hover:bg-[#0A0A0A]"
            style={{ background: p.id === userId ? "rgba(230,50,34,0.08)" : undefined }}
          >
            <div className="display font-extrabold text-white text-lg w-7 text-center">
              {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : p.rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{p.display_name || "Athlete"}</p>
              <p className="text-[10px] text-[#8a8a8a] label-cap">
                {p.username ? `@${p.username} · ` : ""}
                <span style={{ color: leagueColor(p.league) }}>{p.league}</span>
              </p>
            </div>
            <span className="display font-extrabold text-[#E10600] text-base">
              {p.grit_points}
            </span>
          </Link>
        ))}
      </div>
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
  const _info = useServerFn(getMyReferralInfo);
  const _redeem = useServerFn(redeemReferral);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getMyReferralInfo>> | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    _info()
      .then(setInfo)
      .catch(() => toast.error("Failed"));
  }, []);

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
      setInfo(await _info());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!info)
    return (
      <div className="px-5 pt-10 flex justify-center">
        <Loader2 className="animate-spin text-[#E10600]" />
      </div>
    );

  return (
    <div className="px-5 pb-6 space-y-4">
      {/* Pro status */}
      <div className="rounded-2xl p-5">
        <p className="label-cap text-[#E10600] mb-1">DEADSET PRO</p>
        {info.proUntil && new Date(info.proUntil) > new Date() ? (
          <>
            <p className="display font-extrabold text-white text-3xl leading-none">ACTIVE</p>
            <p className="text-xs text-[#8a8a8a] mt-1">
              Until {new Date(info.proUntil).toLocaleDateString()}
            </p>
          </>
        ) : (
          <p className="text-sm text-[#8a8a8a]">Free tier. Earn Pro by inviting mates.</p>
        )}
      </div>

      {/* Your invite code */}
      <div className="bg-grit-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Gift size={14} className="text-[#E10600]" />
          <p className="label-cap text-[#E10600]">Invite a mate, both get 30 days Pro</p>
        </div>
        <div className="display font-extrabold text-white text-4xl leading-none my-3 tracking-wider">
          {info.code}
        </div>
        <button
          onClick={copy}
          className="btn-grit w-full py-2 flex items-center justify-center gap-2"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="label-cap text-xs">{copied ? "Copied" : "Copy invite link"}</span>
        </button>
        <p className="text-xs text-[#8a8a8a] mt-3">
          You've invited <span className="text-grit font-bold">{info.count}</span> mate(s).
        </p>
      </div>

      {/* Redeem */}
      <div className="rounded-2xl p-5">
        <p className="label-cap mb-2">Got a code from a mate?</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
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
type NearbyData = Awaited<ReturnType<typeof getNearbyAthletes>>;
type NearbyAthlete = NearbyData["athletes"][number];

type FollowingUser = Awaited<ReturnType<typeof getMyFollowing>>[number];

function Friends() {
  const _search = useServerFn(searchAthletes);
  const _suggest = useServerFn(getSuggestedAthletes);
  const _toggle = useServerFn(toggleFollow);
  const _stats = useServerFn(getMyFollowStats);
  const _nearby = useServerFn(getNearbyAthletes);
  const _getLoc = useServerFn(getMyLocation);
  const _setLoc = useServerFn(updateMyLocation);
  const _getFollowing = useServerFn(getMyFollowing);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [suggested, setSuggested] = useState<Suggested[] | null>(null);
  const [following, setFollowing] = useState<FollowingUser[] | null>(null);
  const [stats, setStats] = useState<{ following: number; followers: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyData | null>(null);
  const [myLoc, setMyLoc] = useState<{ city: string | null; country: string | null } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [countryInput, setCountryInput] = useState("");

  useEffect(() => {
    _suggest()
      .then(setSuggested)
      .catch(() => {});
    _stats()
      .then(setStats)
      .catch(() => {});
    _getFollowing()
      .then(setFollowing)
      .catch(() => setFollowing([]));
    _getLoc()
      .then((l) => {
        setMyLoc({ city: l.city, country: l.country });
        setCityInput(l.city ?? "");
        setCountryInput(l.country ?? "");
      })
      .catch(() => {});
    _nearby()
      .then(setNearby)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        setResults(await _search({ data: { q: q.trim() } }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Search failed");
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  async function follow(id: string, currentlyFollowing: boolean, userData?: { username: string | null; display_name: string | null; avatar_url: string | null; level: string | null; grit_points?: number | null }) {
    setBusy(id);
    setResults(
      (arr) =>
        arr?.map((r) => (r.id === id ? { ...r, following: !currentlyFollowing } : r)) ?? null,
    );
    if (!currentlyFollowing) {
      setSuggested((arr) => arr?.filter((r) => r.id !== id) ?? null);
      if (userData) {
        setFollowing((arr) => [...(arr ?? []), { id, following: true, ...userData, grit_points: userData.grit_points ?? null }]);
      } else {
        _getFollowing().then(setFollowing).catch(() => {});
      }
    } else {
      setFollowing((arr) => arr?.filter((r) => r.id !== id) ?? null);
      setSuggested((arr) => arr ?? []);
    }
    setNearby((n) =>
      n
        ? {
            ...n,
            athletes: n.athletes.map((a: NearbyAthlete) =>
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
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`,
      );
      const j = await r.json();
      const city = j.city || j.locality || j.principalSubdivision || "";
      const country = j.countryName || "";
      if (!city || !country) throw new Error("Couldn't resolve city");
      setCityInput(city);
      setCountryInput(country);
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
      await _setLoc({
        data: { city: cityInput.trim(), country: countryInput.trim(), region: null },
      });
      setMyLoc({ city: cityInput.trim(), country: countryInput.trim() });
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
      {/* stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-2xl p-3 text-center">
          <p className="display font-extrabold text-white text-2xl leading-none">
            {stats?.following ?? "—"}
          </p>
          <p className="label-cap text-[10px] text-[#8a8a8a] mt-1">Following</p>
        </div>
        <div className="rounded-2xl p-3 text-center">
          <p className="display font-extrabold text-white text-2xl leading-none">
            {stats?.followers ?? "—"}
          </p>
          <p className="label-cap text-[10px] text-[#8a8a8a] mt-1">Followers</p>
        </div>
      </div>

      {/* Location card */}
      <div className="rounded-2xl p-4 mb-4">
        <p className="label-cap mb-2 flex items-center gap-2">
          <MapPin size={12} className="text-[#E10600]" /> Your city
        </p>
        {myLoc?.city ? (
          <p className="text-sm text-white mb-3">
            <span className="font-bold">{myLoc.city}</span>
            {myLoc.country ? `, ${myLoc.country}` : ""}
          </p>
        ) : (
          <p className="text-xs text-[#8a8a8a] mb-3">
            Add your city to find lifters near you. City only — never exact location.
          </p>
        )}
        <div className="flex gap-2 mb-2">
          <input
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="City"
            className="input-grit flex-1"
            maxLength={80}
          />
          <input
            value={countryInput}
            onChange={(e) => setCountryInput(e.target.value)}
            placeholder="Country"
            className="input-grit w-28"
            maxLength={80}
          />
        </div>
        <div className="flex gap-2">
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
            <p className="rounded-2xl p-4 text-xs text-[#8a8a8a] text-center mb-4">
              No one else here yet — invite a gym mate.
            </p>
          ) : (
            <div className="mb-4">
              {nearby.athletes.map((a: NearbyAthlete) => (
                <AthleteRow
                  key={a.id}
                  a={a}
                  busy={busy === a.id}
                  onToggle={() => follow(a.id, a.following, a)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* search */}
      <div className="rounded-2xl p-3 mb-4 flex items-center gap-2">
        <Search size={16} className="text-[#8a8a8a]" />
        <input
          value={q}
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
            onToggle={() => follow(r.id, r.following, r)}
          />
        ))}

      {!results && (
        <>
          {/* Following list */}
          {(following === null || following.length > 0) && (
            <div className="mb-5">
              <p className="label-cap text-[#8a8a8a] mb-2 flex items-center gap-1.5">
                <UserCheck size={10} /> Following
              </p>
              {following === null && (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin text-[#E10600]" size={18} />
                </div>
              )}
              {following && following.map((r) => (
                <AthleteRow
                  key={r.id}
                  a={r}
                  busy={busy === r.id}
                  onToggle={() => follow(r.id, true, r)}
                />
              ))}
            </div>
          )}

          {/* Suggested rivals */}
          <p className="label-cap text-[#8a8a8a] mb-2 mt-2">Suggested rivals</p>
          {!suggested && (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-[#E10600]" />
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
                onToggle={() => follow(r.id, false, r)}
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
  mutuals,
}: {
  a: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    level: string | null;
    following: boolean;
    grit_points?: number | null;
    topPR?: { label: string; value: number; unit: string } | null;
  };
  busy: boolean;
  onToggle: () => void;
  mutuals?: number;
}) {
  return (
    <div className="rounded-2xl p-3 mb-2">
      <div className="flex items-center gap-3">
        <Link
          to="/athlete/$id"
          params={{ id: a.id }}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <div className="w-10 h-10 bg-[#0A0A0A] rounded-2xl flex items-center justify-center display font-extrabold text-white overflow-hidden">
            {a.avatar_url ? (
              <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              (a.display_name || a.username || "A")[0]
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm truncate">
              {a.display_name || a.username || "Athlete"}
            </p>
            <p className="text-[10px] text-[#8a8a8a] label-cap truncate">
              {a.username ? `@${a.username} · ` : ""}
              {a.level}
              {a.grit_points ? ` · ${a.grit_points} DS` : ""}
            </p>
            {mutuals && mutuals > 0 ? (
              <p className="text-[10px] text-[#E10600] label-cap mt-0.5">
                {mutuals} mutual{mutuals > 1 ? "s" : ""}
              </p>
            ) : null}
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
      {a.topPR && a.topPR.value > 0 && (
        <div className="mt-2 flex items-center justify-between">
          <span className="label-cap text-[9px] text-[#8A8A8A]">
            Top PR:{" "}
            <span className="text-white">
              {a.topPR.label} {a.topPR.value}
              {a.topPR.unit}
            </span>
          </span>
          <Link
            to="/athlete/$id"
            params={{ id: a.id }}
            className="label-cap text-[9px] text-[#E10600]"
          >
            View Profile →
          </Link>
        </div>
      )}
      {!a.topPR && (
        <div className="mt-1.5 flex justify-end">
          <Link
            to="/athlete/$id"
            params={{ id: a.id }}
            className="label-cap text-[9px] text-[#8A8A8A]"
          >
            View Profile →
          </Link>
        </div>
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
