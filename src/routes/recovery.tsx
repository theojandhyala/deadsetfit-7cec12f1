import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/lib/storage";
import { isoDay, todayKey } from "@/lib/calc";
import { muscleRecovery, recoveryLabel } from "@/lib/recovery";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { Heart, Flame, Timer, RotateCcw, Play, Pause, ChevronRight, Activity, Lock } from "lucide-react";

export const Route = createFileRoute("/recovery")({
  head: () => ({ meta: [{ title: "DEADSET — Recovery" }] }),
  component: RecoveryPage,
});

const MUSCLE_GROUPS = ["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE"] as const;

type Muscle = (typeof MUSCLE_GROUPS)[number];

interface WarmUpMove {
  name: string;
  reps: string;
  muscles: Muscle[];
}

const WARMUPS: WarmUpMove[] = [
  { name: "Jumping Jacks", reps: "60s", muscles: ["LEGS", "SHOULDERS", "CORE"] },
  { name: "Arm Circles", reps: "20 each direction", muscles: ["SHOULDERS", "ARMS"] },
  { name: "Band Pull-Aparts", reps: "15 reps", muscles: ["BACK", "SHOULDERS"] },
  { name: "Bodyweight Squats", reps: "15 reps", muscles: ["LEGS", "CORE"] },
  { name: "Hip Circles", reps: "10 each leg", muscles: ["LEGS", "CORE"] },
  { name: "Push-Up Plus", reps: "12 reps", muscles: ["CHEST", "SHOULDERS", "CORE"] },
  { name: "Glute Bridges", reps: "15 reps", muscles: ["LEGS", "CORE"] },
  { name: "Mountain Climbers", reps: "30s", muscles: ["CORE", "LEGS", "CHEST"] },
  { name: "Walking Lunges", reps: "10 each leg", muscles: ["LEGS", "CORE"] },
  { name: "Scapular Wall Slides", reps: "12 reps", muscles: ["BACK", "SHOULDERS"] },
  { name: "Tricep Extensions (band)", reps: "15 reps", muscles: ["ARMS"] },
  { name: "Dead Bugs", reps: "10 each side", muscles: ["CORE"] },
  { name: "Leg Swings — Front/Back", reps: "12 each leg", muscles: ["LEGS"] },
  { name: "Chest doorway stretch — dynamic", reps: "30s", muscles: ["CHEST"] },
  { name: "Inchworms", reps: "8 reps", muscles: ["CORE", "LEGS", "CHEST"] },
];

interface Stretch {
  name: string;
  holdSeconds: number;
  muscles: Muscle[];
}

const STRETCHES: Stretch[] = [
  { name: "Pec Doorway Stretch", holdSeconds: 45, muscles: ["CHEST"] },
  { name: "Cat-Cow", holdSeconds: 60, muscles: ["BACK", "CORE"] },
  { name: "Child's Pose", holdSeconds: 60, muscles: ["BACK", "CORE"] },
  { name: "Standing Quad Stretch", holdSeconds: 45, muscles: ["LEGS"] },
  { name: "Figure-Four Glute Stretch", holdSeconds: 45, muscles: ["LEGS"] },
  { name: "Seated Hamstring Stretch", holdSeconds: 45, muscles: ["LEGS"] },
  { name: "Cross-Body Shoulder Stretch", holdSeconds: 45, muscles: ["SHOULDERS"] },
  { name: "Overhead Tricep Stretch", holdSeconds: 45, muscles: ["ARMS"] },
  { name: "Wrist Flexor Stretch", holdSeconds: 30, muscles: ["ARMS"] },
  { name: "Cobra / Upward Dog", holdSeconds: 45, muscles: ["CORE", "CHEST"] },
  { name: "Hip Flexor Lunge Stretch", holdSeconds: 45, muscles: ["LEGS", "CORE"] },
  { name: "Thread the Needle", holdSeconds: 45, muscles: ["BACK", "SHOULDERS"] },
  { name: "Foam Roller Thoracic Extensions", holdSeconds: 60, muscles: ["BACK"] },
  { name: "Pigeon Pose", holdSeconds: 60, muscles: ["LEGS", "CORE"] },
  { name: "Neck Retractions", holdSeconds: 30, muscles: ["SHOULDERS", "CORE"] },
];

