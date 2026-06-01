import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Heart, MessageCircle, Trophy, Share2, Loader2, Send, Plus, Gift, Copy, Check, Crown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getFeed, createPost, toggleLike, addComment, getComments,
  getLeaderboard, getMyReferralInfo, redeemReferral, updateMyProfile,
} from "@/lib/social.functions";
import { RankShareCard } from "@/components/RankShareCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_tabs/squad")({
  head: () => ({ meta: [{ title: "DEADSET — Squad" }] }),
  component: SquadPage,
});

type Tab = "FEED" | "LEAGUE" | "INVITE";

function SquadPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<{ userId: string } | null | "loading">("loading");
  const [tab, setTab] = useState<Tab>("FEED");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? { userId: data.session.user.id } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ? { userId: s.user.id } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === "loading") {
    return <div className="flex items-center justify-center pt-20"><Loader2 className="animate-spin text-accent-red" /></div>;
  }

  if (!session) {
    return (
      <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="px-6 pt-10">
        <header className="mb-8">
          <p className="label-cap">SQUAD</p>
          <h1 className="display text-5xl font-extrabold text-grit leading-none mt-1">FIND YOUR<br/>PACK.</h1>
        </header>
        <div className="bg-grit-card border border-grit p-6">
          <p className="text-sm text-[#8a8a8a] mb-4">Sign in to share lifts, climb leagues and invite mates.</p>
          <button onClick={() => navigate({ to: "/auth" })} className="btn-grit w-full py-3 label-cap">Sign in / Create account</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-2">
        <p className="label-cap">SQUAD</p>
        <h1 className="display text-4xl font-extrabold text-grit leading-none mt-1">THE PACK</h1>
      </header>
      <div className="px-5 mt-4 flex gap-2 border-b border-grit">
        {(["FEED", "LEAGUE", "INVITE"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="label-cap pb-3 pt-1 border-b-2"
            style={{ borderColor: tab === t ? "#e63222" : "transparent", color: tab === t ? "#f5f5f0" : "#8a8a8a" }}>
            {t}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tab === "FEED" && <Feed userId={session.userId} />}
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
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);

  async function load() {
    try {
      const r = await _getFeed();
      setPosts(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feed failed");
    }
  }
  useEffect(() => { load(); }, []);

  async function publish() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await _createPost({ data: { kind: "text", content: text.trim(), metadata: {} } });
      setText(""); setComposing(false);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setPosting(false); }
  }

  async function like(p: FeedPost) {
    // optimistic
    setPosts(arr => arr?.map(x => x.id === p.id ? { ...x, liked: !x.liked, likeCount: x.likeCount + (x.liked ? -1 : 1) } : x) ?? null);
    try { await _toggleLike({ data: { postId: p.id } }); }
    catch { load(); }
  }

  async function share(p: FeedPost) {
    const url = window.location.href;
    if (navigator.share) try { await navigator.share({ title: "DEADSET", text: p.content, url }); return; } catch { /* user cancelled */ }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  if (!posts) return <div className="px-5 pt-10 flex justify-center"><Loader2 className="animate-spin text-accent-red" /></div>;

  return (
    <div className="px-5 pb-6">
      {!composing ? (
        <button onClick={() => setComposing(true)} className="w-full mb-4 bg-grit-card border border-grit p-4 flex items-center gap-3 text-left">
          <div className="w-9 h-9 bg-accent-red flex items-center justify-center"><Plus size={16} className="text-grit" /></div>
          <span className="text-sm text-[#8a8a8a]">Drop a lift, PR or thought…</span>
        </button>
      ) : (
        <div className="mb-4 bg-grit-card border border-grit p-4">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500}
            placeholder="What did you smash today?" className="input-grit w-full resize-none" />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-[#8a8a8a]">{text.length}/500</span>
            <div className="flex gap-2">
              <button onClick={() => { setComposing(false); setText(""); }} className="btn-ghost px-3 py-1.5 text-xs">Cancel</button>
              <button onClick={publish} disabled={posting || !text.trim()} className="btn-grit px-4 py-1.5 text-xs">
                {posting ? <Loader2 size={12} className="animate-spin" /> : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div className="bg-grit-card border border-grit p-6 text-center text-sm text-[#8a8a8a]">
          Feed is empty. Be the first to post.
        </div>
      )}

      {posts.map((p) => (
        <article key={p.id} className="bg-grit-card border border-grit p-4 mb-3">
          <header className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#1a1a1a] border border-grit flex items-center justify-center display font-extrabold text-grit">
              {(p.author.display_name || "A")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-grit text-sm truncate">{p.author.display_name || "Athlete"}</p>
              <p className="text-[10px] text-[#8a8a8a] label-cap">
                {p.author.username ? `@${p.author.username} · ` : ""}{p.author.level} · {timeAgo(p.created_at)}
              </p>
            </div>
            {p.kind !== "text" && (
              <span className="label-cap text-[9px] px-2 py-0.5 border border-accent-red text-accent-red">{p.kind}</span>
            )}
          </header>
          {p.image_url && <img src={p.image_url} alt="" className="w-full mb-3 border border-grit" />}
          {p.content && <p className="text-sm text-grit mb-3 whitespace-pre-wrap">{p.content}</p>}
          {p.kind === "pr" && p.metadata && typeof p.metadata === "object" && "lift" in p.metadata && (
            <div className="border border-accent-red p-3 mb-3 flex items-center gap-3">
              <Trophy className="text-accent-red" size={20} />
              <div>
                <p className="label-cap text-accent-red">NEW PR</p>
                <p className="display font-extrabold text-grit text-xl leading-none">
                  {String((p.metadata as { lift?: string }).lift)} · {String((p.metadata as { weight?: number }).weight)}kg
                </p>
              </div>
            </div>
          )}
          <footer className="flex items-center gap-5 text-[#8a8a8a]">
            <button onClick={() => like(p)} className="flex items-center gap-1.5 text-xs">
              <Heart size={16} fill={p.liked ? "#e63222" : "none"} color={p.liked ? "#e63222" : "currentColor"} />
              {p.likeCount}
            </button>
            <button onClick={() => setOpenComments(openComments === p.id ? null : p.id)} className="flex items-center gap-1.5 text-xs">
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

function CommentsPanel({ postId, onPosted }: { postId: string; onPosted: () => void }) {
  const _get = useServerFn(getComments);
  const _add = useServerFn(addComment);
  const [items, setItems] = useState<Awaited<ReturnType<typeof getComments>> | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setItems(await _get({ data: { postId } })); } catch { /* */ }
  }
  useEffect(() => { load(); }, [postId]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await _add({ data: { postId, content: text.trim() } });
      setText("");
      await load();
      onPosted();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3 pt-3 border-t border-grit">
      {!items ? <Loader2 className="animate-spin text-[#8a8a8a]" size={14} /> :
        items.length === 0 ? <p className="text-xs text-[#8a8a8a]">No comments yet.</p> :
        items.map(c => (
          <div key={c.id} className="mb-2 text-xs">
            <span className="font-bold text-grit">{c.author?.display_name || "User"}</span>
            <span className="text-[#8a8a8a] ml-2">{c.content}</span>
          </div>
        ))
      }
      <div className="flex gap-2 mt-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" maxLength={500}
          className="input-grit flex-1 text-xs" />
        <button onClick={send} disabled={busy || !text.trim()} className="btn-grit px-3"><Send size={12} /></button>
      </div>
    </div>
  );
}

// ============ LEAGUE ============
function League({ userId }: { userId: string }) {
  const _get = useServerFn(getLeaderboard);
  const [data, setData] = useState<Awaited<ReturnType<typeof getLeaderboard>> | null>(null);

  useEffect(() => { _get().then(setData).catch(() => toast.error("Leaderboard failed")); }, []);

  if (!data) return <div className="px-5 pt-10 flex justify-center"><Loader2 className="animate-spin text-accent-red" /></div>;

  return (
    <div className="px-5 pb-6">
      {/* My league card */}
      {data.me && (
        <div className="bg-grit-card border border-grit p-5 mb-4 flex items-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center" style={{ background: leagueColor(data.me.league) }}>
            <Crown size={28} className="text-grit-bg" style={{ color: "#0a0a0a" }} />
          </div>
          <div className="flex-1">
            <p className="label-cap" style={{ color: leagueColor(data.me.league) }}>{data.me.league} LEAGUE</p>
            <p className="display font-extrabold text-grit text-3xl leading-none">#{data.me.rank || "—"}</p>
            <p className="text-xs text-[#8a8a8a]">{data.me.grit_points} DS pts</p>
          </div>
        </div>
      )}

      <div className="bg-grit-card border border-grit">
        {data.top.length === 0 && <p className="p-5 text-sm text-[#8a8a8a] text-center">No athletes yet.</p>}
        {data.top.slice(0, 50).map(p => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-grit last:border-b-0"
            style={{ background: p.id === userId ? "rgba(230,50,34,0.08)" : undefined }}>
            <div className="display font-extrabold text-grit text-lg w-7 text-center">
              {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : p.rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-grit text-sm truncate">{p.display_name || "Athlete"}</p>
              <p className="text-[10px] text-[#8a8a8a] label-cap">
                {p.username ? `@${p.username} · ` : ""}<span style={{ color: leagueColor(p.league) }}>{p.league}</span>
              </p>
            </div>
            <span className="display font-extrabold text-accent-red text-base">{p.grit_points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function leagueColor(l: string) {
  switch (l) {
    case "ELITE": return "#a78bfa";
    case "DIAMOND": return "#67e8f9";
    case "GOLD": return "#fbbf24";
    case "SILVER": return "#cbd5e1";
    default: return "#b45309";
  }
}

// ============ INVITE ============
function Invite() {
  const _info = useServerFn(getMyReferralInfo);
  const _redeem = useServerFn(redeemReferral);
  const _profile = useServerFn(updateMyProfile);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getMyReferralInfo>> | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => { _info().then(setInfo).catch(() => toast.error("Failed")); }, []);

  async function copy() {
    if (!info?.code) return;
    await navigator.clipboard.writeText(`${window.location.origin}/?ref=${info.code}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await _redeem({ data: { code: code.trim() } });
      toast.success("Both got 30 days Pro!");
      setCode("");
      setInfo(await _info());
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
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
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (!info) return <div className="px-5 pt-10 flex justify-center"><Loader2 className="animate-spin text-accent-red" /></div>;

  return (
    <div className="px-5 pb-6 space-y-4">
      {/* Pro status */}
      <div className="bg-grit-card border border-grit p-5">
        <p className="label-cap text-accent-red mb-1">DEADSET PRO</p>
        {info.proUntil && new Date(info.proUntil) > new Date() ? (
          <>
            <p className="display font-extrabold text-grit text-3xl leading-none">ACTIVE</p>
            <p className="text-xs text-[#8a8a8a] mt-1">Until {new Date(info.proUntil).toLocaleDateString()}</p>
          </>
        ) : (
          <p className="text-sm text-[#8a8a8a]">Free tier. Earn Pro by inviting mates.</p>
        )}
      </div>

      {/* Username */}
      <div className="bg-grit-card border border-grit p-5">
        <p className="label-cap mb-2 flex items-center gap-2"><Users size={12} /> Public username</p>
        <div className="flex gap-2">
          <input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            placeholder="yourname" maxLength={24} className="input-grit flex-1" />
          <button onClick={saveUsername} disabled={busy || !username} className="btn-grit px-3">Save</button>
        </div>
        <p className="text-[10px] text-[#8a8a8a] mt-1">Shown on your posts and league entries.</p>
      </div>

      {/* Your invite code */}
      <div className="bg-grit-card border border-accent-red p-5">
        <div className="flex items-center gap-2 mb-2">
          <Gift size={14} className="text-accent-red" />
          <p className="label-cap text-accent-red">Invite a mate, both get 30 days Pro</p>
        </div>
        <div className="display font-extrabold text-grit text-4xl leading-none my-3 tracking-wider">{info.code}</div>
        <button onClick={copy} className="btn-grit w-full py-2 flex items-center justify-center gap-2">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="label-cap text-xs">{copied ? "Copied" : "Copy invite link"}</span>
        </button>
        <p className="text-xs text-[#8a8a8a] mt-3">You've invited <span className="text-grit font-bold">{info.count}</span> mate(s).</p>
      </div>

      {/* Redeem */}
      <div className="bg-grit-card border border-grit p-5">
        <p className="label-cap mb-2">Got a code from a mate?</p>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE"
            maxLength={16} className="input-grit flex-1 tracking-wider" />
          <button onClick={redeem} disabled={busy || !code} className="btn-grit px-4">
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Redeem"}
          </button>
        </div>
      </div>

      <Link to="/profile" className="block text-center label-cap text-[#8a8a8a] mt-6">Manage account →</Link>
    </div>
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
