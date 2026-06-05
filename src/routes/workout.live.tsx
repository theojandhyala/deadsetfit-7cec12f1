import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Check, Plus, Minus, Play, Loader2, Trophy, Share2, Flame, Calculator, Zap } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { defaultSchedule, isoDay, todayKey, estimate1RM } from "@/lib/calc";
import { scorePump } from "@/lib/session.functions";
import { VideoModal } from "@/components/VideoModal";
import { ShareCard } from "@/components/ShareCard";
import { PlateCalculator } from "@/components/PlateCalculator";
import { PRCelebration } from "@/components/PRCelebration";
import type { WorkoutSession, WorkoutSessionExercise, CompletedSet, DayKey, SetLog } from "@/lib/types";

export const Route = createFileRoute("/workout/live")({
  head: () => ({ meta: [{ title: "DEADSET — Live Workout" }] }),
  component: LiveWorkoutPage,
});

function buildSession(state: ReturnType<typeof useAppState>[0], dayKey: DayKey): WorkoutSession | null {
  const active = state.programs.find((p) => p.id === state.activeProgramId);
  const id = crypto.randomUUID();
  const base = {
    id,
    date: isoDay(),
    dayKey,
    programId: active?.id ?? null,
    startedAt: new Date().toISOString(),
    totalVolume: 0,
    prCount: 0,
  };
  if (active) {
    const d = active.days[dayKey];
    if (!d || d.items.length === 0) return null;
    return {
      ...base,
      label: d.label,
      exercises: d.items.map<WorkoutSessionExercise>((it) => ({
        exerciseId: it.id,
        name: it.name,
        primary_muscles: it.primary_muscles,
        targetSets: it.sets,
        targetReps: it.reps,
        sets: [],
      })),
    };
  }
  const sched = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
  const d = sched?.[dayKey];
  if (!d || d.exerciseIds.length === 0) return null;
  return {
    ...base,
    label: d.label,
    exercises: d.exerciseIds.map<WorkoutSessionExercise>((eid) => {
      const ex = getExercise(eid);
      return {
        exerciseId: eid,
        name: ex?.name ?? eid,
        primary_muscles: ex?.muscleGroup ? [ex.muscleGroup] : [],
        targetSets: ex?.sets ?? 3,
        targetReps: ex?.reps ?? "8-12",
        sets: [],
      };
    }),
  };
}

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_SHORT: Record<DayKey, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun" };

