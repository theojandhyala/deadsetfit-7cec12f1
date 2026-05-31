import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Trophy, Timer, Flame, Play, Pause, RotateCcw, Check, X, Plus, Minus, Zap, ArrowLeft } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { isoDay } from "@/lib/calc";
import type { ChallengeRecord } from "@/lib/types";

export const Route = createFileRoute("/_tabs/challenges")({
  head: () => ({ meta: [{ title: "DEADSET — Challenges" }] }),
  component: ChallengesPage,
});

type Challenge = {
  id: string;
  name: string;
  tagline: string;
  type: "time" | "reps";
  target: number; // seconds or reps to "beat the boss"
  xp: number;
  tier: "EASY" | "BEAST" | "GOD";
};

const CHALLENGES: Challenge[] = [
  { id: "plank-5min", name: "5-Minute Plank", tagline: "Brace. Breathe. Don't break.", type: "time", target: 300, xp: 150, tier: "BEAST" },
  { id: "plank-1min", name: "60-Second Plank", tagline: "The entry test.", type: "time", target: 60, xp: 40, tier: "EASY" },
  { id: "wall-sit-2min", name: "2-Minute Wall Sit", tagline: "Quads on fire.", type: "time", target: 120, xp: 80, tier: "BEAST" },
  { id: "hollow-hold", name: "90s Hollow Hold", tagline: "Ab killer.", type: "time", target: 90, xp: 70, tier: "BEAST" },
  { id: "dead-hang", name: "60s Dead Hang", tagline: "Grip of steel.", type: "time", target: 60, xp: 50, tier: "EASY" },
  { id: "pushups-max", name: "Max Push-ups", tagline: "One set. No rest. Go.", type: "reps", target: 50, xp: 60, tier: "BEAST" },
  { id: "pullups-max", name: "Max Pull-ups", tagline: "Strict. No kipping.", type: "reps", target: 15, xp: 80, tier: "BEAST" },
  { id: "burpees-100", name: "100 Burpees", tagline: "Time attack. Survive.", type: "time", target: 600, xp: 120, tier: "GOD" },
  { id: "squats-50", name: "50 Squats Speed Run", tagline: "Beat your clock.", type: "time", target: 90, xp: 50, tier: "EASY" },
  { id: "plank-10min", name: "10-Minute Plank", tagline: "Legends only.", type: "time", target: 600, xp: 300, tier: "GOD" },
];

const TIER_COLOR: Record<Challenge["tier"], string> = {
  EASY: "#60a5fa",
  BEAST: "#fbbf24",
  GOD: "#e63222",
};

