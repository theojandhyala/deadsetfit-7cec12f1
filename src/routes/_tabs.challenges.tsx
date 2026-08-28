import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Trophy,
  Flame,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Plus,
  Minus,
  Zap,
  ArrowLeft,
  Swords,
  TrendingUp,
  Crown,
  ChevronRight,
  Search,
} from "lucide-react";
import { useAppState } from "@/lib/storage";
import { usePro } from "@/hooks/usePro";
import { isoDay } from "@/lib/calc";
import { openPaywall } from "@/lib/paywall-events";
import type { ChallengeRecord } from "@/lib/types";
import { createPost, searchAthletes } from "@/lib/social.functions";
import { DuelsPanel } from "@/components/DuelsPanel";
import { toast } from "sonner";

export const Route = createFileRoute("/_tabs/challenges")({
  head: () => ({ meta: [{ title: "DEADSET — Challenges" }] }),
  component: ChallengesPage,
});

type Challenge = {
  id: string;
  name: string;
  tagline: string;
  type: "time" | "reps";
  target: number;
  xp: number;
  tier: "EASY" | "BEAST" | "GOD" | "ELITE";
};

const CHALLENGES: Challenge[] = [
  {
    id: "plank-1min",
    name: "60-Second Plank",
    tagline: "The entry test.",
    type: "time",
    target: 60,
    xp: 40,
    tier: "EASY",
  },
  {
    id: "dead-hang",
    name: "60s Dead Hang",
    tagline: "Grip of steel.",
    type: "time",
    target: 60,
    xp: 50,
    tier: "EASY",
  },
  {
    id: "squats-50",
    name: "50 Squats Speed Run",
    tagline: "Beat your clock.",
    type: "time",
    target: 90,
    xp: 50,
    tier: "EASY",
  },
  {
    id: "pushups-30",
    name: "30 Push-ups Unbroken",
    tagline: "No stops. No drops.",
    type: "reps",
    target: 30,
    xp: 40,
    tier: "EASY",
  },
  {
    id: "situps-50",
    name: "50 Sit-ups",
    tagline: "Core check.",
    type: "reps",
    target: 50,
    xp: 40,
    tier: "EASY",
  },
  {
    id: "jumping-jacks-100",
    name: "100 Jumping Jacks",
    tagline: "Cardio warm-up.",
    type: "time",
    target: 90,
    xp: 30,
    tier: "EASY",
  },
  {
    id: "plank-5min",
    name: "5-Minute Plank",
    tagline: "Brace. Breathe. Don't break.",
    type: "time",
    target: 300,
    xp: 150,
    tier: "BEAST",
  },
  {
    id: "wall-sit-2min",
    name: "2-Minute Wall Sit",
    tagline: "Quads on fire.",
    type: "time",
    target: 120,
    xp: 80,
    tier: "BEAST",
  },
  {
    id: "hollow-hold",
    name: "90s Hollow Hold",
    tagline: "Ab killer.",
    type: "time",
    target: 90,
    xp: 70,
    tier: "BEAST",
  },
  {
    id: "pushups-max",
    name: "Max Push-ups",
    tagline: "One set. No rest. Go.",
    type: "reps",
    target: 50,
    xp: 60,
    tier: "BEAST",
  },
  {
    id: "pullups-max",
    name: "Max Pull-ups",
    tagline: "Strict. No kipping.",
    type: "reps",
    target: 15,
    xp: 80,
    tier: "BEAST",
  },
  {
    id: "burpees-50",
    name: "50 Burpees For Time",
    tagline: "Lungs vs legs.",
    type: "time",
    target: 300,
    xp: 100,
    tier: "BEAST",
  },
  {
    id: "lunges-100",
    name: "100 Walking Lunges",
    tagline: "Glutes will hate you.",
    type: "reps",
    target: 100,
    xp: 90,
    tier: "BEAST",
  },
  {
    id: "farmers-90s",
    name: "90s Farmer's Carry",
    tagline: "Grip + heart.",
    type: "time",
    target: 90,
    xp: 80,
    tier: "BEAST",
  },
  {
    id: "plank-10min",
    name: "10-Minute Plank",
    tagline: "Legends only.",
    type: "time",
    target: 600,
    xp: 300,
    tier: "GOD",
  },
  {
    id: "burpees-100",
    name: "100 Burpees",
    tagline: "Time attack. Survive.",
    type: "time",
    target: 600,
    xp: 120,
    tier: "GOD",
  },
  {
    id: "pullups-30",
    name: "30 Strict Pull-ups",
    tagline: "Unbroken or bust.",
    type: "reps",
    target: 30,
    xp: 200,
    tier: "GOD",
  },
  {
    id: "pushups-100",
    name: "100 Push-ups Unbroken",
    tagline: "No knee drops.",
    type: "reps",
    target: 100,
    xp: 180,
    tier: "GOD",
  },
  {
    id: "deadhang-2min",
    name: "2-Minute Dead Hang",
    tagline: "Shoulders & soul.",
    type: "time",
    target: 120,
    xp: 150,
    tier: "GOD",
  },
  {
    id: "murph",
    name: "Murph (Time)",
    tagline: "1mi · 100 pull · 200 push · 300 sq · 1mi",
    type: "time",
    target: 2700,
    xp: 500,
    tier: "GOD",
  },
  // === ELITE — Pro-exclusive tests ===
  {
    id: "elite-pushups-100",
    name: "100 Push-Ups Unbroken",
    tagline: "One set. No knees. No mercy.",
    type: "reps",
    target: 100,
    xp: 300,
    tier: "ELITE",
  },
  {
    id: "elite-plank-10min",
    name: "10-Minute Plank",
    tagline: "The mind quits before the core.",
    type: "time",
    target: 600,
    xp: 500,
    tier: "ELITE",
  },
  {
    id: "elite-pullups-21",
    name: "21 Strict Pull-Ups",
    tagline: "Dead hang to chin-over. Every rep.",
    type: "reps",
    target: 21,
    xp: 400,
    tier: "ELITE",
  },
  {
    id: "elite-wallsit-5min",
    name: "5-Minute Wall Sit",
    tagline: "Quads of concrete or bust.",
    type: "time",
    target: 300,
    xp: 350,
    tier: "ELITE",
  },
  {
    id: "elite-squats-500",
    name: "500 Squats For Time",
    tagline: "The leg day final boss.",
    type: "time",
    target: 1800,
    xp: 450,
    tier: "ELITE",
  },
];

