import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { X, Check, Play, Trophy, Share2, Flame } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { defaultSchedule, isoDay, todayKey } from "@/lib/calc";
import { emitGritEarned } from "@/lib/grit-events";
import { VideoModal } from "@/components/VideoModal";
import { ShareCard } from "@/components/ShareCard";
import { GritEarnedLayer } from "@/components/GritEarnedLayer";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  CompletedSet,
  DayKey,
  Program,
  Schedule,
} from "@/lib/types";

export const Route = createFileRoute("/workout/live")({
  head: () => ({ meta: [{ title: "DEADSET — Live Workout" }] }),
  component: LiveWorkoutPage,
});

type WorkoutSource = "auto" | "program" | "schedule";

function getScheduleForState(state: ReturnType<typeof useAppState>[0]) {
  return state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
}

function buildSession(
  state: ReturnType<typeof useAppState>[0],
  dayKey: DayKey,
  source: WorkoutSource = "auto",
): WorkoutSession | null {
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
  if (active && source !== "schedule") {
    const d = active.days[dayKey];
    if (d?.items.length) {
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
    if (source === "program") return null;
    // If the active programme has a rest day, fall through to the user's own
    // schedule instead of blocking training entirely.
  }
  const sched = getScheduleForState(state);
  const d = sched?.[dayKey];
  if (!d || d.exerciseIds.length === 0) return null;
  return {
    ...base,
    label: d.label,
    programId: null,
    exercises: d.exerciseIds.map<WorkoutSessionExercise>((eid) => {
      const ex = getExercise(eid);
      return {
        exerciseId: eid,
        name: ex?.name ?? eid,
        primary_muscles: ex?.muscleGroup ? [ex.muscleGroup] : [],
        targetSets: d.sets ?? ex?.sets ?? 3,
        targetReps: d.reps ?? ex?.reps ?? "8-12",
        sets: [],
      };
    }),
  };
}

function DayPickerRow({
  dayKey,
  label,
  count,
  isToday,
  onStart,
  emptyCta,
}: {
  dayKey: DayKey;
  label: string;
  count: number;
  isToday: boolean;
  onStart: () => void;
  emptyCta?: ReactNode;
}) {
  const empty = count === 0;
  return (
    <button
      onClick={() => !empty && onStart()}
      disabled={empty}
      className="w-full bg-grit-card border p-3 flex items-center justify-between text-left disabled:opacity-50"
      style={{ borderColor: isToday ? "#e63222" : "#262626" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="label-cap text-[10px] text-grit-dim">{DAY_SHORT[dayKey]}</span>
          {isToday && (
            <span className="text-[9px] px-1.5 py-0.5 bg-accent-red text-white label-cap">
              TODAY
            </span>
          )}
        </div>
        <div className="display uppercase font-extrabold text-grit text-sm truncate">{label}</div>
        <div className="text-[10px] label-cap text-grit-dim mt-0.5">
          {count} {count === 1 ? "exercise" : "exercises"}
        </div>
      </div>
      {empty ? (
        (emptyCta ?? <span className="text-[10px] label-cap text-grit-dim">REST</span>)
      ) : (
        <Play size={18} className="text-accent-red" />
      )}
    </button>
  );
}

function ScheduleDayPicker({
  schedule,
  today,
  onStart,
}: {
  schedule: Schedule;
  today: DayKey;
  onStart: (dayKey: DayKey) => void;
}) {
  return (
    <>
      <p className="label-cap text-grit-dim text-[10px] mb-1">YOUR SCHEDULE</p>
      <p className="display text-xl uppercase font-extrabold text-grit mb-5">Train from schedule</p>
      <div className="space-y-2 mb-6">
        {DAY_KEYS.map((k) => {
          const d = schedule[k];
          return (
            <DayPickerRow
              key={k}
              dayKey={k}
              label={d?.label || "REST"}
              count={d?.exerciseIds.length || 0}
              isToday={k === today}
              onStart={() => onStart(k)}
            />
          );
        })}
      </div>
      <Link to="/train" className="btn-ghost text-center">
        Edit Schedule
      </Link>
    </>
  );
}

function ProgramDayPicker({
  active,
  schedule,
  today,
  onStartProgram,
  onStartSchedule,
}: {
  active: Program;
  schedule: Schedule | null;
  today: DayKey;
  onStartProgram: (dayKey: DayKey) => void;
  onStartSchedule: (dayKey: DayKey) => void;
}) {
  return (
    <>
      <p className="label-cap text-grit-dim text-[10px] mb-1">ACTIVE PROGRAM</p>
      <p className="display text-xl uppercase font-extrabold text-grit mb-5 truncate">
        {active.name}
      </p>
      <div className="space-y-2 mb-6">
        {DAY_KEYS.map((k) => {
          const d = active.days[k];
          return (
            <DayPickerRow
              key={k}
              dayKey={k}
              label={d.label}
              count={d.items.length}
              isToday={k === today}
              onStart={() => onStartProgram(k)}
              emptyCta={
                <Link
                  to="/programs/$programId"
                  params={{ programId: active.id }}
                  className="text-[10px] label-cap text-accent-red"
                  onClick={(e) => e.stopPropagation()}
                >
                  + ADD
                </Link>
              }
            />
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
      {schedule && (
        <div className="mt-6 border-t border-grit pt-6">
          <ScheduleDayPicker schedule={schedule} today={today} onStart={onStartSchedule} />
        </div>
      )}
    </>
  );
}

/*
  Keep the live workout route usable even when there is no selected programme.
  The user's schedule is the source of truth for ordinary training.
*/

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_SHORT: Record<DayKey, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function LiveWorkoutPage() {
  const [state, set] = useAppState();
  const nav = useNavigate();

  function startDay(dayKey: DayKey, source: WorkoutSource = "auto") {
    const s = buildSession(state, dayKey, source);
    if (!s) return;
    set((st) => ({ ...st, sessions: [...st.sessions, s], activeSessionId: s.id }));
  }

  useEffect(() => {
    set((st) => {
      if (st.activeSessionId) return st;
      const s = buildSession(st, todayKey());
      if (!s) return st;
      return { ...st, sessions: [...st.sessions, s], activeSessionId: s.id };
    });
  }, [set]);

  const session = state.sessions.find((s) => s.id === state.activeSessionId);

  const [activeIdx, setActiveIdx] = useState(0);
  const [videoQuery, setVideoQuery] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [finished, setFinished] = useState(false);
  const [share, setShare] = useState(false);
  const [prPromptOpen, setPrPromptOpen] = useState(false);
  const [prMode, setPrMode] = useState<"ask" | "form">("ask");
  const [prExerciseId, setPrExerciseId] = useState("");
  const [prWeight, setPrWeight] = useState("");
  const [prReps, setPrReps] = useState("1");

  const totals = useMemo(() => {
    if (!session) return { vol: 0, sets: 0, prs: 0 };
    let vol = 0,
      sets = 0,
      prs = 0;
    session.exercises.forEach((e) => {
      e.sets.forEach((s) => {
        vol += s.weight * s.reps;
        sets += 1;
        if (s.isPR) prs += 1;
      });
    });
    return { vol, sets, prs };
  }, [session]);

  const plannedSets = useMemo(
    () => session?.exercises.reduce((sum, e) => sum + e.targetSets, 0) ?? 0,
    [session],
  );

  useEffect(() => {
    if (!session?.exercises.length) return;
    setPrExerciseId((current) => current || session.exercises[0].exerciseId);
  }, [session]);

  if (!session) {
    const active = state.programs.find((p) => p.id === state.activeProgramId);
    const schedule = getScheduleForState(state);
    const today = todayKey();
    return (
      <div
        className="min-h-screen flex flex-col p-6"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <Link to="/train" className="text-grit-dim">
            <X size={22} />
          </Link>
          <p className="display text-sm uppercase font-extrabold text-grit">Pick a Day</p>
          <div className="w-6" />
        </div>
        {active ? (
          <ProgramDayPicker
            active={active}
            schedule={schedule}
            today={today}
            onStartProgram={(k) => startDay(k, "program")}
            onStartSchedule={(k) => startDay(k, "schedule")}
          />
        ) : schedule ? (
          <ScheduleDayPicker
            schedule={schedule}
            today={today}
            onStart={(k) => startDay(k, "schedule")}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="display text-2xl uppercase font-extrabold text-grit mb-2">
              No Schedule Yet
            </p>
            <p className="text-sm text-[#8a8a8a] mb-6">
              Create your weekly schedule once, then start workouts from it any time.
            </p>
            <Link to="/train" className="btn-grit">
              Build Schedule
            </Link>
          </div>
        )}
      </div>
    );
  }

  const current = session.exercises[activeIdx];
  const totalEx = session.exercises.length;
  const progress = Math.round(((activeIdx + 1) / Math.max(1, totalEx)) * 100);

  function finishWorkout(pr?: { exerciseId: string; weight: number; reps: number }) {
    const prExercise = pr
      ? (session!.exercises.find((e) => e.exerciseId === pr.exerciseId) ?? session!.exercises[0])
      : null;
    const prSet: CompletedSet | null = pr ? { weight: pr.weight, reps: pr.reps, isPR: true } : null;
    const finalExercises = prSet
      ? session!.exercises.map((e) =>
          e.exerciseId === prExercise!.exerciseId ? { ...e, sets: [prSet] } : e,
        )
      : session!.exercises;
    const finalVolume = prSet ? prSet.weight * prSet.reps : 0;
    const finalPrCount = prSet ? 1 : 0;

    const day = isoDay();
    set((st) => {
      const sessions = st.sessions.map((s) =>
        s.id === session!.id
          ? {
              ...s,
              exercises: finalExercises,
              totalVolume: finalVolume,
              prCount: finalPrCount,
              endedAt: new Date().toISOString(),
            }
          : s,
      );
      const newLogs = [...st.logs];
      if (pr) {
        newLogs.push({
          exerciseId: pr.exerciseId,
          weight: pr.weight,
          reps: pr.reps,
          date: new Date().toISOString(),
        });
      }
      return {
        ...st,
        sessions,
        logs: newLogs,
        activeSessionId: null,
        completedDates: st.completedDates.includes(day)
          ? st.completedDates
          : [...st.completedDates, day],
      };
    });
    setFinished(true);
    emitGritEarned(pr ? 75 : 50, pr ? "PR LOCKED" : "WORKOUT COMPLETE", pr ? "pr" : "quest");
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
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={discardWorkout} className="text-grit-dim">
          <X size={22} />
        </button>
        <div className="text-center">
          <p className="label-cap text-[10px] text-accent-red">LIVE</p>
          <p className="display text-sm uppercase font-extrabold text-grit truncate max-w-[60vw]">
            {session.label}
          </p>
        </div>
        <Timer startedAt={session.startedAt} />
      </div>

      <div className="h-1 bg-[#1a1a1a]">
        <div className="h-full bg-accent-red transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid grid-cols-3 border-b border-grit bg-grit-card">
        <Stat label="EXERCISES" value={`${totalEx}`} />
        <Stat label="PLANNED SETS" value={`${plannedSets}`} />
        <Stat label="PRS" value={`${totals.prs}`} accent={totals.prs > 0} />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-grit">
        {session.exercises.map((e, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className="flex-shrink-0 px-3 py-1.5 border text-xs font-bold uppercase tracking-wider"
              style={{
                borderColor: active ? "#e63222" : done ? "#3a8a3a" : "#262626",
                color: active ? "#e63222" : done ? "#7acc7a" : "#8a8a8a",
                background: active ? "#1a0606" : "transparent",
              }}
            >
              {done && <Check size={10} className="inline mr-1 -mt-0.5" />}
              {i + 1}. {e.name.slice(0, 18)}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-5 py-4 overflow-auto">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="label-cap text-grit-dim text-[10px]">
              EXERCISE {activeIdx + 1}/{totalEx}
            </p>
            <h1 className="display text-2xl uppercase font-extrabold text-grit leading-tight">
              {current.name}
            </h1>
            <p className="text-xs text-[#8a8a8a] mt-1">
              {current.targetSets} × {current.targetReps}
            </p>
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
            <button
              onClick={() => {
                setVideoQuery(current.name + " form");
                setVideoTitle(current.name);
              }}
              className="w-12 h-12 border border-accent-red flex items-center justify-center"
            >
              <Play size={20} className="text-accent-red" />
            </button>
          </div>
        </div>

        <div className="mt-5 bg-grit-card border border-grit rounded-2xl p-4">
          <p className="label-cap text-accent-red text-[10px]">DO THIS</p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="border border-grit rounded-xl p-3">
              <p className="label-cap text-[10px]">Sets</p>
              <p className="display text-3xl font-extrabold text-grit leading-none mt-1">
                {current.targetSets}
              </p>
            </div>
            <div className="border border-grit rounded-xl p-3">
              <p className="label-cap text-[10px]">Reps</p>
              <p className="display text-3xl font-extrabold text-grit leading-none mt-1">
                {current.targetReps}
              </p>
            </div>
          </div>
          <p className="text-sm text-grit-dim mt-4 leading-relaxed">
            Follow the plan. No logging during the workout. At the end, just tell DEADSET if you hit
            a PR.
          </p>
        </div>
      </div>

      <div className="border-t border-grit p-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setActiveIdx((i) => Math.min(totalEx - 1, i + 1))}
          disabled={activeIdx >= totalEx - 1}
          className="btn-ghost disabled:opacity-40"
        >
          Next Exercise
        </button>
        <button
          onClick={() => {
            setPrPromptOpen(true);
            setPrMode("ask");
            setPrExerciseId(current.exerciseId);
          }}
          className="btn-grit"
        >
          <Flame size={16} className="mr-2" />
          Finish
        </button>
      </div>

      {videoQuery && (
        <VideoModal query={videoQuery} title={videoTitle} onClose={() => setVideoQuery(null)} />
      )}
      {prPromptOpen && (
        <PRFinishModal
          mode={prMode}
          exercises={session.exercises}
          exerciseId={prExerciseId}
          weight={prWeight}
          reps={prReps}
          onMode={setPrMode}
          onExerciseId={setPrExerciseId}
          onWeight={setPrWeight}
          onReps={setPrReps}
          onCancel={() => setPrPromptOpen(false)}
          onNoPR={() => finishWorkout()}
          onSavePR={() => {
            const weight = Number(prWeight);
            const reps = Number(prReps) || 1;
            if (!prExerciseId || !weight) return;
            finishWorkout({ exerciseId: prExerciseId, weight, reps });
          }}
        />
      )}
      <GritEarnedLayer />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center py-3 border-r border-grit last:border-r-0">
      <p className="label-cap text-[10px] text-grit-dim">{label}</p>
      <p
        className="display text-xl font-extrabold"
        style={{ color: accent ? "#e63222" : "#f5f5f0" }}
      >
        {value}
      </p>
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
      <p className="display text-sm font-extrabold text-grit tabular-nums">
        {mm}:{ss}
      </p>
    </div>
  );
}

function PRFinishModal({
  mode,
  exercises,
  exerciseId,
  weight,
  reps,
  onMode,
  onExerciseId,
  onWeight,
  onReps,
  onCancel,
  onNoPR,
  onSavePR,
}: {
  mode: "ask" | "form";
  exercises: WorkoutSessionExercise[];
  exerciseId: string;
  weight: string;
  reps: string;
  onMode: (mode: "ask" | "form") => void;
  onExerciseId: (id: string) => void;
  onWeight: (value: string) => void;
  onReps: (value: string) => void;
  onCancel: () => void;
  onNoPR: () => void;
  onSavePR: () => void;
}) {
  const canSave = Number(weight) > 0 && Number(reps) > 0 && !!exerciseId;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 px-4 pb-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-accent-red/60 bg-grit-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "ask" ? (
          <>
            <p className="label-cap text-accent-red text-[10px]">FINISH WORKOUT</p>
            <h2 className="display text-3xl font-extrabold uppercase text-grit leading-none mt-2">
              Did you hit a PR?
            </h2>
            <p className="text-sm text-grit-dim mt-3 leading-relaxed">
              If not, you’re done. DEADSET will mark the workout complete and give you the grit for
              showing up.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={onNoPR} className="btn-ghost py-3">
                No PR
              </button>
              <button onClick={() => onMode("form")} className="btn-grit py-3">
                Yes
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="label-cap text-accent-red text-[10px]">LOG THE PR</p>
            <h2 className="display text-3xl font-extrabold uppercase text-grit leading-none mt-2">
              What did you hit?
            </h2>
            <div className="mt-5 space-y-3">
              <div>
                <label className="label-cap block mb-1">Exercise</label>
                <select
                  value={exerciseId}
                  onChange={(e) => onExerciseId(e.target.value)}
                  className="input-grit"
                >
                  {exercises.map((e) => (
                    <option key={e.exerciseId} value={e.exerciseId}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-cap block mb-1">Weight (kg)</label>
                  <input
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => onWeight(e.target.value)}
                    placeholder="100"
                    className="input-grit"
                  />
                </div>
                <div>
                  <label className="label-cap block mb-1">Reps</label>
                  <input
                    inputMode="numeric"
                    value={reps}
                    onChange={(e) => onReps(e.target.value)}
                    placeholder="1"
                    className="input-grit"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={() => onMode("ask")} className="btn-ghost py-3">
                Back
              </button>
              <button onClick={onSavePR} disabled={!canSave} className="btn-grit py-3">
                <Trophy size={16} className="mr-2" />
                Save PR
              </button>
            </div>
          </>
        )}
      </div>
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
  const plannedSets = session.exercises.reduce((s, e) => s + e.targetSets, 0);
  const durationMin = Math.max(
    1,
    Math.round(
      ((session.endedAt ? new Date(session.endedAt).getTime() : Date.now()) -
        new Date(session.startedAt).getTime()) /
        60000,
    ),
  );
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex-1 px-6 pt-10 pb-6 flex flex-col">
        <p className="label-cap text-accent-red">SESSION COMPLETE</p>
        <h1 className="display text-5xl font-extrabold uppercase text-grit leading-none mt-2">
          {session.label.split(" — ")[0]}
        </h1>

        <div className="grid grid-cols-2 gap-3 mt-8">
          <BigStat label="EXERCISES" value={String(session.exercises.length)} />
          <BigStat label="DURATION" value={`${durationMin}min`} />
          <BigStat label="PLANNED SETS" value={String(plannedSets)} />
          <BigStat label="PRS" value={String(session.prCount)} accent={session.prCount > 0} />
        </div>

        <div className="mt-auto pt-6 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="btn-ghost">
            Done
          </button>
          <button onClick={onShare} className="btn-grit">
            <Share2 size={16} className="mr-2" />
            Share
          </button>
        </div>
      </div>
      {share && <ShareCard session={session} onClose={onCloseShare} />}
      <GritEarnedLayer />
    </div>
  );
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-grit-card border border-grit p-4">
      <p className="label-cap text-[10px] text-grit-dim">{label}</p>
      <p
        className="display text-3xl font-extrabold mt-1"
        style={{ color: accent ? "#e63222" : "#f5f5f0" }}
      >
        {value}
      </p>
    </div>
  );
}