function bestRecord(records: ChallengeRecord[] | undefined, id: string) {
  const list = (records || []).filter((r) => r.challengeId === id);
  if (!list.length) return null;
  return list.reduce((b, r) => (r.value > b.value ? r : b));
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function ChallengesPage() {
  const [state] = useAppState();
  const [active, setActive] = useState<Challenge | null>(null);

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="pb-6">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Link to="/train" className="flex items-center gap-1.5 text-grit-dim hover:text-grit">
          <ArrowLeft size={16} />
          <span className="label-cap text-[10px]">BACK</span>
        </Link>
        <p className="label-cap text-[10px] flex items-center gap-1.5 text-accent-red">
          <Trophy size={12} /> CHALLENGES
        </p>
        <div className="w-12" />
      </header>

      <div className="px-5 mb-5">
        <div className="neon-card grid-bg p-4">
          <p className="label-cap text-[9px]">PROVE IT</p>
          <h1 className="display text-3xl font-extrabold uppercase text-grit leading-tight mt-1">
            Beat the <span className="text-accent-red text-glow-red">Boss</span>
          </h1>
          <p className="text-sm text-grit-dim mt-2">
            Pick a challenge. Hit the target. Earn XP. Brag forever.
          </p>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-2.5">
        {CHALLENGES.map((c) => {
          const best = bestRecord(state.challengeRecords, c.id);
          const beat = best && best.value >= c.target;
          const tierColor = TIER_COLOR[c.tier];
          const pct = best ? Math.min(100, (best.value / c.target) * 100) : 0;
          return (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className="bg-grit-card border border-grit p-3 text-left hover:border-accent-red transition-colors relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="label-cap text-[9px] px-1.5 py-0.5"
                      style={{ background: tierColor + "22", border: `1px solid ${tierColor}`, color: tierColor }}
                    >
                      {c.tier}
                    </span>
                    {beat && (
                      <span className="label-cap text-[9px] px-1.5 py-0.5 bg-accent-red text-white flex items-center gap-1">
                        <Check size={10} /> BEATEN
                      </span>
                    )}
                  </div>
                  <p className="display text-lg font-extrabold uppercase text-grit leading-tight">{c.name}</p>
                  <p className="text-[11px] text-grit-dim mt-0.5">{c.tagline}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="label-cap text-[9px] flex items-center justify-end gap-0.5 text-accent-red">
                    <Zap size={9} /> {c.xp} XP
                  </p>
                  {best ? (
                    <p className="text-[10px] text-grit mt-1 font-bold uppercase tracking-wider">
                      PR: {c.type === "time" ? fmtTime(best.value) : `${best.value}`}
                    </p>
                  ) : (
                    <p className="text-[10px] text-grit-dim mt-1 font-bold uppercase tracking-wider">NEW</p>
                  )}
                </div>
              </div>
              {best && (
                <div className="xp-bar mt-2.5" style={{ height: 4 }}>
                  <div className="fill" style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {active && <ChallengeRunner challenge={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function ChallengeRunner({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const [, set] = useAppState();
  const isTime = challenge.type === "time";

  // Time mode: count UP (hold as long as possible). Rep mode: tap counter.
  const [seconds, setSeconds] = useState(0);
  const [reps, setReps] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState<{ value: number; beat: boolean } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && isTime) {
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      return () => { if (tickRef.current) clearInterval(tickRef.current); };
    }
  }, [running, isTime]);

  function start() { setRunning(true); }
  function pause() { setRunning(false); }
  function reset() { setRunning(false); setSeconds(0); setReps(0); setFinished(null); }

  function finish() {
    setRunning(false);
    const value = isTime ? seconds : reps;
    if (value <= 0) { onClose(); return; }
    const beat = value >= challenge.target;
    const record: ChallengeRecord = {
      challengeId: challenge.id,
      value,
      date: isoDay(),
    };
    set((s) => ({
      ...s,
      challengeRecords: [...(s.challengeRecords || []), record],
    }));
    setFinished({ value, beat });
  }

  const display = isTime ? fmtTime(seconds) : `${reps}`;
  const targetDisplay = isTime ? fmtTime(challenge.target) : `${challenge.target}`;
  const pct = isTime
    ? Math.min(100, (seconds / challenge.target) * 100)
    : Math.min(100, (reps / challenge.target) * 100);

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-grit-card border border-accent-red w-full max-w-md relative grid-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-grit-dim hover:text-grit z-10">
          <X size={20} />
        </button>

        <div className="p-5 pb-3 border-b border-grit">
          <p className="label-cap text-[9px] text-accent-red flex items-center gap-1.5">
            {isTime ? <Timer size={11} /> : <Flame size={11} />} CHALLENGE
          </p>
          <h2 className="display text-2xl font-extrabold uppercase text-grit leading-tight mt-1">
            {challenge.name}
          </h2>
          <p className="text-xs text-grit-dim mt-1">
            Target: <span className="text-accent-red font-bold">{targetDisplay}</span> · {challenge.xp} XP
          </p>
        </div>

        {!finished ? (
          <>
            <div className="p-8 text-center">
              <p
                className="display font-extrabold leading-none text-glow-red text-accent-red"
                style={{ fontSize: "5.5rem" }}
              >
                {display}
              </p>
              <p className="label-cap text-[10px] mt-2">{isTime ? "SECONDS HELD" : "REPS DONE"}</p>
              <div className="xp-bar mt-4">
                <div className="fill" style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
            </div>

            <div className="p-4 pt-0">
              {isTime ? (
                <div className="flex gap-2">
                  {!running ? (
                    <button onClick={start} className="btn-grit flex-1">
                      <Play size={16} className="mr-2" /> {seconds > 0 ? "Resume" : "Start"}
                    </button>
                  ) : (
                    <button onClick={pause} className="btn-ghost flex-1">
                      <Pause size={16} className="mr-2" /> Pause
                    </button>
                  )}
                  <button onClick={reset} className="btn-ghost px-4" aria-label="Reset">
                    <RotateCcw size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setReps((r) => Math.max(0, r - 1))}
                    className="btn-ghost px-4"
                    aria-label="Minus rep"
                  >
                    <Minus size={18} />
                  </button>
                  <button
                    onClick={() => setReps((r) => r + 1)}
                    className="btn-grit flex-1 text-base py-4"
                  >
                    <Plus size={18} className="mr-2" /> Tap to count
                  </button>
                  <button onClick={reset} className="btn-ghost px-4" aria-label="Reset">
                    <RotateCcw size={16} />
                  </button>
                </div>
              )}
              <button onClick={finish} className="btn-ghost w-full mt-2">
                <Check size={16} className="mr-2" /> Save Attempt
              </button>
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <div
              className="display font-extrabold text-glow-red text-accent-red leading-none"
              style={{ fontSize: "3rem" }}
            >
              {finished.beat ? "BEATEN!" : "LOGGED"}
            </div>
            <p className="text-sm text-grit-dim mt-2">
              {finished.beat
                ? `You smashed the target. +${challenge.xp} XP earned.`
                : `Good effort. Hit ${targetDisplay} to claim the badge.`}
            </p>
            <p className="display text-3xl font-extrabold text-grit mt-4">
              {isTime ? fmtTime(finished.value) : `${finished.value}`}
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={reset} className="btn-ghost flex-1">
                <RotateCcw size={14} className="mr-2" /> Retry
              </button>
              <button onClick={onClose} className="btn-grit flex-1">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