const TIER_COLOR = { EASY: "#60a5fa", BEAST: "#fbbf24", GOD: "#e63222", ELITE: "#a855f7" };
// "Elite" is deliberately not labelled "Pro" — this label renders on iOS, where
// every tier is free, so a "Pro" suffix would imply paid content (Guideline 3.1.1).
const TIER_LABEL = { EASY: "Entry", BEAST: "Beast", GOD: "God Tier", ELITE: "Elite" };

// "Finish the work, beat the clock" challenges: LOWER time is better. Holds
// (plank, dead hang, wall sit, carries) stay higher-is-better.
const RACE_IDS = new Set(["burpees-50", "burpees-100", "murph"]);
function lowerIsBetter(id: string) {
  return RACE_IDS.has(id);
}
function beatsTarget(id: string, value: number, target: number) {
  return lowerIsBetter(id) ? value <= target : value >= target;
}

function bestRecord(records: ChallengeRecord[] | undefined, id: string) {
  const list = (records || []).filter((r) => r.challengeId === id);
  if (!list.length) return null;
  return list.reduce((b, r) =>
    lowerIsBetter(id) ? (r.value < b.value ? r : b) : r.value > b.value ? r : b,
  );
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function getWeekBounds(offsetWeeks = 0) {
  const now = new Date();
  const dow = now.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now);
  mon.setDate(now.getDate() + toMon + offsetWeeks * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

type Tab = "GRIND" | "H2H" | "WARS";

function ChallengesPage() {
  const [state] = useAppState();
  const { isPro, loading: proLoading } = usePro();
  const eliteLocked = !proLoading && !isPro;
  const [active, setActive] = useState<Challenge | null>(null);
  const [tab, setTab] = useState<Tab>("GRIND");
  const [filter, setFilter] = useState<"ALL" | "EASY" | "BEAST" | "GOD" | "ELITE" | "BEATEN">(
    "ALL",
  );

  const filtered = CHALLENGES.filter((c) => {
    if (filter === "ALL") return true;
    if (filter === "BEATEN") {
      const b = bestRecord(state.challengeRecords, c.id);
      return b && beatsTarget(c.id, b.value, c.target);
    }
    return c.tier === filter;
  });

  const beatenCount = CHALLENGES.filter((c) => {
    const b = bestRecord(state.challengeRecords, c.id);
    return b && beatsTarget(c.id, b.value, c.target);
  }).length;

  const TABS: { id: Tab; icon: typeof Flame; label: string }[] = [
    { id: "GRIND", icon: Flame, label: "Grind" },
    { id: "H2H", icon: Swords, label: "Head-2-Head" },
    { id: "WARS", icon: TrendingUp, label: "Weekly Wars" },
  ];

  return (
    <div className="deadset-page pb-6">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Link to="/train" className="flex items-center gap-1.5 press" style={{ color: "#8A8A8A" }}>
          <ArrowLeft size={16} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Back</span>
        </Link>
        <div className="flex items-center gap-1.5" style={{ color: "#e63222" }}>
          <Trophy size={14} />
          <span className="text-[11px] font-bold uppercase tracking-wider">Challenges</span>
        </div>
        <div className="w-16" />
      </header>

      {/* Hero */}
      <div className="px-5 mb-5">
        <div
          className="p-5 rounded-2xl overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, rgba(230,50,34,0.15) 0%, #141414 100%)",
            border: "1.5px solid rgba(230,50,34,0.3)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: "#e63222" }}
          >
            Prove It
          </p>
          <h1 className="display text-3xl font-extrabold text-white leading-tight">
            Daily <span style={{ color: "#e63222" }}>Challenges</span>
          </h1>
          <p className="text-sm mt-2 mb-3" style={{ color: "#8A8A8A" }}>
            Hit targets. Earn XP. Challenge your crew.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Trophy size={12} style={{ color: "#FAFAFA" }} />
              <span className="text-xs font-bold text-white">
                {beatenCount}/{CHALLENGES.length} beaten
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap size={12} style={{ color: "#e63222" }} />
              <span className="text-xs font-bold text-white">
                {CHALLENGES.filter((c) => {
                  const b = bestRecord(state.challengeRecords, c.id);
                  return b && beatsTarget(c.id, b.value, c.target);
                }).reduce((s, c) => s + c.xp, 0)}{" "}
                XP earned
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div
        className="mx-5 mb-5 flex rounded-xl p-1"
        style={{ background: "#141414", border: "1.5px solid #262626" }}
      >
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg press"
            style={{
              background: tab === id ? "#e63222" : "transparent",
              color: tab === id ? "#fff" : "#8a8a8a",
              transition: "all 0.2s ease",
            }}
          >
            <Icon size={13} />
            <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
            {id === "H2H" && (
              <span
                className="label-cap text-[8px] text-accent-red border border-accent-red/40 rounded px-1.5"
                style={
                  tab === id ? { color: "#fff", borderColor: "rgba(255,255,255,0.5)" } : undefined
                }
              >
                PRO
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "GRIND" && (
        <GrindTab
          filtered={filtered}
          filter={filter}
          setFilter={setFilter}
          state={state}
          setActive={setActive}
        />
      )}
      {tab === "H2H" && <H2HTab state={state} />}
      {tab === "WARS" && <WarsTab state={state} />}

      {active && <ChallengeRunner challenge={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function GrindTab({
  filtered,
  filter,
  setFilter,
  state,
  setActive,
}: {
  filtered: Challenge[];
  filter: string;
  setFilter: (f: "ALL" | "EASY" | "BEAST" | "GOD" | "ELITE" | "BEATEN") => void;
  state: ReturnType<typeof useAppState>[0];
  setActive: (c: Challenge) => void;
}) {
  const { isPro, loading: proLoading } = usePro();
  const eliteLocked = !proLoading && !isPro;
  return (
    <>
      <div className="px-5 mb-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {(["ALL", "EASY", "BEAST", "GOD", "ELITE", "BEATEN"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border rounded-full whitespace-nowrap press"
            style={{
              background: filter === f ? "#e63222" : "transparent",
              borderColor: filter === f ? "#e63222" : "#262626",
              color: filter === f ? "#fff" : "#8A8A8A",
            }}
          >
            {f === "BEATEN" ? "✓ Beaten" : f}
          </button>
        ))}
      </div>

      <div className="stagger px-5 flex flex-col gap-3">
        {filtered.length === 0 && (
          <div
            className="p-8 text-center rounded-2xl"
            style={{ background: "#141414", border: "1.5px solid #262626" }}
          >
            <p className="text-sm" style={{ color: "#8A8A8A" }}>
              No challenges in this filter.
            </p>
          </div>
        )}
        {filtered.map((c) => {
          const best = bestRecord(state.challengeRecords, c.id);
          const beat = best && beatsTarget(c.id, best.value, c.target);
          const tierColor = TIER_COLOR[c.tier];
          const pct = best ? Math.min(100, (best.value / c.target) * 100) : 0;

          return (
            <button
              key={c.id}
              onClick={() => {
                if (c.tier === "ELITE" && eliteLocked) {
                  openPaywall("challenges");
                  return;
                }
                setActive(c);
              }}
              className="text-left rounded-2xl p-4 press relative overflow-hidden"
              style={{
                background: "#141414",
                border: `1.5px solid ${beat ? "#e63222" : "#262626"}`,
              }}
            >
              {beat && (
                <div
                  className="absolute top-0 right-0 w-16 h-16"
                  style={{
                    background:
                      "linear-gradient(135deg, transparent 50%, rgba(230,50,34,0.15) 50%)",
                  }}
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{
                        background: `${tierColor}18`,
                        color: tierColor,
                        border: `1px solid ${tierColor}40`,
                      }}
                    >
                      {TIER_LABEL[c.tier]}
                    </span>
                    {beat && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{
                          background: "rgba(230,50,34,0.15)",
                          color: "#e63222",
                          border: "1px solid rgba(230,50,34,0.3)",
                        }}
                      >
                        <Check size={9} /> Beaten
                      </span>
                    )}
                  </div>
                  <p className="display text-lg font-extrabold text-white uppercase leading-tight">
                    {c.name}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#8A8A8A" }}>
                    {c.tagline}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className="flex items-center gap-1 justify-end mb-1"
                    style={{ color: "#e63222" }}
                  >
                    <Zap size={11} />
                    <span className="text-xs font-bold">{c.xp} XP</span>
                  </div>
                  {best && (
                    <div
                      className="text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: "rgba(230,50,34,0.1)", color: "#e63222" }}
                    >
                      {c.type === "time" ? fmtTime(best.value) : best.value}
                    </div>
                  )}
                  {!best && (
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "#8a8a8a" }}
                    >
                      New
                    </div>
                  )}
                </div>
              </div>

              {best && (
                <div className="mt-3">
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "#262626" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, pct)}%`,
                        background: beat ? "#e63222" : tierColor,
                        transition: "width 600ms ease",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px]" style={{ color: "#8A8A8A" }}>
                      Your best: {c.type === "time" ? fmtTime(best.value) : `${best.value} reps`}
                    </span>
                    <span className="text-[9px]" style={{ color: "#8A8A8A" }}>
                      Target: {c.type === "time" ? fmtTime(c.target) : `${c.target} reps`}
                    </span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function H2HTab({ state }: { state: ReturnType<typeof useAppState>[0] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    | {
        id: string;
        display_name?: string | null;
        username?: string | null;
        avatar_url?: string | null;
        following?: boolean;
        level?: string | null;
      }[]
    | null
  >(null);
  const [selected, setSelected] = useState<{
    id: string;
    username?: string | null;
    display_name?: string | null;
  } | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { isPro, loading: proLoading } = usePro();
  // Creating an H2H challenge is Pro-only; viewing/accepting stays free.
  // While entitlement is loading, treat as unlocked (never flash a lock at paying users).
  const h2hLocked = !proLoading && !isPro;
  const _search = searchAthletes;
  const _createPost = createPost;

  const search = useCallback(async () => {
    return _search({ data: { q: query.trim() } });
  }, [_search, query]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults(await search());
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, search]);

  async function sendChallenge() {
    if (!selected || !challenge) return;
    if (h2hLocked) {
      openPaywall("h2h");
      return;
    }
    setSending(true);
    try {
      const targetName = selected.display_name || selected.username || "friend";
      const content = `@${targetName} I challenge you: ${challenge.name} (${challenge.tier} — ${challenge.xp} XP). Think you can beat it? 🔥`;
      await _createPost({
        data: {
          kind: "text",
          content,
          metadata: { h2h: true, challengeId: challenge.id, targetUserId: selected.id },
        },
      });
      setSent(true);
      toast.success("Challenge sent to your feed!");
    } catch (e) {
      toast.error("Couldn't send challenge");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="px-5 text-center py-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(230,50,34,0.15)", border: "2px solid #e63222" }}
        >
          <Swords size={32} style={{ color: "#e63222" }} />
        </div>
        <h2 className="display text-2xl font-extrabold text-white uppercase">Challenge Issued</h2>
        <p className="text-sm mt-2 mb-6" style={{ color: "#8A8A8A" }}>
          Your challenge post is live. Now go do it first.
        </p>
        <button
          onClick={() => {
            setSent(false);
            setSelected(null);
            setChallenge(null);
            setQuery("");
          }}
          className="btn-grit px-8"
        >
          New Challenge
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 flex flex-col gap-4">
      {/* Real tracked duels — challenge, accept, auto-scored live */}
      <DuelsPanel />

      <p className="label-cap text-[10px] text-grit-dim -mb-1">
        Or post an open challenge to your feed
      </p>

      {/* Step 1: Search for opponent */}
      <div
        className="p-4 rounded-2xl"
        style={{ background: "#141414", border: `1.5px solid ${selected ? "#FAFAFA" : "#262626"}` }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#8A8A8A" }}>
          1 — Pick Your Opponent
        </p>
        {selected ? (
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold display text-white text-sm flex-shrink-0"
              style={{ background: "#e63222" }}
            >
              {(selected.display_name || selected.username || "A")[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">
                {selected.display_name || selected.username}
              </p>
              {selected.username && (
                <p className="text-xs" style={{ color: "#8A8A8A" }}>
                  @{selected.username}
                </p>
              )}
            </div>
            <button onClick={() => setSelected(null)} style={{ color: "#8A8A8A" }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "#141414", border: "1px solid #262626" }}
            >
              <Search size={14} style={{ color: "#8A8A8A" }} />
              <input
                defaultValue={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-[#8a8a8a] outline-none"
              />
            </div>
            {results && results.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
                style={{
                  background: "#141414",
                  border: "1.5px solid #262626",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                {results.slice(0, 6).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelected(r);
                      setQuery("");
                      setResults(null);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 w-full text-left press"
                    style={{ borderBottom: "1px solid #262626" }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "#e63222" }}
                    >
                      {(r.display_name || r.username || "A")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{r.display_name || r.username}</p>
                      {r.username && (
                        <p className="text-xs" style={{ color: "#8A8A8A" }}>
                          @{r.username}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {results && results.length === 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-xl p-4 text-center z-20"
                style={{ background: "#141414", border: "1.5px solid #262626" }}
              >
                <p className="text-sm" style={{ color: "#8A8A8A" }}>
                  No athletes found
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Pick challenge */}
      <div
        className="p-4 rounded-2xl"
        style={{
          background: "#141414",
          border: `1.5px solid ${challenge ? "#FAFAFA" : "#262626"}`,
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#8A8A8A" }}>
          2 — Pick The Challenge
        </p>
        {challenge ? (
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ width: 40, height: 40, background: `${TIER_COLOR[challenge.tier]}18` }}
            >
              <Trophy size={18} style={{ color: TIER_COLOR[challenge.tier] }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">{challenge.name}</p>
              <p className="text-xs" style={{ color: "#8A8A8A" }}>
                {challenge.xp} XP · {challenge.tier}
              </p>
            </div>
            <button onClick={() => setChallenge(null)} style={{ color: "#8A8A8A" }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto no-scrollbar">
            {CHALLENGES.map((c) => (
              <button
                key={c.id}
                onClick={() => setChallenge(c)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-left press"
                style={{ background: "#141414" }}
              >
                <div>
                  <p className="text-sm font-bold text-white">{c.name}</p>
                  <p className="text-[10px]" style={{ color: "#8A8A8A" }}>
                    {c.tagline}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: `${TIER_COLOR[c.tier]}18`, color: TIER_COLOR[c.tier] }}
                  >
                    {c.tier}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: "#e63222" }}>
                    {c.xp} XP
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Send */}
      <button
        onClick={sendChallenge}
        disabled={!selected || !challenge || sending}
        className="btn-grit w-full flex items-center justify-center gap-2 py-4"
        style={{ opacity: !selected || !challenge ? 0.4 : 1 }}
      >
        {sending ? (
          <span className="text-sm font-bold">Sending…</span>
        ) : (
          <>
            <Swords size={16} />
            <span>Issue the Challenge</span>
          </>
        )}
      </button>

      <p className="text-center text-xs" style={{ color: "#8a8a8a" }}>
        This posts a challenge to your feed and tags your opponent.
      </p>
    </div>
  );
}

function WarsTab({ state }: { state: ReturnType<typeof useAppState>[0] }) {
  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(-1);

  const thisWeekSessions = (state.sessions ?? []).filter((s) => {
    const dt = new Date(`${s.date}T12:00:00`);
    return dt >= thisWeek.start && dt <= thisWeek.end;
  });
  const lastWeekSessions = (state.sessions ?? []).filter((s) => {
    const dt = new Date(`${s.date}T12:00:00`);
    return dt >= lastWeek.start && dt <= lastWeek.end;
  });

  const thisVol = thisWeekSessions.reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);
  const lastVol = lastWeekSessions.reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);
  const volDelta = lastVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : null;

  const thisPRs = thisWeekSessions.reduce((sum, s) => sum + (s.prCount ?? 0), 0);
  const lastPRs = lastWeekSessions.reduce((sum, s) => sum + (s.prCount ?? 0), 0);

  const totalBeaten = (state.challengeRecords ?? []).reduce((set, r) => {
    const c = CHALLENGES.find((c) => c.id === r.challengeId);
    if (c && beatsTarget(c.id, r.value, c.target)) set.add(r.challengeId);
    return set;
  }, new Set<string>()).size;

  const p = state.profile;

  const weeks = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekSessionMap = new Map<string, number>();
  thisWeekSessions.forEach((s) => {
    const d = new Date(`${s.date}T12:00:00`);
    const key = weeks[d.getDay() === 0 ? 6 : d.getDay() - 1];
    weekSessionMap.set(key, (weekSessionMap.get(key) ?? 0) + 1);
  });

  return (
    <div className="px-5 flex flex-col gap-4">
      {/* Weekly summary card */}
      <div
        className="p-5 rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(230,50,34,0.1) 0%, #141414 100%)",
          border: "1.5px solid rgba(230,50,34,0.25)",
        }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-1"
          style={{ color: "#e63222" }}
        >
          This Week
        </p>
        <h2 className="display text-2xl font-extrabold text-white">
          {thisWeekSessions.length}{" "}
          <span className="text-base font-semibold" style={{ color: "#8A8A8A" }}>
            sessions
          </span>
        </h2>
        <div className="flex items-center gap-1 mt-1">
          {volDelta !== null && (
            <span
              className="text-[10px] font-bold flex items-center gap-0.5"
              style={{ color: volDelta >= 0 ? "#FAFAFA" : "#FF5252" }}
            >
              {volDelta >= 0 ? <TrendingUp size={10} /> : null}
              {volDelta >= 0 ? "+" : ""}
              {volDelta}% volume vs last week
            </span>
          )}
        </div>

        {/* Daily bar chart */}
        {thisWeekSessions.length === 0 ? (
          <div className="mt-4 text-center py-3">
            <p className="text-sm text-grit-dim">No sessions logged this week yet.</p>
            <Link to="/workout/live" search={{}} className="btn-ghost inline-block mt-3">
              Start this week strong
            </Link>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 mt-4 h-14">
            {weeks.map((day) => {
              const count = weekSessionMap.get(day) ?? 0;
              const today = new Date();
              const todayKey = weeks[today.getDay() === 0 ? 6 : today.getDay() - 1];
              const isToday = day === todayKey;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: 40 }}>
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: count > 0 ? Math.min(40, count * 20) : 4,
                        background: isToday
                          ? "#e63222"
                          : count > 0
                            ? "rgba(230,50,34,0.4)"
                            : "#262626",
                        transition: "height 400ms ease",
                      }}
                    />
                  </div>
                  <span
                    className="text-[9px] font-bold"
                    style={{ color: isToday ? "#e63222" : "#8a8a8a" }}
                  >
                    {day[0]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Sessions This Week",
            value: thisWeekSessions.length,
            sub: `${lastWeekSessions.length} last week`,
            color: "#e63222",
          },
          {
            label: "Volume This Week",
            value: `${Math.round(thisVol / 1000)}t`,
            sub: `${Math.round(lastVol / 1000)}t last week`,
            color: "#e63222",
          },
          { label: "PRs This Week", value: thisPRs, sub: `${lastPRs} last week`, color: "#FAFAFA" },
          {
            label: "Challenges Beaten",
            value: totalBeaten,
            sub: `of ${CHALLENGES.length} total`,
            color: "#FAFAFA",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-2xl"
            style={{ background: "#141414", border: "1.5px solid #262626" }}
          >
            <p className="display text-2xl font-extrabold" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5 text-white">
              {s.label}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "#8a8a8a" }}>
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Leagues CTA */}
      <Link
        to="/friends"
        className="p-4 rounded-2xl flex items-center gap-4 press"
        style={{ background: "#141414", border: "1.5px solid #262626" }}
      >
        <div
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 44, height: 44, background: "rgba(230,50,34,0.12)" }}
        >
          <Crown size={20} style={{ color: "#e63222" }} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm">See Your League Rank</p>
          <p className="text-xs mt-0.5" style={{ color: "#8A8A8A" }}>
            Compete with your friends this week
          </p>
        </div>
        <ChevronRight size={16} style={{ color: "#8a8a8a" }} />
      </Link>

      {/* Best challenge scores */}
      {CHALLENGES.filter((c) => bestRecord(state.challengeRecords, c.id)).length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#141414", border: "1.5px solid #262626" }}
        >
          <p
            className="px-4 py-3 text-xs font-bold uppercase tracking-wider"
            style={{ color: "#8A8A8A", borderBottom: "1px solid #262626" }}
          >
            Your Challenge Records
          </p>
          {CHALLENGES.filter((c) => bestRecord(state.challengeRecords, c.id))
            .slice(0, 5)
            .map((c, i) => {
              const best = bestRecord(state.challengeRecords, c.id)!;
              const beat = beatsTarget(c.id, best.value, c.target);
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: i > 0 ? "1px solid #262626" : "none" }}
                >
                  <div>
                    <p className="text-sm font-bold text-white">{c.name}</p>
                    <span
                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                      style={{ background: `${TIER_COLOR[c.tier]}15`, color: TIER_COLOR[c.tier] }}
                    >
                      {c.tier}
                    </span>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-sm font-bold"
                      style={{ color: beat ? "#e63222" : "#8A8A8A" }}
                    >
                      {c.type === "time" ? fmtTime(best.value) : `${best.value} reps`}
                    </p>
                    {beat && (
                      <p className="text-[9px]" style={{ color: "#e63222" }}>
                        ✓ beaten
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function ChallengeRunner({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const [, set] = useAppState();
  const isTime = challenge.type === "time";
  const [seconds, setSeconds] = useState(0);
  const [reps, setReps] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState<{ value: number; beat: boolean } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && isTime) {
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
  }, [running, isTime]);

  function finish() {
    setRunning(false);
    const value = isTime ? seconds : reps;
    if (value <= 0) {
      onClose();
      return;
    }
    const beat = beatsTarget(challenge.id, value, challenge.target);
    set((s) => ({
      ...s,
      challengeRecords: [
        ...(s.challengeRecords || []),
        { challengeId: challenge.id, value, date: isoDay() },
      ],
    }));
    setFinished({ value, beat });
  }

  const display = isTime ? fmtTime(seconds) : `${reps}`;
  const pct = isTime
    ? Math.min(100, (seconds / challenge.target) * 100)
    : Math.min(100, (reps / challenge.target) * 100);
  const tierColor = TIER_COLOR[challenge.tier];

  const size = 180;
  const sw = 8;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      onClick={onClose}
      // No backdrop-filter: composites as solid black while scrolling in WKWebView/iOS Safari.
      style={{ background: "rgba(0,0,0,0.9)" }}
    >
      <div
        className="w-full max-w-md relative rounded-t-3xl sm:rounded-3xl"
        style={{
          background: "#141414",
          border: "1.5px solid #262626",
          borderTop: `3px solid ${tierColor}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "#262626" }} />
        </div>

        <button
          onClick={onClose}
          className="icon-btn absolute top-4 right-4"
          style={{ color: "#8A8A8A" }}
        >
          <X size={20} />
        </button>

        <div className="p-6 pb-3">
          <span
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: tierColor }}
          >
            {TIER_LABEL[challenge.tier]} Challenge
          </span>
          <h2 className="display text-2xl font-extrabold text-white uppercase leading-tight mt-1">
            {challenge.name}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#8A8A8A" }}>
            {challenge.tagline}
          </p>
        </div>

        {/* Ring timer for time challenges */}
        {isTime ? (
          <div className="flex flex-col items-center py-4">
            <div className="relative" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90 absolute inset-0">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="#262626"
                  strokeWidth={sw}
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={tierColor}
                  strokeWidth={sw}
                  strokeDasharray={`${(circ * pct) / 100} ${circ}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 200ms linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="display font-extrabold text-white" style={{ fontSize: 44 }}>
                  {display}
                </span>
                <span
                  className="text-xs font-bold uppercase tracking-wider mt-1"
                  style={{ color: "#8A8A8A" }}
                >
                  Target: {fmtTime(challenge.target)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 gap-4">
            <span className="display font-extrabold text-white" style={{ fontSize: 72 }}>
              {reps}
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setReps((r) => Math.max(0, r - 1))}
                className="w-12 h-12 rounded-full flex items-center justify-center press"
                style={{ background: "#141414", border: "1.5px solid #262626" }}
              >
                <Minus size={20} style={{ color: "#8A8A8A" }} />
              </button>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#8A8A8A" }}
              >
                Target: {challenge.target} reps
              </span>
              <button
                onClick={() => setReps((r) => r + 1)}
                className="w-12 h-12 rounded-full flex items-center justify-center press"
                style={{ background: tierColor }}
              >
                <Plus size={20} color="#fff" />
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {finished && (
          <div
            className="mx-5 mb-4 p-4 rounded-2xl text-center"
            style={{
              background: finished.beat ? "rgba(230,50,34,0.1)" : "rgba(44,45,51,0.5)",
              border: `1.5px solid ${finished.beat ? "#e63222" : "#262626"}`,
            }}
          >
            <p
              className="display text-xl font-extrabold"
              style={{ color: finished.beat ? "#e63222" : "#8A8A8A" }}
            >
              {finished.beat ? "🔥 BEATEN!" : "Not yet"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#8A8A8A" }}>
              {isTime ? fmtTime(finished.value) : `${finished.value} reps`}
              {" · "}
              Target: {isTime ? fmtTime(challenge.target) : `${challenge.target} reps`}
            </p>
            {finished.beat && (
              <p className="text-xs mt-1 font-bold" style={{ color: "#e63222" }}>
                +{challenge.xp} XP earned!
              </p>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="px-5 pb-6 flex gap-3">
          {finished ? (
            <button onClick={onClose} className="btn-grit flex-1 py-3">
              Done
            </button>
          ) : (
            <>
              {isTime ? (
                <>
                  <button
                    onClick={() => (running ? setRunning(false) : setRunning(true))}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm press"
                    style={{ background: running ? "#262626" : tierColor, color: "#fff" }}
                  >
                    {running ? (
                      <>
                        <Pause size={16} /> Pause
                      </>
                    ) : (
                      <>
                        <Play size={16} /> {seconds > 0 ? "Resume" : "Start"}
                      </>
                    )}
                  </button>
                  <button
                    onClick={finish}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm press"
                    style={{ background: "#262626", color: "#8A8A8A" }}
                  >
                    Finish
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setReps(0);
                      setFinished(null);
                    }}
                    className="py-3 px-4 rounded-2xl press"
                    style={{ background: "#262626", color: "#8A8A8A" }}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button onClick={finish} className="btn-grit flex-1 py-3">
                    Log {reps} reps
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