function LiveWorkoutPage() {
  const [state, set] = useAppState();
  const nav = useNavigate();
  const score = useServerFn(scorePump);

  function startDay(dayKey: DayKey) {
    const s = buildSession(state, dayKey);
    if (!s) return;
    set((st) => ({ ...st, sessions: [...st.sessions, s], activeSessionId: s.id }));
  }

  useEffect(() => {
    if (state.activeSessionId) return;
    const s = buildSession(state, todayKey());
    if (!s) return;
    set((st) => ({ ...st, sessions: [...st.sessions, s], activeSessionId: s.id }));
  }, [state.activeSessionId]);

  const session = state.sessions.find((s) => s.id === state.activeSessionId);

  const [activeIdx, setActiveIdx] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const [restPreset, setRestPreset] = useState(90);
  const [videoQuery, setVideoQuery] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [scoring, setScoring] = useState(false);
  const [finished, setFinished] = useState(false);
  const [share, setShare] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);
  const [showRPE, setShowRPE] = useState(false);
  const [celebrate, setCelebrate] = useState<{ name: string; weight: number; reps: number } | null>(null);

  useEffect(() => {
    if (restLeft <= 0) return;
    const t = setTimeout(() => setRestLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restLeft]);

  const allLogs = state.logs;

  const totals = useMemo(() => {
    if (!session) return { vol: 0, sets: 0, prs: 0 };
    let vol = 0, sets = 0, prs = 0;
    session.exercises.forEach((e) => {
      e.sets.forEach((s) => {
        vol += s.weight * s.reps;
        sets += 1;
        if (s.isPR) prs += 1;
      });
    });
    return { vol, sets, prs };
  }, [session]);

  if (!session) {
    const active = state.programs.find((p) => p.id === state.activeProgramId);
    const today = todayKey();
    return (
      <div className="min-h-screen flex flex-col p-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/train" className="text-grit-dim"><X size={22} /></Link>
          <p className="display text-sm uppercase font-extrabold text-grit">Pick a Day</p>
          <div className="w-6" />
        </div>
        {active ? (
          <>
            <p className="label-cap text-grit-dim text-[10px] mb-1">ACTIVE PROGRAM</p>
            <p className="display text-xl uppercase font-extrabold text-grit mb-5 truncate">{active.name}</p>
            <div className="space-y-2 mb-6">
              {DAY_KEYS.map((k) => {
                const d = active.days[k];
                const count = d.items.length;
                const isToday = k === today;
                const empty = count === 0;
                return (
                  <button
                    key={k}
                    onClick={() => !empty && startDay(k)}
                    disabled={empty}
                    className="w-full bg-grit-card border p-3 flex items-center justify-between text-left disabled:opacity-50"
                    style={{ borderColor: isToday ? "#e63222" : "#262626" }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="label-cap text-[10px] text-grit-dim">{DAY_SHORT[k]}</span>
                        {isToday && <span className="text-[9px] px-1.5 py-0.5 bg-accent-red text-white label-cap">TODAY</span>}
                      </div>
                      <div className="display uppercase font-extrabold text-grit text-sm truncate">{d.label}</div>
                      <div className="text-[10px] label-cap text-grit-dim mt-0.5">{count} {count === 1 ? "exercise" : "exercises"}</div>
                    </div>
                    {empty ? (
                      <Link
                        to="/programs/$programId"
                        params={{ programId: active.id }}
                        className="text-[10px] label-cap text-accent-red"
                        onClick={(e) => e.stopPropagation()}
                      >
                        + ADD
                      </Link>
                    ) : (
                      <Play size={18} className="text-accent-red" />
                    )}
                  </button>
                );
              })}
            </div>
            <Link
              to="/programs/$programId"
              params={{ programId: active.id }}
              className="btn-ghost text-center"
            >
              Edit Program
            </Link>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="display text-2xl uppercase font-extrabold text-grit mb-2">No Program Active</p>
            <p className="text-sm text-[#8a8a8a] mb-6">Pick or build a program to start training.</p>
            <Link to="/programs" className="btn-grit">Browse Programs</Link>
          </div>
        )}
      </div>
    );
  }

  const current = session.exercises[activeIdx];
  const totalEx = session.exercises.length;
  const progress = Math.min(100, Math.round((totals.sets / Math.max(1, session.exercises.reduce((a, e) => a + e.targetSets, 0))) * 100));

  function updateSession(fn: (s: WorkoutSession) => WorkoutSession) {
    set((st) => ({
      ...st,
      sessions: st.sessions.map((s) => (s.id === session!.id ? fn(s) : s)),
    }));
  }

  function logSet(weight: number, reps: number, opts?: { rpe?: number; isAmrap?: boolean }) {
    if (!reps) return;
    const prevBest = Math.max(
      0,
      ...allLogs.filter((l) => l.exerciseId === current.exerciseId).map((l) => l.weight),
      ...session!.exercises[activeIdx].sets.map((s) => s.weight)
    );
    const isPR = weight > prevBest && weight > 0;
    const newSet: CompletedSet = { weight, reps, isPR, rpe: opts?.rpe, isAmrap: opts?.isAmrap };
    updateSession((sess) => {
      const exercises = sess.exercises.map((e, i) => (i === activeIdx ? { ...e, sets: [...e.sets, newSet] } : e));
      const totalVolume = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0);
      const prCount = exercises.reduce((a, e) => a + e.sets.filter((s) => s.isPR).length, 0);
      return { ...sess, exercises, totalVolume, prCount };
    });
    setRestLeft(restPreset);
    if (isPR) {
      try { navigator.vibrate?.([40, 60, 40]); } catch { /* noop */ }
      setCelebrate({ name: current.name, weight, reps });
    }
  }

  function removeLastSet() {
    updateSession((sess) => {
      const exercises = sess.exercises.map((e, i) => (i === activeIdx ? { ...e, sets: e.sets.slice(0, -1) } : e));
      const totalVolume = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0);
      const prCount = exercises.reduce((a, e) => a + e.sets.filter((s) => s.isPR).length, 0);
      return { ...sess, exercises, totalVolume, prCount };
    });
  }

  async function finishWorkout() {
    setScoring(true);
    const durationMin = Math.max(1, Math.round((Date.now() - new Date(session!.startedAt).getTime()) / 60000));
    let pump: { score: number; note: string } | null = null;
    try {
      pump = await score({ data: {
        label: session!.label,
        totalVolume: Math.round(totals.vol),
        prCount: totals.prs,
        sets: totals.sets,
        durationMin,
        exercises: session!.exercises.filter((e) => e.sets.length > 0).slice(0, 20).map((e) => {
          const top = e.sets.reduce((a, b) => (b.weight > a.weight ? b : a), e.sets[0]);
          return { name: e.name, sets: e.sets.length, topWeight: top.weight, topReps: top.reps };
        }),
      }});
    } catch { /* score is optional */ }

    const day = isoDay();
    set((st) => {
      const sessions = st.sessions.map((s) => s.id === session!.id ? {
        ...s,
        endedAt: new Date().toISOString(),
        pumpScore: pump?.score,
        pumpNote: pump?.note,
      } : s);
      const newLogs = [...st.logs];
      session!.exercises.forEach((e) => e.sets.forEach((s) => {
        newLogs.push({ exerciseId: e.exerciseId, weight: s.weight, reps: s.reps, date: new Date().toISOString() });
      }));
      return {
        ...st,
        sessions,
        logs: newLogs,
        activeSessionId: null,
        completedDates: st.completedDates.includes(day) ? st.completedDates : [...st.completedDates, day],
      };
    });
    setScoring(false);
    setFinished(true);
  }

  function discardWorkout() {
    if (!confirm("Discard this workout?")) return;
    set((st) => ({
      ...st,
      sessions: st.sessions.filter((s) => s.id !== session!.id),
      activeSessionId: null,
    }));
    nav({ to: "/train" });
  }

  if (finished) {
    const finalSession = state.sessions.find((s) => s.id === session.id) ?? session;
    return (
      <FinishedScreen
        session={finalSession}
        onClose={() => nav({ to: "/train" })}
        onShare={() => setShare(true)}
        share={share}
        onCloseShare={() => setShare(false)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={discardWorkout} className="text-grit-dim"><X size={22} /></button>
        <div className="text-center">
          <p className="label-cap text-[10px] text-accent-red">LIVE</p>
          <p className="display text-sm uppercase font-extrabold text-grit truncate max-w-[60vw]">{session.label}</p>
        </div>
        <Timer startedAt={session.startedAt} />
      </div>

      <div className="h-1 bg-[#1a1a1a]">
        <div className="h-full bg-accent-red transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid grid-cols-3 border-b border-grit bg-grit-card">
        <Stat label="VOLUME" value={`${Math.round(totals.vol)}kg`} />
        <Stat label="SETS" value={`${totals.sets}`} />
        <Stat label="PRS" value={`${totals.prs}`} accent={totals.prs > 0} />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-grit">
        {session.exercises.map((e, i) => {
          const done = e.sets.length >= e.targetSets;
          const active = i === activeIdx;
          return (
            <button key={i} onClick={() => setActiveIdx(i)}
              className="flex-shrink-0 px-3 py-1.5 border text-xs font-bold uppercase tracking-wider"
              style={{
                borderColor: active ? "#e63222" : done ? "#3a8a3a" : "#262626",
                color: active ? "#e63222" : done ? "#7acc7a" : "#8a8a8a",
                background: active ? "#1a0606" : "transparent",
              }}>
              {done && <Check size={10} className="inline mr-1 -mt-0.5" />}
              {i + 1}. {e.name.slice(0, 18)}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-5 py-4 overflow-auto">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="label-cap text-grit-dim text-[10px]">EXERCISE {activeIdx + 1}/{totalEx}</p>
            <h1 className="display text-2xl uppercase font-extrabold text-grit leading-tight">{current.name}</h1>
            <p className="text-xs text-[#8a8a8a] mt-1">{current.targetSets} × {current.targetReps}</p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <Link
              to="/lift/$exerciseId"
              params={{ exerciseId: current.exerciseId }}
              className="w-12 h-12 border border-grit flex items-center justify-center text-grit-dim"
              aria-label="Lift history"
            >
              <Trophy size={18} />
            </Link>
            <button onClick={() => { setVideoQuery(current.name + " form"); setVideoTitle(current.name); }}
              className="w-12 h-12 border border-accent-red flex items-center justify-center">
              <Play size={20} className="text-accent-red" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {current.sets.map((s, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_1fr_auto_auto] items-center gap-2 bg-grit-card border border-grit px-3 py-2.5">
              <div className="label-cap text-grit-dim">SET {i + 1}</div>
              <div><span className="display text-xl font-extrabold text-grit">{s.weight}</span><span className="text-xs text-[#8a8a8a] ml-1">kg</span></div>
              <div><span className="display text-xl font-extrabold text-grit">{s.reps}</span><span className="text-xs text-[#8a8a8a] ml-1">reps</span></div>
              <div className="flex items-center gap-1 text-[10px] text-grit-dim">
                {s.isAmrap && <span className="px-1 py-0.5 border border-grit-dim text-grit-dim">AMRAP</span>}
                {s.rpe != null && <span>RPE {s.rpe}</span>}
              </div>
              {s.isPR ? <Trophy size={16} className="text-accent-red" /> : <Check size={16} className="text-[#3a8a3a]" />}
            </div>
          ))}
          {current.sets.length === 0 && (
            <p className="text-xs text-[#8a8a8a] uppercase tracking-wider">No sets logged. Use the keypad below.</p>
          )}
        </div>

        <SetEntry
          onLog={logSet}
          prev={current.sets[current.sets.length - 1]}
          prevBestWeight={Math.max(0, ...allLogs.filter((l) => l.exerciseId === current.exerciseId).map((l) => l.weight))}
          lastSessionSet={(() => {
            const prior = allLogs.filter((l) => l.exerciseId === current.exerciseId);
            return prior.length ? prior[prior.length - 1] : null;
          })()}
          showRPE={showRPE}
          onToggleRPE={() => setShowRPE((v) => !v)}
          onOpenPlateCalc={() => setPlateOpen(true)}
        />

        {current.sets.length > 0 && (
          <button onClick={removeLastSet} className="mt-3 label-cap text-grit-dim text-xs flex items-center mx-auto">
            <Minus size={12} className="mr-1" /> Remove last set
          </button>
        )}
      </div>

      <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
        <span className="label-cap text-[10px] text-grit-dim">REST</span>
        {[60, 90, 120, 180].map((s) => (
          <button
            key={s}
            onClick={() => setRestPreset(s)}
            className={`px-2 py-1 text-[11px] font-bold border ${restPreset === s ? "bg-accent-red text-grit border-accent-red" : "border-grit text-grit-dim"}`}
          >
            {s}s
          </button>
        ))}
      </div>

      {restLeft > 0 && (
        <div className="sticky bottom-0 mx-4 mb-4 bg-grit-card border-2 border-accent-red p-3 flex items-center justify-between">
          <div>
            <p className="label-cap text-accent-red text-[10px]">RESTING</p>
            <p className="display text-3xl font-extrabold text-grit">{restLeft}s</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRestLeft((s) => s + 15)} className="btn-ghost"><Plus size={14} className="mr-1" />15s</button>
            <button onClick={() => setRestLeft(0)} className="btn-grit">Skip</button>
          </div>
        </div>
      )}

      <div className="border-t border-grit p-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setActiveIdx((i) => Math.min(totalEx - 1, i + 1))}
          disabled={activeIdx >= totalEx - 1}
          className="btn-ghost disabled:opacity-40">
          Next Exercise
        </button>
        <button onClick={finishWorkout} disabled={scoring || totals.sets === 0} className="btn-grit">
          {scoring ? <Loader2 className="animate-spin mr-2" size={16} /> : <Flame size={16} className="mr-2" />}
          Finish
        </button>
      </div>

      {videoQuery && <VideoModal query={videoQuery} title={videoTitle} onClose={() => setVideoQuery(null)} />}
      {plateOpen && (
        <PlateCalculator
          initialWeight={Number((document.getElementById("liveWeightInput") as HTMLInputElement | null)?.value) || 60}
          onClose={() => setPlateOpen(false)}
        />
      )}
      {celebrate && (
        <PRCelebration
          exerciseName={celebrate.name}
          weight={celebrate.weight}
          reps={celebrate.reps}
          onClose={() => setCelebrate(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center py-3 border-r border-grit last:border-r-0">
      <p className="label-cap text-[10px] text-grit-dim">{label}</p>
      <p className="display text-xl font-extrabold" style={{ color: accent ? "#e63222" : "#f5f5f0" }}>{value}</p>
    </div>
  );
}

function Timer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return <div className="text-right"><p className="label-cap text-[10px] text-grit-dim">ELAPSED</p><p className="display text-sm font-extrabold text-grit tabular-nums">{mm}:{ss}</p></div>;
}

function SetEntry({
  onLog, prev, prevBestWeight, lastSessionSet, showRPE, onToggleRPE, onOpenPlateCalc,
}: {
  onLog: (w: number, r: number, opts?: { rpe?: number; isAmrap?: boolean }) => void;
  prev?: CompletedSet;
  prevBestWeight: number;
  lastSessionSet: SetLog | null;
  showRPE: boolean;
  onToggleRPE: () => void;
  onOpenPlateCalc: () => void;
}) {
  const [w, setW] = useState<string>(prev ? String(prev.weight) : "");
  const [r, setR] = useState<string>(prev ? String(prev.reps) : "");
  const [rpe, setRpe] = useState<string>("");
  const [amrap, setAmrap] = useState(false);
  useEffect(() => { if (prev) { setW(String(prev.weight)); setR(String(prev.reps)); } }, [prev]);
  const wn = Number(w) || 0;
  const rn = Number(r) || 0;
  const willBePR = wn > prevBestWeight && wn > 0;
  const e1rm = wn && rn ? estimate1RM(wn, rn) : 0;
  const suggestedWeight = prev?.weight ?? lastSessionSet?.weight ?? 0;
  const suggestedReps = prev?.reps ?? lastSessionSet?.reps ?? 0;
  const progression = suggestedWeight > 0 ? suggestedWeight + 2.5 : 0;
  return (
    <div className="mt-5 bg-grit-card border border-grit p-4">
      {lastSessionSet && (
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-[11px] text-grit-dim uppercase tracking-wider truncate">
            Last time: <span className="text-grit font-bold">{lastSessionSet.weight}kg × {lastSessionSet.reps}</span>
          </p>
          {progression > 0 && (
            <button
              onClick={() => { setW(String(progression)); setR(String(suggestedReps || prev?.reps || 5)); }}
              className="text-[10px] px-2 py-1 border border-accent-red text-accent-red label-cap whitespace-nowrap flex items-center gap-1"
              title="Auto-fill suggested next set"
            >
              <Zap size={10} /> +2.5kg
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label-cap">Weight (kg)</label>
            <button onClick={onOpenPlateCalc} className="label-cap text-accent-red flex items-center text-[10px]">
              <Calculator size={11} className="mr-1" />Plates
            </button>
          </div>
          <div className="flex items-center">
            <button onClick={() => setW(String(Math.max(0, (Number(w) || 0) - 2.5)))} className="w-10 h-12 border border-grit text-grit">−</button>
            <input id="liveWeightInput" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} className="input-grit text-center flex-1 mx-0 border-l-0 border-r-0" />
            <button onClick={() => setW(String((Number(w) || 0) + 2.5))} className="w-10 h-12 border border-grit text-grit">+</button>
          </div>
        </div>
        <div>
          <label className="label-cap block mb-1">Reps</label>
          <div className="flex items-center">
            <button onClick={() => setR(String(Math.max(0, (Number(r) || 0) - 1)))} className="w-10 h-12 border border-grit text-grit">−</button>
            <input inputMode="numeric" value={r} onChange={(e) => setR(e.target.value)} className="input-grit text-center flex-1 mx-0 border-l-0 border-r-0" />
            <button onClick={() => setR(String((Number(r) || 0) + 1))} className="w-10 h-12 border border-grit text-grit">+</button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 text-[11px]">
        <button
          onClick={() => setAmrap((v) => !v)}
          className="px-2 py-1 border tracking-widest uppercase font-bold"
          style={{
            borderColor: amrap ? "#e63222" : "#262626",
            color: amrap ? "#e63222" : "#8a8a8a",
            background: amrap ? "#1a0606" : "transparent",
          }}
        >
          AMRAP
        </button>
        <button onClick={onToggleRPE} className="label-cap text-grit-dim">
          {showRPE ? "Hide RPE" : "+ RPE"}
        </button>
        {e1rm > 0 && (
          <span className="text-grit-dim">e1RM <span className="text-grit font-bold">{e1rm}kg</span></span>
        )}
      </div>

      {showRPE && (
        <div className="mb-3">
          <label className="label-cap block mb-1">RPE (1–10)</label>
          <div className="flex gap-1">
            {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
              <button
                key={v}
                onClick={() => setRpe(String(v))}
                className="flex-1 py-2 text-xs font-bold border"
                style={{
                  borderColor: rpe === String(v) ? "#e63222" : "#262626",
                  color: rpe === String(v) ? "#e63222" : "#8a8a8a",
                  background: rpe === String(v) ? "#1a0606" : "transparent",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          onLog(wn, rn, {
            rpe: rpe ? Number(rpe) : undefined,
            isAmrap: amrap || undefined,
          });
          if (amrap) setAmrap(false);
        }}
        disabled={!rn}
        className="btn-grit w-full disabled:opacity-40"
      >
        {willBePR && <Trophy size={14} className="mr-2" />}
        Log Set {willBePR ? "— PR!" : ""}
      </button>
    </div>
  );
}

function FinishedScreen({ session, onClose, onShare, share, onCloseShare }: { session: WorkoutSession; onClose: () => void; onShare: () => void; share: boolean; onCloseShare: () => void }) {
  const totalSets = session.exercises.reduce((s, e) => s + e.sets.length, 0);
  const durationMin = Math.max(1, Math.round(((session.endedAt ? new Date(session.endedAt).getTime() : Date.now()) - new Date(session.startedAt).getTime()) / 60000));
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex-1 px-6 pt-10 pb-6 flex flex-col">
        <p className="label-cap text-accent-red">SESSION COMPLETE</p>
        <h1 className="display text-5xl font-extrabold uppercase text-grit leading-none mt-2">{session.label.split(" — ")[0]}</h1>

        {session.pumpScore != null && (
          <div className="mt-8 border-2 border-accent-red p-5 bg-grit-card">
            <p className="label-cap text-accent-red text-[10px]">PUMP SCORE</p>
            <div className="flex items-end gap-3 mt-1">
              <p className="display text-[88px] leading-none font-extrabold text-grit">{session.pumpScore}</p>
              <p className="text-xs text-grit-dim pb-3">/ 100</p>
            </div>
            {session.pumpNote && <p className="display text-sm uppercase font-bold text-grit mt-2">"{session.pumpNote}"</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-6">
          <BigStat label="VOLUME" value={`${Math.round(session.totalVolume).toLocaleString()}kg`} />
          <BigStat label="DURATION" value={`${durationMin}min`} />
          <BigStat label="SETS" value={String(totalSets)} />
          <BigStat label="PRS" value={String(session.prCount)} accent={session.prCount > 0} />
        </div>

        <div className="mt-auto pt-6 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="btn-ghost">Done</button>
          <button onClick={onShare} className="btn-grit"><Share2 size={16} className="mr-2" />Share</button>
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
      <p className="display text-3xl font-extrabold mt-1" style={{ color: accent ? "#e63222" : "#f5f5f0" }}>{value}</p>
    </div>
  );
}
