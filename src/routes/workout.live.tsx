import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { X, Check, Play, Trophy, Share2, Dumbbell, Wind } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { defaultSchedule, isoDay, todayKey } from "@/lib/calc";
import { VideoModal } from "@/components/VideoModal";
import { ShareCard } from "@/components/ShareCard";
import { PRCelebration } from "@/components/PRCelebration";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  DayKey,
} from "@/lib/types";

export const Route = createFileRoute("/workout/live")({
  head: () => ({ meta: [{ title: "DEADSET — Workout" }] }),
  component: LiveWorkoutPage,
});

interface BuiltExercise {
  exerciseId: string;
  name: string;
  primary_muscles: string[];
  targetSets: number;
  targetReps: string;
}

const WARMUP_EXERCISES = [
  { name: "Jumping Jacks", reps: "30 reps", durationSec: 40 },
  { name: "Arm Circles", reps: "20 each direction", durationSec: 30 },
  { name: "Hip Circles", reps: "10 each direction", durationSec: 30 },
  { name: "Leg Swings", reps: "10 each leg", durationSec: 30 },
  { name: "Inchworm", reps: "5 reps", durationSec: 40 },
];

const COOLDOWN_STRETCHES = [
  { name: "Chest Stretch", instruction: "Clasp hands behind back, open chest wide", durationSec: 30 },
  { name: "Hip Flexor Stretch", instruction: "Lunge forward, drop back knee, push hips forward", durationSec: 40 },
  { name: "Hamstring Stretch", instruction: "Sit on floor, reach for your toes", durationSec: 40 },
  { name: "Shoulder Cross-Body", instruction: "Pull one arm across your chest, hold", durationSec: 30 },
  { name: "Child's Pose", instruction: "Kneel, sit back on heels, arms forward on floor", durationSec: 40 },
];

function buildDay(
  state: ReturnType<typeof useAppState>[0],
  dayKey: DayKey,
): { label: string; exercises: BuiltExercise[] } | null {
  const active = state.programs.find((p) => p.id === state.activeProgramId);
  if (active) {
    const d = active.days[dayKey];
    if (!d || d.items.length === 0) return null;
    return {
      label: d.label,
      exercises: d.items.map((it) => ({
        exerciseId: it.id,
        name: it.name,
        primary_muscles: it.primary_muscles,
        targetSets: it.sets,
        targetReps: it.reps,
      })),
    };
  }
  const sched = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
  const d = sched?.[dayKey];
  if (!d || d.exerciseIds.length === 0) return null;
  return {
    label: d.label,
    exercises: d.exerciseIds.map((eid) => {
      const ex = getExercise(eid);
      const ov = d.overrides?.[eid];
      return {
        exerciseId: eid,
        name: ex?.name ?? eid,
        primary_muscles: ex?.muscleGroup ? [ex.muscleGroup] : [],
        targetSets: ov?.sets ?? ex?.sets ?? 3,
        targetReps: ov?.reps ?? ex?.reps ?? "8-12",
      };
    }),
  };
}

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_SHORT: Record<DayKey, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
};

