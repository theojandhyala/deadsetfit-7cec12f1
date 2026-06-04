import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Heart, MessageCircle, Trophy, Share2, Loader2, Send, Plus, Gift, Copy, Check, Crown, Users, Search, UserPlus, UserCheck, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getFeed, createPost, toggleLike, addComment, getComments,
  getLeaderboard, getMyReferralInfo, redeemReferral, updateMyProfile,
  searchAthletes, getSuggestedAthletes, toggleFollow, getMyFollowStats,
  updateMyLocation, getMyLocation, getNearbyAthletes,
} from "@/lib/social.functions";
import { RankShareCard } from "@/components/RankShareCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_tabs/friends")({
  head: () => ({ meta: [{ title: "DEADSET — Friends" }] }),
  component: FriendsPage,
});

type Tab = "FEED" | "FRIENDS" | "LEAGUE" | "INVITE";

function FriendsPage() {
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
          <p className="label-cap">FRIENDS</p>
          <h1 className="display text-5xl font-extrabold text-grit leading-none mt-1">FIND YOUR<br/>FRIENDS.</h1>
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
        <p className="label-cap">FRIENDS</p>
        <h1 className="display text-4xl font-extrabold text-grit leading-none mt-1">YOUR CREW</h1>
      </header>
      <div className="px-5 mt-4 flex gap-2 border-b border-grit overflow-x-auto">
        {(["FEED", "FRIENDS", "LEAGUE", "INVITE"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="label-cap pb-3 pt-1 border-b-2 whitespace-nowrap"
            style={{ borderColor: tab === t ? "#e63222" : "transparent", color: tab === t ? "#f5f5f0" : "#8a8a8a" }}>
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
  const [sharing, setSharing] = useState(false);

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
          rank={data.me.rank || 0}
          league={data.me.league}
          points={data.me.grit_points ?? 0}
          displayName={data.me.display_name || "Athlete"}
          username={data.me.username}
          onClose={() => setSharing(false)}
        />
      )}

      <div className="bg-grit-card border border-grit">
        {data.top.length === 0 && <p className="p-5 text-sm text-[#8a8a8a] text-center">No athletes yet.</p>}
        {data.top.slice(0, 50).map(p => (
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
                {p.username ? `@${p.username} · ` : ""}<span style={{ color: leagueColor(p.league) }}>{p.league}</span>
              </p>
            </div>
            <span className="display font-extrabold text-accent-red text-base">{p.grit_points}</span>
          </Link>
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

// ============ FRIENDS ============
type SearchHit = Awaited<ReturnType<typeof searchAthletes>>[number];
type Suggested = Awaited<ReturnType<typeof getSuggestedAthletes>>[number];

function Friends() {
  const _search = useServerFn(searchAthletes);
  const _suggest = useServerFn(getSuggestedAthletes);
  const _toggle = useServerFn(toggleFollow);
  const _stats = useServerFn(getMyFollowStats);
  const _nearby = useServerFn(getNearbyAthletes);
  const _getLoc = useServerFn(getMyLocation);
  const _setLoc = useServerFn(updateMyLocation);

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

  useEffect(() => {
    _suggest().then(setSuggested).catch(() => {});
    _stats().then(setStats).catch(() => {});
    _getLoc().then((l) => { setMyLoc({ city: l.city, country: l.country }); setCityInput(l.city ?? ""); setCountryInput(l.country ?? ""); }).catch(() => {});
    _nearby().then(setNearby).catch(() => {});
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const id = setTimeout(async () => {
      try { setResults(await _search({ data: { q: q.trim() } })); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Search failed"); }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  async function follow(id: string, currentlyFollowing: boolean) {
    setBusy(id);
    setResults(arr => arr?.map(r => r.id === id ? { ...r, following: !currentlyFollowing } : r) ?? null);
    setSuggested(arr => arr?.filter(r => r.id !== id) ?? null);
    setNearby(n => n ? { ...n, athletes: n.athletes.map(a => a.id === id ? { ...a, following: !currentlyFollowing } : a) } : n);
    try {
      await _toggle({ data: { userId: id } });
      setStats(s => s ? { ...s, following: s.following + (currentlyFollowing ? -1 : 1) } : s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(null); }
  }

  async function useGPS() {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
      );
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`);
      const j = await r.json();
      const city = j.city || j.locality || j.principalSubdivision || "";
      const country = j.countryName || "";
      if (!city || !country) throw new Error("Couldn't resolve city");
      setCityInput(city); setCountryInput(country);
      await _setLoc({ data: { city, country, region: j.principalSubdivision || null } });
      toast.success(`Set to ${city}, ${country}`);
      setMyLoc({ city, country });
      setNearby(await _nearby());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Location denied");
    } finally { setLocBusy(false); }
  }

  async function saveCity() {
    if (!cityInput.trim() || !countryInput.trim()) { toast.error("City and country required"); return; }
    setLocBusy(true);
    try {
      await _setLoc({ data: { city: cityInput.trim(), country: countryInput.trim(), region: null } });
      setMyLoc({ city: cityInput.trim(), country: countryInput.trim() });
      toast.success("Saved");
      setNearby(await _nearby());
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLocBusy(false); }
  }

  return (
    <div className="px-5 pb-6">
      {/* stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-grit-card border border-grit p-3 text-center">
          <p className="display font-extrabold text-grit text-2xl leading-none">{stats?.following ?? "—"}</p>
          <p className="label-cap text-[10px] text-[#8a8a8a] mt-1">Following</p>
        </div>
        <div className="bg-grit-card border border-grit p-3 text-center">
          <p className="display font-extrabold text-grit text-2xl leading-none">{stats?.followers ?? "—"}</p>
          <p className="label-cap text-[10px] text-[#8a8a8a] mt-1">Followers</p>
        </div>
      </div>

      {/* Location card */}
      <div className="bg-grit-card border border-grit p-4 mb-4">
        <p className="label-cap mb-2 flex items-center gap-2"><MapPin size={12} className="text-accent-red" /> Your city</p>
        {myLoc?.city ? (
          <p className="text-sm text-grit mb-3"><span className="font-bold">{myLoc.city}</span>{myLoc.country ? `, ${myLoc.country}` : ""}</p>
        ) : (
          <p className="text-xs text-[#8a8a8a] mb-3">Add your city to find lifters near you. City only — never exact location.</p>
        )}
        <div className="flex gap-2 mb-2">
          <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="City" className="input-grit flex-1" maxLength={80} />
          <input value={countryInput} onChange={(e) => setCountryInput(e.target.value)} placeholder="Country" className="input-grit w-28" maxLength={80} />
        </div>
        <div className="flex gap-2">
          <button onClick={saveCity} disabled={locBusy} className="btn-grit flex-1 py-2 text-xs">{locBusy ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
          <button onClick={useGPS} disabled={locBusy} className="btn-ghost px-3 py-2 text-xs flex items-center gap-1.5"><MapPin size={12} /> Use GPS</button>
        </div>
      </div>

      {/* Nearby */}
      {nearby?.myCity && (
        <>
          <p className="label-cap text-[#8a8a8a] mb-2 flex items-center gap-1"><MapPin size={10} /> In {nearby.myCity}</p>
          {nearby.athletes.length === 0 ? (
            <p className="bg-grit-card border border-grit p-4 text-xs text-[#8a8a8a] text-center mb-4">No one else here yet — invite a gym mate.</p>
          ) : (
            <div className="mb-4">
              {nearby.athletes.map(a => (
                <AthleteRow key={a.id} a={a} busy={busy === a.id} onToggle={() => follow(a.id, a.following)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* search */}
      <div className="bg-grit-card border border-grit p-3 mb-4 flex items-center gap-2">
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

      {results && results.map(r => (
        <AthleteRow key={r.id} a={r} busy={busy === r.id} onToggle={() => follow(r.id, r.following)} />
      ))}

      {!results && (
        <>
          <p className="label-cap text-[#8a8a8a] mb-2 mt-2">Suggested rivals</p>
          {!suggested && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-accent-red" /></div>}
          {suggested && suggested.length === 0 && (
            <p className="text-sm text-[#8a8a8a] text-center py-4">No suggestions yet — invite mates to get started.</p>
          )}
          {suggested && suggested.map(r => (
            <AthleteRow key={r.id} a={{ ...r, following: false }} busy={busy === r.id} onToggle={() => follow(r.id, false)} />
          ))}
        </>
      )}
    </div>
  );
}

function AthleteRow({ a, busy, onToggle }: {
  a: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; level: string | null; following: boolean; grit_points?: number | null };
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-grit-card border border-grit p-3 mb-2 flex items-center gap-3">
      <Link to="/athlete/$id" params={{ id: a.id }} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 bg-[#1a1a1a] border border-grit flex items-center justify-center display font-extrabold text-grit overflow-hidden">
          {a.avatar_url ? <img src={a.avatar_url} alt="" className="w-full h-full object-cover" /> : (a.display_name || a.username || "A")[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-grit text-sm truncate">{a.display_name || a.username || "Athlete"}</p>
          <p className="text-[10px] text-[#8a8a8a] label-cap truncate">
            {a.username ? `@${a.username} · ` : ""}{a.level}{a.grit_points ? ` · ${a.grit_points} DS` : ""}
          </p>
        </div>
      </Link>
      <button
        onClick={onToggle}
        disabled={busy}
        className={a.following ? "btn-ghost px-3 py-2 text-xs flex items-center gap-1.5" : "btn-grit px-3 py-2 text-xs flex items-center gap-1.5"}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> :
          a.following ? <><UserCheck size={12} /> FOLLOWING</> : <><UserPlus size={12} /> FOLLOW</>}
      </button>
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