const FOAM_ROLL = [
  { area: "Thoracic Spine", time: 60, tip: "Wrap around the roller, extend over it slowly." },
  { area: "Quads", time: 90, tip: "Roll from hip to knee. Pause on knots." },
  { area: "IT Band / Lateral Thigh", time: 90, tip: "Side-lying, slow passes from hip to knee." },
  { area: "Glutes", time: 60, tip: "Cross one ankle over the opposite knee, lean into it." },
  { area: "Calves", time: 60, tip: "Straight leg first, then bent knee to hit soleus." },
  { area: "Lats", time: 60, tip: "Side-lying, roller under armpit, slow rolls." },
  { area: "Upper Back", time: 60, tip: "Hands behind head, arch and release over roller." },
  { area: "Hamstrings", time: 60, tip: "Sit on roller, roll from glutes to back of knee." },
];

function RecoveryPage() {
  const [state] = useAppState();
  const { isPro, loading: proLoading } = usePro();
  const recoveryLocked = !proLoading && !isPro;
  const muscles = useMemo(() => muscleRecovery(state), [state]);
  const [tab, setTab] = useState<"WARMUP" | "STRETCH" | "FOAM">("WARMUP");
  const [selectedMuscles, setSelectedMuscles] = useState<Set<Muscle>>(() => new Set());
  const [timer, setTimer] = useState<{ seconds: number; label: string } | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const today = todayKey();
  const schedule = state.schedule;
  const activeProgram = state.programs.find((p) => p.id === state.activeProgramId);
  const todaysLabel = activeProgram ? activeProgram.days[today]?.label : schedule?.[today]?.label;

  // Auto-select muscles from today's label
  useEffect(() => {
    const label = (todaysLabel || "").toUpperCase();
    const detected = new Set<Muscle>();
    MUSCLE_GROUPS.forEach((m) => {
      if (label.includes(m)) detected.add(m);
    });
    if (label.includes("PUSH")) {
      detected.add("CHEST");
      detected.add("SHOULDERS");
      detected.add("ARMS");
    }
    if (label.includes("PULL")) {
      detected.add("BACK");
      detected.add("ARMS");
    }
    if (label.includes("UPPER")) {
      detected.add("CHEST");
      detected.add("BACK");
      detected.add("SHOULDERS");
      detected.add("ARMS");
    }
    if (label.includes("LOWER")) {
      detected.add("LEGS");
      detected.add("CORE");
    }
    if (label.includes("FULL")) {
      detected.add("CHEST");
      detected.add("BACK");
      detected.add("LEGS");
      detected.add("CORE");
    }
    if (detected.size > 0) setSelectedMuscles(detected);
  }, [todaysLabel]);

  // Recovery Score
  const score = useMemo(() => {
    const last7 = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return isoDay(d);
    });
    const completedDays = new Set(state.completedDates);
    const sessions = state.sessions.filter((s) => last7.includes(s.date.slice(0, 10)));
    const workoutDays = new Set(sessions.map((s) => s.date.slice(0, 10)));
    const trainingDays = workoutDays.size;
    const restDays = 7 - trainingDays;
    // Consecutive training streak (current)
    let consec = 0;
    const d = new Date();
    while (completedDays.has(isoDay(d))) {
      consec++;
      d.setDate(d.getDate() - 1);
    }
    // Last session intensity (volume)
    const lastSession = sessions.sort((a, b) => b.date.localeCompare(a.date))[0];
    const lastVol = lastSession?.totalVolume || 0;

    // Score formula: start at 70, +5 per rest day (max 15), -10 per consecutive day over 3, +5 if last session volume > 5000
    // Only penalize detraining for someone who actually has training history —
    // a brand-new user should not be told they're fatigued and need a deload.
    const hasHistory = state.sessions.length > 0 || state.completedDates.length > 0;
    let s = 70;
    s += Math.min(restDays, 3) * 5;
    if (consec > 3) s -= (consec - 3) * 10;
    if (lastVol > 5000) s += 5;
    if (trainingDays === 0 && hasHistory) s = Math.min(s, 60); // detraining penalty
    return Math.max(0, Math.min(100, s));
  }, [state.completedDates, state.sessions]);

  const scoreLabel = score >= 80 ? "READY" : score >= 60 ? "CAUTION" : "RECOVER";
  const scoreColor = score >= 80 ? "#22c55e" : score >= 60 ? "#fbbf24" : "#E10600";

  // Timer effect
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimer((t) => {
        if (!t || t.seconds <= 1) {
          setTimerRunning(false);
          return null;
        }
        return { ...t, seconds: t.seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  function toggleMuscle(m: Muscle) {
    setSelectedMuscles((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  const warmupMoves = useMemo(() => {
    if (selectedMuscles.size === 0) return WARMUPS.slice(0, 6);
    return WARMUPS.filter((w) => w.muscles.some((m) => selectedMuscles.has(m)));
  }, [selectedMuscles]);

  const stretchMoves = useMemo(() => {
    if (selectedMuscles.size === 0) return STRETCHES.slice(0, 6);
    return STRETCHES.filter((s) => s.muscles.some((m) => selectedMuscles.has(m)));
  }, [selectedMuscles]);

  function startTimer(seconds: number, label: string) {
    setTimer({ seconds, label });
    setTimerRunning(true);
  }

  const mm = timer ? String(Math.floor(timer.seconds / 60)).padStart(2, "0") : "00";
  const ss = timer ? String(timer.seconds % 60).padStart(2, "0") : "00";

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="pb-24">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="label-cap">Recovery</p>
          <h1 className="display text-3xl font-extrabold uppercase text-grit leading-tight">
            RECOVER HARD
          </h1>
        </div>
        <Link to="/train" className="label-cap text-grit-dim text-xs">
          ← BACK
        </Link>
      </header>

      {/* Recovery Score */}
      <section className="px-5 mb-6">
        <div className="bg-grit-card border border-grit p-5 flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#262626" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - score / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center display font-extrabold text-grit text-lg">
              {score}
            </div>
          </div>
          <div>
            <p className="label-cap" style={{ color: scoreColor }}>
              {scoreLabel}
            </p>
            <p className="text-xs text-grit-dim mt-1 leading-snug">
              {score >= 80
                ? "You're fresh. Hit today's session with intent."
                : score >= 60
                  ? "Moderate fatigue. Consider a deload or extra sleep."
                  : "High fatigue. Prioritize sleep, nutrition, and active recovery."}
            </p>
          </div>
        </div>
      </section>

      {/* Per-muscle recovery (Pro) */}
      <section className="px-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="label-cap">Muscle Recovery</p>
          <span className="label-cap text-[9px] text-accent-red border border-accent-red/40 rounded px-1.5">
            PRO
          </span>
        </div>
        <div className="relative bg-grit-card border border-grit p-4">
          <div
            className={
              recoveryLocked ? "pointer-events-none select-none blur-[6px] opacity-60" : undefined
            }
            aria-hidden={recoveryLocked || undefined}
          >
            <div className="space-y-2.5">
              {muscles.map((m) => {
                const meta = recoveryLabel(m.pct);
                const daysAgo = m.lastTrained
                  ? Math.floor((Date.now() - new Date(m.lastTrained).getTime()) / 86_400_000)
                  : null;
                return (
                  <div key={m.muscle}>
                    <div className="flex items-baseline justify-between">
                      <span className="label-cap text-[10px] text-grit">{m.muscle}</span>
                      <span className="label-cap text-[9px]" style={{ color: meta.color }}>
                        {meta.label}
                        {daysAgo !== null && (
                          <span className="text-grit-dim ml-1.5">
                            · {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#1a1a1a] rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${m.pct}%`, background: meta.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-grit-dim mt-3 leading-relaxed">
              Windows scale with the volume you actually logged — more sets, longer recovery.
            </p>
          </div>
          {recoveryLocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="bg-grit-card border p-4 max-w-[260px] text-center">
                <Lock size={16} className="text-accent-red mx-auto mb-2" />
                <p className="label-cap text-[10px] mb-1">MUSCLE RECOVERY</p>
                <p className="text-xs text-grit-dim mb-3">
                  Per-muscle readiness from your real sessions.
                </p>
                <button
                  onClick={() => openPaywall("recovery")}
                  className="btn-grit px-4 py-2 text-xs"
                >
                  UNLOCK WITH PRO
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Muscle selector */}
      <section className="px-5 mb-5">
        <p className="label-cap mb-2">Target Muscles {todaysLabel ? "· Auto-detected" : ""}</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((m) => {
            const active = selectedMuscles.has(m);
            return (
              <button
                key={m}
                onClick={() => toggleMuscle(m)}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border"
                style={{
                  borderColor: active ? "#E10600" : "#262626",
                  background: active ? "#1a0606" : "transparent",
                  color: active ? "#E10600" : "#8a8a8a",
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </section>

      {/* Tabs */}
      <div className="px-5 mb-4 flex gap-2 border-b border-grit">
        {(["WARMUP", "STRETCH", "FOAM"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="label-cap pb-3 pt-1 border-b-2"
            style={{
              borderColor: tab === t ? "#E10600" : "transparent",
              color: tab === t ? "#f5f5f0" : "#8a8a8a",
            }}
          >
            {t === "WARMUP" ? "Warm-Up" : t === "STRETCH" ? "Stretch" : "Foam Roll"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-5">
        {tab === "WARMUP" && (
          <div className="flex flex-col gap-3">
            {warmupMoves.length === 0 && (
              <p className="text-sm text-grit-dim text-center py-8">
                Select muscles above to generate a warm-up.
              </p>
            )}
            {warmupMoves.map((w, i) => (
              <div
                key={w.name + i}
                className="bg-grit-card border border-grit p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-grit">{w.name}</p>
                  <p className="text-[10px] text-grit-dim mt-0.5">{w.muscles.join(" · ")}</p>
                </div>
                <span className="label-cap text-grit-dim">{w.reps}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "STRETCH" && (
          <div className="flex flex-col gap-3">
            {stretchMoves.length === 0 && (
              <p className="text-sm text-grit-dim text-center py-8">
                Select muscles above to generate stretches.
              </p>
            )}
            {stretchMoves.map((s, i) => (
              <div key={s.name + i} className="bg-grit-card border border-grit p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-bold text-grit">{s.name}</p>
                    <p className="text-[10px] text-grit-dim mt-0.5">{s.muscles.join(" · ")}</p>
                  </div>
                  <button
                    onClick={() => startTimer(s.holdSeconds, s.name)}
                    className="btn-ghost px-3 py-1.5 text-[10px] flex items-center gap-1.5"
                  >
                    <Timer size={12} /> {s.holdSeconds}s
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "FOAM" && (
          <div className="flex flex-col gap-3">
            {FOAM_ROLL.map((f) => (
              <div key={f.area} className="bg-grit-card border border-grit p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-bold text-grit">{f.area}</p>
                  <button
                    onClick={() => startTimer(f.time, f.area)}
                    className="btn-ghost px-3 py-1.5 text-[10px] flex items-center gap-1.5"
                  >
                    <Timer size={12} /> {f.time}s
                  </button>
                </div>
                <p className="text-xs text-grit-dim leading-snug">{f.tip}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Timer Overlay */}
      {timer && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-md px-5">
          <div className="bg-grit-card border-2 border-accent-red p-5 text-center pulse-red">
            <p className="label-cap text-accent-red mb-1">{timer.label}</p>
            <p className="display text-5xl font-extrabold text-grit tabular-nums">
              {mm}:{ss}
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setTimerRunning((r) => !r)}
                className="btn-grit px-4 py-2 text-xs"
              >
                {timerRunning ? (
                  <Pause size={14} className="mr-1" />
                ) : (
                  <Play size={14} className="mr-1" />
                )}
                {timerRunning ? "PAUSE" : "RESUME"}
              </button>
              <button
                onClick={() => {
                  setTimer(null);
                  setTimerRunning(false);
                }}
                className="btn-ghost px-4 py-2 text-xs"
              >
                <RotateCcw size={14} className="mr-1" /> RESET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