function CountdownCircle({ totalSec, remainSec }: { totalSec: number; remainSec: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const progress = remainSec / totalSec;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#262626" strokeWidth="6" />
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke="#E10600"
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

function PhaseTimer({
  items,
  onFinish,
  icon,
  phaseLabel,
}: {
  items: { name: string; detail: string; durationSec: number }[];
  onFinish: () => void;
  icon: React.ReactNode;
  phaseLabel: string;
}) {
  const [idx, setIdx] = useState(0);
  const [remain, setRemain] = useState(items[0].durationSec);

  const current = items[idx];

  useEffect(() => {
    setRemain(items[idx].durationSec);
  }, [idx, items]);

  useEffect(() => {
    if (remain <= 0) {
      if (idx < items.length - 1) {
        setIdx((i) => i + 1);
      } else {
        onFinish();
      }
      return;
    }
    const t = setTimeout(() => setRemain((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remain, idx, items.length, onFinish]);

  function next() {
    if (idx < items.length - 1) {
      setIdx((i) => i + 1);
    } else {
      onFinish();
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="text-center w-full">
          <p className="label-cap text-[10px] text-accent-red">{phaseLabel}</p>
          <p className="display text-sm uppercase font-extrabold text-grit">
            {idx + 1} / {items.length}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <div className="text-grit-dim mb-2">{icon}</div>
        <div className="relative flex items-center justify-center">
          <CountdownCircle totalSec={current.durationSec} remainSec={remain} />
          <span className="absolute display text-2xl font-extrabold text-grit tabular-nums">{remain}</span>
        </div>
        <div className="text-center">
          <p className="display text-2xl font-extrabold uppercase text-grit leading-tight">{current.name}</p>
          <p className="text-sm text-grit-dim mt-2">{current.detail}</p>
        </div>
      </div>

      <div className="border-t border-grit p-4 grid grid-cols-2 gap-3">
        <button onClick={onFinish} className="btn-ghost py-3">Skip All</button>
        <button onClick={next} className="btn-grit py-3">
          {idx < items.length - 1 ? "Next" : "Done"}
        </button>
      </div>
    </div>
  );
}

function LiveWorkoutPage() {
  const [state, set] = useAppState();
  const nav = useNavigate();

  const [dayKey, setDayKey] = useState<DayKey>(todayKey());
  const [startedAt] = useState(() => new Date().toISOString());
  const [videoQuery, setVideoQuery] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [stage, setStage] = useState<"warmup" | "workout" | "cooldown" | "pr-ask" | "pr-form" | "finished">("warmup");
  const [prExerciseId, setPrExerciseId] = useState<string | null>(null);
  const [prWeight, setPrWeight] = useState("");
  const [prReps, setPrReps] = useState("");
  const [celebrate, setCelebrate] = useState<{ name: string; weight: number; reps: number; prevBest: number } | null>(null);
  const [finishedSession, setFinishedSession] = useState<WorkoutSession | null>(null);
  const [share, setShare] = useState(false);

  const built = useMemo(() => buildDay(state, dayKey), [state, dayKey]);

  if (!built) {
    const active = state.programs.find((p) => p.id === state.activeProgramId);
    const today = todayKey();
    return (
      <div className="min-h-screen flex flex-col p-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/train" className="text-grit-dim"><X size={22} /></Link>
          <p className="display text-sm uppercase font-extrabold text-grit">Pick a Day</p>
          <div className="w-6" />
        </div>
        <div className="space-y-2 mb-6">
          {DAY_KEYS.map((k) => {
            const preview = buildDay(state, k);
            const count = preview?.exercises.length ?? 0;
            const isToday = k === today;
            const empty = count === 0;
            return (
              <button
                key={k}
                onClick={() => !empty && setDayKey(k)}
                disabled={empty}
                className="w-full bg-grit-card border p-3 flex items-center justify-between text-left disabled:opacity-50"
                style={{ borderColor: isToday ? "#E10600" : "#262626" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="label-cap text-[10px] text-grit-dim">{DAY_SHORT[k]}</span>
                    {isToday && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-accent-red text-white label-cap">TODAY</span>
                    )}
                  </div>
                  <div className="display uppercase font-extrabold text-grit text-sm truncate">
                    {preview?.label ?? "REST"}
                  </div>
                  <div className="text-[10px] label-cap text-grit-dim mt-0.5">
                    {count} {count === 1 ? "exercise" : "exercises"}
                  </div>
                </div>
                {!empty && <Play size={18} className="text-accent-red" />}
              </button>
            );
          })}
        </div>
        {active && (
          <Link to="/programs/$programId" params={{ programId: active.id }} className="btn-ghost text-center">
            Edit Program
          </Link>
        )}
      </div>
    );
  }

  function buildSession(prExId?: string, prWeightNum?: number, prRepsNum?: number): WorkoutSession {
    const exercises: WorkoutSessionExercise[] = built!.exercises.map((e) => {
      const isPR = e.exerciseId === prExId && !!prWeightNum && !!prRepsNum;
      return {
        exerciseId: e.exerciseId,
        name: e.name,
        primary_muscles: e.primary_muscles,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        sets: isPR
          ? [{ weight: prWeightNum!, reps: prRepsNum!, isPR: true }]
          : [],
      };
    });
    const totalVolume = exercises.reduce(
      (a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0),
      0,
    );
    const prCount = exercises.reduce((a, e) => a + e.sets.filter((s) => s.isPR).length, 0);
    return {
      id: crypto.randomUUID(),
      date: isoDay(),
      dayKey,
      programId: state.programs.find((p) => p.id === state.activeProgramId)?.id ?? null,
      label: built!.label,
      startedAt,
      endedAt: new Date().toISOString(),
      exercises,
      totalVolume,
      prCount,
    };
  }

  function persistAndFinish(session: WorkoutSession) {
    const day = isoDay();
    set((st) => {
      const newLogs = [...st.logs];
      session.exercises.forEach((e) =>
        e.sets.forEach((s) => {
          newLogs.push({
            exerciseId: e.exerciseId,
            weight: s.weight,
            reps: s.reps,
            date: new Date().toISOString(),
          });
        }),
      );
      return {
        ...st,
        sessions: [...st.sessions, session],
        logs: newLogs,
        completedDates: st.completedDates.includes(day) ? st.completedDates : [...st.completedDates, day],
      };
    });
    setFinishedSession(session);
    setStage("finished");
  }

  function completeNoPR() {
    persistAndFinish(buildSession());
  }

  function submitPR() {
    if (!prExerciseId) return;
    const w = Number(prWeight) || 0;
    const r = Number(prReps) || 0;
    if (!r) return;
    const ex = built!.exercises.find((e) => e.exerciseId === prExerciseId)!;
    const prevBest = Math.max(0, ...state.logs.filter((l) => l.exerciseId === prExerciseId).map((l) => l.weight));
    setCelebrate({ name: ex.name, weight: w, reps: r, prevBest });
    try { navigator.vibrate?.([40, 60, 40]); } catch { /* noop */ }
    persistAndFinish(buildSession(prExerciseId, w, r));
  }

  // WARM UP
  if (stage === "warmup") {
    return (
      <PhaseTimer
        phaseLabel="WARM UP"
        icon={<Dumbbell size={32} />}
        items={WARMUP_EXERCISES.map((e) => ({ name: e.name, detail: e.reps, durationSec: e.durationSec }))}
        onFinish={() => setStage("workout")}
      />
    );
  }

  // COOL DOWN
  if (stage === "cooldown") {
    return (
      <PhaseTimer
        phaseLabel="COOL DOWN"
        icon={<Wind size={32} />}
        items={COOLDOWN_STRETCHES.map((e) => ({ name: e.name, detail: e.instruction, durationSec: e.durationSec }))}
        onFinish={() => setStage("pr-ask")}
      />
    );
  }

  if (stage === "finished" && finishedSession) {
    return (
      <>
        <FinishedScreen
          session={finishedSession}
          onClose={() => nav({ to: "/train" })}
          onShare={() => setShare(true)}
          share={share}
          onCloseShare={() => setShare(false)}
        />
        {celebrate && (
          <PRCelebration
            exerciseName={celebrate.name}
            weight={celebrate.weight}
            reps={celebrate.reps}
            prevBest={celebrate.prevBest}
            onClose={() => setCelebrate(null)}
          />
        )}
      </>
    );
  }

  // PR ASK
  if (stage === "pr-ask") {
    return (
      <div className="min-h-screen flex flex-col p-6" style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={() => setStage("workout")} className="text-grit-dim self-start mb-8"><X size={22} /></button>
        <div className="flex-1 flex flex-col justify-center text-center">
          <Trophy size={48} className="mx-auto text-accent-red mb-4" />
          <p className="label-cap text-accent-red text-[10px] mb-2">NICE WORK</p>
          <h1 className="display text-3xl font-extrabold uppercase text-grit leading-tight mb-3">Did You Hit a PR?</h1>
          <p className="text-sm text-grit-dim mb-10">A new personal best on any lift today?</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={completeNoPR} className="btn-ghost py-4">No</button>
            <button onClick={() => setStage("pr-form")} className="btn-grit py-4">
              <Trophy size={16} className="mr-2" /> Yes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PR FORM
  if (stage === "pr-form") {
    return (
      <div className="min-h-screen flex flex-col p-6" style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={() => setStage("pr-ask")} className="text-grit-dim self-start mb-6"><X size={22} /></button>
        <p className="label-cap text-accent-red text-[10px]">NEW PR</p>
        <h1 className="display text-3xl font-extrabold uppercase text-grit leading-tight mb-6">Log Your PR</h1>

        <label className="label-cap mb-2">Exercise</label>
        <div className="flex flex-col gap-2 mb-5 max-h-64 overflow-y-auto">
          {built.exercises.map((e) => {
            const sel = prExerciseId === e.exerciseId;
            return (
              <button
                key={e.exerciseId}
                onClick={() => setPrExerciseId(e.exerciseId)}
                className="text-left p-3 border"
                style={{
                  borderColor: sel ? "#E10600" : "#262626",
                  background: sel ? "#1a0606" : "#141414",
                  color: sel ? "#E10600" : "#fff",
                }}
              >
                <div className="display uppercase font-extrabold text-sm">{e.name}</div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="label-cap block mb-1.5">Weight (kg)</label>
            <input
              inputMode="decimal"
              value={prWeight}
              onChange={(e) => setPrWeight(e.target.value)}
              className="input-grit text-center text-2xl font-bold"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label-cap block mb-1.5">Reps</label>
            <input
              inputMode="numeric"
              value={prReps}
              onChange={(e) => setPrReps(e.target.value)}
              className="input-grit text-center text-2xl font-bold"
              placeholder="0"
            />
          </div>
        </div>

        <button
          onClick={submitPR}
          disabled={!prExerciseId || !Number(prReps)}
          className="btn-grit w-full disabled:opacity-40 py-4"
        >
          <Trophy size={16} className="mr-2" /> Log PR & Finish
        </button>
      </div>
    );
  }

  // MAIN — exercise list
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={() => nav({ to: "/train" })} className="text-grit-dim"><X size={22} /></button>
        <div className="text-center">
          <p className="label-cap text-[10px] text-accent-red">TRAINING</p>
          <p className="display text-sm uppercase font-extrabold text-grit truncate max-w-[60vw]">{built.label}</p>
        </div>
        <Timer startedAt={startedAt} />
      </div>

      <div className="flex-1 px-5 py-4 overflow-auto">
        <p className="label-cap text-grit-dim text-[10px] mb-3">TODAY'S SESSION · {built.exercises.length} EXERCISES</p>
        <div className="flex flex-col gap-2">
          {built.exercises.map((e, i) => (
            <div
              key={e.exerciseId + i}
              className="bg-grit-card border border-grit p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="display uppercase font-extrabold text-grit text-base leading-tight truncate">
                  {e.name}
                </p>
                <p className="text-xs text-grit-dim mt-1">
                  {e.targetSets} × {e.targetReps}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  to="/lift/$exerciseId"
                  params={{ exerciseId: e.exerciseId }}
                  className="w-10 h-10 border border-grit flex items-center justify-center text-grit-dim"
                  aria-label="History"
                >
                  <Trophy size={14} />
                </Link>
                <button
                  onClick={() => { setVideoQuery(e.name + " form"); setVideoTitle(e.name); }}
                  className="w-10 h-10 border border-accent-red flex items-center justify-center"
                  aria-label="Watch form"
                >
                  <Play size={16} className="text-accent-red" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-grit-dim text-center mt-6 leading-relaxed">
          Train hard. When you're done, hit the button and we'll ask about PRs.
        </p>
      </div>

      <div className="border-t border-grit p-4">
        <button onClick={() => setStage("cooldown")} className="btn-grit w-full py-4">
          <Check size={16} className="mr-2" /> Completed Workout
        </button>
      </div>

      {videoQuery && (
        <VideoModal query={videoQuery} title={videoTitle} onClose={() => setVideoQuery(null)} />
      )}
    </div>
  );
}

function Timer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <div className="text-right">
      <p className="label-cap text-[10px] text-grit-dim">ELAPSED</p>
      <p className="display text-sm font-extrabold text-grit tabular-nums">{mm}:{ss}</p>
    </div>
  );
}

function FinishedScreen({
  session,
  onClose,
  onShare,
  share,
  onCloseShare,
}: {
  session: WorkoutSession;
  onClose: () => void;
  onShare: () => void;
  share: boolean;
  onCloseShare: () => void;
}) {
  const durationMin = Math.max(
    1,
    Math.round(
      ((session.endedAt ? new Date(session.endedAt).getTime() : Date.now()) -
        new Date(session.startedAt).getTime()) /
        60000,
    ),
  );
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex-1 px-6 pt-10 pb-6 flex flex-col">
        <p className="label-cap text-accent-red">SESSION COMPLETE</p>
        <h1 className="display text-5xl font-extrabold uppercase text-grit leading-none mt-2">
          {session.label.split(" — ")[0]}
        </h1>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <BigStat label="DURATION" value={`${durationMin}min`} />
          <BigStat label="EXERCISES" value={String(session.exercises.length)} />
          <BigStat label="PRS" value={String(session.prCount)} accent={session.prCount > 0} />
          <BigStat label="GRIT" value="+" accent />
        </div>

        <div className="mt-auto pt-6 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="btn-ghost">Done</button>
          <button onClick={onShare} className="btn-grit">
            <Share2 size={16} className="mr-2" /> Share
          </button>
        </div>
      </div>
      {share && <ShareCard session={session} onClose={onCloseShare} />}
    </div>
  );
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-grit-card border border-grit p-4">
      <p className="label-cap text-[10px] text-grit-dim">{label}</p>
      <p className="display text-3xl font-extrabold mt-1" style={{ color: accent ? "#E10600" : "#f5f5f0" }}>
        {value}
      </p>
    </div>
  );
}
