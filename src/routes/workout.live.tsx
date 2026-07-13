import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { X, Check, Play, Trophy, Share2, Flame, Calculator, Lock, TrendingUp } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { defaultSchedule, isoDay, todayKey, plateBreakdown, warmupRamp } from "@/lib/calc";
import { topSetHistory, suggestNextWeight, type TopSet, type Suggestion } from "@/lib/progression";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { emitGritEarned } from "@/lib/grit-events";
import { VideoModal } from "@/components/VideoModal";
import { ShareCard } from "@/components/ShareCard";
import { GritEarnedLayer } from "@/components/GritEarnedLayer";
import type {
  AppState,
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
      const cfg = d.exerciseConfig?.[eid];
      return {
        exerciseId: eid,
        name: ex?.name ?? eid,
        primary_muscles: ex?.muscleGroup ? [ex.muscleGroup] : [],
        targetSets: cfg?.sets ?? d.sets ?? ex?.sets ?? 3,
        targetReps: cfg?.reps ?? d.reps ?? ex?.reps ?? "8-12",
        plannedWeightKg: cfg?.weightKg,
        sets: [],
      };
    }),
  };
}

/**
 * Historical bests for an exercise, merging manual set logs with every
 * session's logged sets (the gatherLogs idiom, collapsed to the two numbers
 * PR detection needs). Weight PRs compare against the heaviest set ever;
 * bodyweight (0 kg) PRs compare against the best bodyweight rep count.
 */
function bestsFor(state: AppState, exerciseId: string): { bestWeight: number; bestBwReps: number } {
  let bestWeight = 0;
  let bestBwReps = 0;
  const consider = (weight: number, reps: number) => {
    if (weight > bestWeight) bestWeight = weight;
    if (weight === 0 && reps > bestBwReps) bestBwReps = reps;
  };
  state.logs.forEach((l) => {
    if (l.exerciseId === exerciseId) consider(l.weight, l.reps);
  });
  state.sessions.forEach((s) =>
    s.exercises.forEach((e) => {
      if (e.exerciseId !== exerciseId) return;
      e.sets.forEach((cs) => consider(cs.weight, cs.reps));
    }),
  );
  return { bestWeight, bestBwReps };
}

/** Last logged set for an exercise from the most recent other session. */
function prefillFromHistory(
  state: AppState,
  currentSessionId: string,
  exerciseId: string,
): { weight: string; reps: string } {
  const sorted = [...state.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const s of sorted) {
    if (s.id === currentSessionId) continue;
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      const last = e.sets[e.sets.length - 1];
      if (last) return { weight: String(last.weight), reps: String(last.reps) };
    }
  }
  return { weight: "", reps: "" };
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
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restNow, setRestNow] = useState(() => Date.now());

  useEffect(() => {
    if (restEndsAt === null) return;
    setRestNow(Date.now());
    const t = setInterval(() => setRestNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [restEndsAt]);

  const restLeft =
    restEndsAt === null ? null : Math.max(0, Math.ceil((restEndsAt - restNow) / 1000));

  // Auto-dismiss the rest banner shortly after hitting zero (with a pulse).
  useEffect(() => {
    if (restLeft !== 0) return;
    const t = setTimeout(() => setRestEndsAt(null), 900);
    return () => clearTimeout(t);
  }, [restLeft]);

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

  const { isPro, loading: proLoading } = usePro();

  // Progression data for the active exercise (Pro surfaces).
  const activeExercise = session?.exercises[activeIdx];
  const evolution = useMemo(
    () => (activeExercise ? topSetHistory(state, activeExercise.exerciseId) : []),
    [state, activeExercise],
  );
  const suggestion = useMemo(
    () =>
      activeExercise
        ? suggestNextWeight(state, activeExercise.exerciseId, activeExercise.targetReps)
        : null,
    [state, activeExercise],
  );

  // Prefill priority: allocated weight from the schedule → previous set this
  // session → last session containing the exercise → empty.
  const prefill = useMemo(() => {
    const ex = session?.exercises[activeIdx];
    if (!session || !ex) return { weight: "", reps: "" };
    const last = ex.sets[ex.sets.length - 1];
    if (last) return { weight: String(last.weight), reps: String(last.reps) };
    const repsGuess = String(ex.targetReps).match(/\d+/)?.[0] ?? "";
    if (ex.plannedWeightKg != null) return { weight: String(ex.plannedWeightKg), reps: repsGuess };
    const hist = prefillFromHistory(state, session.id, ex.exerciseId);
    if (hist.weight) return hist;
    return { weight: "", reps: repsGuess };
  }, [state, session, activeIdx]);

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
  const progress = Math.min(100, Math.round((totals.sets / Math.max(1, plannedSets)) * 100));


  function logSet(weight: number, reps: number) {
    const ex = session!.exercises[activeIdx];
    if (!ex) return;
    const { bestWeight, bestBwReps } = bestsFor(state, ex.exerciseId);
    const isPR = weight > 0 ? weight > bestWeight : reps > bestBwReps;
    const newSet: CompletedSet = isPR ? { weight, reps, isPR: true } : { weight, reps };
    set((st) => ({
      ...st,
      sessions: st.sessions.map((s) =>
        s.id === session!.id
          ? {
              ...s,
              exercises: s.exercises.map((e, i) =>
                i === activeIdx ? { ...e, sets: [...e.sets, newSet] } : e,
              ),
            }
          : s,
      ),
    }));
    if (isPR) emitGritEarned(25, `NEW PR — ${ex.name.toUpperCase()}`, "pr");
    setRestEndsAt(Date.now() + 90_000);
  }

  function finishWorkout() {
    const day = isoDay();
    const endedAt = new Date().toISOString();
    set((st) => {
      const live = st.sessions.find((s) => s.id === session!.id);
      if (!live) return st;
      let totalVolume = 0;
      let prCount = 0;
      live.exercises.forEach((e) =>
        e.sets.forEach((cs) => {
          totalVolume += cs.weight * cs.reps;
          if (cs.isPR) prCount += 1;
        }),
      );
      const newLogs = [...st.logs];
      live.exercises.forEach((e) => {
        let best: CompletedSet | null = null;
        e.sets.forEach((cs) => {
          if (cs.weight <= 0) return;
          if (!best || cs.weight > best.weight || (cs.weight === best.weight && cs.reps > best.reps))
            best = cs;
        });
        if (best) {
          const b: CompletedSet = best;
          newLogs.push({ exerciseId: e.exerciseId, weight: b.weight, reps: b.reps, date: endedAt });
        }
      });
      return {
        ...st,
        sessions: st.sessions.map((s) =>
          s.id === live.id ? { ...s, totalVolume, prCount, endedAt } : s,
        ),
        logs: newLogs,
        activeSessionId: null,
        completedDates: st.completedDates.includes(day)
          ? st.completedDates
          : [...st.completedDates, day],
      };
    });
    setRestEndsAt(null);
    setFinished(true);
    emitGritEarned(50, "WORKOUT COMPLETE", "quest");
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
        <Stat label="SETS" value={`${totals.sets}/${plannedSets}`} />
        <Stat label="PRS" value={`${totals.prs}`} accent={totals.prs > 0} />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-grit">
        {session.exercises.map((e, i) => {
          const done = e.targetSets > 0 && e.sets.length >= e.targetSets;
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

        <SetLogger
          key={`${session.id}:${activeIdx}`}
          exercise={current}
          initialWeight={prefill.weight}
          initialReps={prefill.reps}
          history={evolution}
          suggestion={suggestion}
          isProUser={isPro}
          proLoading={proLoading}
          onLog={logSet}
        />
      </div>

      {restLeft !== null && (
        <div
          className="border-t border-grit bg-grit-card px-4 py-3 flex items-center justify-between gap-3 animate-slide-up"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="min-w-0">
            <p className="label-cap text-[10px] text-accent-red">REST</p>
            <p
              className={`font-mono text-3xl font-extrabold tabular-nums leading-none mt-0.5 ${
                restLeft === 0 ? "animate-pulse text-accent-red" : "text-grit"
              }`}
            >
              {String(Math.floor(restLeft / 60)).padStart(2, "0")}:
              {String(restLeft % 60).padStart(2, "0")}
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => setRestEndsAt((t) => (t === null ? null : t + 30_000))}
              className="btn-ghost press px-3 py-2 text-xs"
            >
              +30s
            </button>
            <button
              onClick={() => setRestEndsAt(null)}
              className="btn-ghost press px-3 py-2 text-xs"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      <div
        className="border-t border-grit p-4 grid grid-cols-2 gap-3"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => setActiveIdx((i) => Math.min(totalEx - 1, i + 1))}
          disabled={activeIdx >= totalEx - 1}
          className="btn-ghost disabled:opacity-40"
        >
          Next Exercise
        </button>
        <button
          onClick={() => {
            if (totals.sets === 0 && !confirm("No sets logged — finish anyway?")) return;
            finishWorkout();
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
      <p className="label-cap text-[10px] text-accent-red">ELAPSED</p>
      <p className="display text-2xl font-extrabold text-grit tabular-nums leading-none">
        {mm}:{ss}
      </p>
    </div>
  );
}

function SetLogger({
  exercise,
  initialWeight,
  initialReps,
  history,
  suggestion,
  isProUser,
  proLoading,
  onLog,
}: {
  exercise: WorkoutSessionExercise;
  initialWeight: string;
  initialReps: string;
  history: TopSet[];
  suggestion: Suggestion | null;
  isProUser: boolean;
  proLoading: boolean;
  onLog: (weight: number, reps: number) => void;
}) {
  // DOM-owned inputs (defaultValue + shadow state): React never rewrites the
  // field after mount — the same pattern the auth screen settled on after the
  // mobile typing freezes.
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [platesOpen, setPlatesOpen] = useState(false);
  const weightRef = useRef<HTMLInputElement>(null);
  const weightNum = Number(weight.replace(/[^0-9.]/g, "")) || 0;
  const repsNum = Math.floor(Number(reps.replace(/[^0-9]/g, "")) || 0);
  const plates = platesOpen && weightNum >= 20 ? plateBreakdown(weightNum) : null;
  const ramp = exercise.sets.length === 0 && weightNum >= 30 ? warmupRamp(weightNum) : [];
  const canLog = weight.trim() !== "" && repsNum > 0;
  const progressionLocked = !proLoading && !isProUser;

  const logged = exercise.sets.length;
  const planned = exercise.targetSets;
  const pendingCount = Math.max(0, planned - logged - 1);
  const plannedHint =
    exercise.plannedWeightKg != null ? `${exercise.plannedWeightKg}kg` : weight || "—";

  function applySuggestion() {
    if (progressionLocked) {
      openPaywall("progression");
      return;
    }
    if (!suggestion) return;
    setWeight(String(suggestion.weightKg));
    if (weightRef.current) weightRef.current.value = String(suggestion.weightKg);
  }

  return (
    <div className="mt-5 bg-grit-card border border-grit rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="label-cap text-accent-red text-[10px]">YOUR PLAN — LIVE</p>
        <p className="label-cap text-[10px] text-grit-dim">
          {logged}/{planned} · {exercise.targetReps} reps
          {exercise.plannedWeightKg != null && ` · ${exercise.plannedWeightKg}kg`}
        </p>
      </div>

      {history.length >= 2 && (
        <button
          type="button"
          onClick={() => progressionLocked && openPaywall("progression")}
          className="mt-3 w-full text-left border border-grit rounded-xl px-3 py-2 press"
        >
          <div className="flex items-center justify-between">
            <span className="label-cap text-[9px] text-grit-dim flex items-center gap-1.5">
              <TrendingUp size={11} className="text-accent-red" /> EVOLUTION
            </span>
            {progressionLocked && <Lock size={11} className="text-accent-red" />}
          </div>
          <div
            className={
              "mt-1.5 flex items-baseline gap-1.5 flex-wrap" +
              (progressionLocked ? " blur-[5px] select-none" : "")
            }
            aria-hidden={progressionLocked || undefined}
          >
            {history.map((h, i) => (
              <span key={h.date + i} className="flex items-baseline gap-1.5">
                <span
                  className={
                    "display font-extrabold leading-none " +
                    (i === history.length - 1 ? "text-lg text-accent-red" : "text-sm text-grit")
                  }
                >
                  {h.weight}
                </span>
                {i < history.length - 1 && <span className="text-grit-dim text-[10px]">→</span>}
              </span>
            ))}
            <span className="label-cap text-[8px] text-grit-dim ml-1">KG TOP SET</span>
          </div>
        </button>
      )}

      {suggestion && (
        <button
          type="button"
          onClick={applySuggestion}
          className="mt-2 w-full flex items-center justify-between border border-accent-red/40 bg-accent-red/10 rounded-xl px-3 py-2 press text-left"
        >
          <span>
            <span className="label-cap text-[9px] text-accent-red block">
              {progressionLocked ? "SMART SUGGESTION" : suggestion.kind === "up" ? "MOVE UP" : "HOLD & EARN IT"}
            </span>
            <span
              className={
                "text-xs text-grit font-bold" + (progressionLocked ? " blur-[5px] select-none" : "")
              }
            >
              {suggestion.weightKg}kg — {suggestion.reason}
            </span>
          </span>
          {progressionLocked ? (
            <Lock size={13} className="text-accent-red shrink-0 ml-2" />
          ) : (
            <span className="label-cap text-[9px] text-accent-red shrink-0 ml-2">APPLY</span>
          )}
        </button>
      )}

      {ramp.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="label-cap text-[9px] text-grit-dim">WARM-UP</span>
          {ramp.map((w) => (
            <span
              key={w.pct}
              className="text-[10px] text-grit-dim border border-grit rounded-full px-2 py-0.5"
            >
              {w.weight}kg×{w.reps}
            </span>
          ))}
        </div>
      )}

      {logged > 0 && (
        <div className="mt-3 space-y-1.5">
          {exercise.sets.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between border border-grit rounded-xl px-3 py-2"
              style={{ borderColor: s.isPR ? "rgba(230,50,34,.5)" : undefined }}
            >
              <span className="label-cap text-[10px] text-grit-dim flex items-center gap-1.5">
                <Check size={11} className="text-accent-red" /> SET {i + 1}
              </span>
              <span className="display text-lg font-extrabold text-grit leading-none">
                {s.weight > 0 ? `${s.weight} kg × ${s.reps}` : `${s.reps} reps`}
                {s.isPR && <Flame size={14} className="inline ml-2 text-accent-red" />}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <p className="label-cap text-[9px] text-grit-dim mb-1.5">
          {logged >= planned ? `EXTRA SET ${logged + 1}` : `SET ${logged + 1} OF ${planned}`}
        </p>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <div className="relative">
            <input
              ref={weightRef}
              inputMode="decimal"
              defaultValue={initialWeight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="kg"
              className="input-grit pr-9"
              aria-label="Weight (kg)"
            />
            <button
              onClick={() => setPlatesOpen((v) => !v)}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 press ${
                platesOpen ? "text-accent-red" : "text-grit-dim"
              }`}
              aria-label="Plate calculator"
            >
              <Calculator size={16} />
            </button>
          </div>
          <input
            inputMode="numeric"
            defaultValue={initialReps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="reps"
            className="input-grit"
            aria-label="Reps"
          />
          <button
            onClick={() => {
              if (!canLog) return;
              onLog(weightNum, repsNum);
            }}
            disabled={!canLog}
            className="btn-grit px-4 disabled:opacity-40"
          >
            <Check size={16} className="mr-1" />
            Log
          </button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="mt-2 space-y-1.5 opacity-45">
          {Array.from({ length: pendingCount }, (_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border border-grit rounded-xl px-3 py-2"
            >
              <span className="label-cap text-[10px] text-grit-dim">SET {logged + 2 + i}</span>
              <span className="text-xs text-grit-dim">
                planned {plannedHint} × {exercise.targetReps}
              </span>
            </div>
          ))}
        </div>
      )}

      {platesOpen && (
        <div className="mt-3 border border-grit rounded-xl px-3 py-2.5">
          {plates ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="label-cap text-[9px] text-grit-dim">PER SIDE</span>
              {plates.perSide.length === 0 ? (
                <span className="text-[11px] text-grit-dim">bar only</span>
              ) : (
                plates.perSide.map((p, i) => (
                  <span
                    key={i}
                    className="display text-xs font-extrabold text-grit border border-accent-red/40 rounded-full px-2 py-0.5"
                  >
                    {p}
                  </span>
                ))
              )}
              <span className="label-cap text-[9px] text-grit-dim ml-auto">BAR {plates.barKg}KG</span>
              {plates.remainderKg > 0 && (
                <span className="text-[10px] text-grit-dim w-full">
                  +{plates.remainderKg}kg unloadable with standard plates
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-grit-dim">Enter a weight of 20kg+ to see the plate math.</p>
          )}
        </div>
      )}

      <p className="text-xs text-grit-dim mt-3 leading-relaxed">
        Tick off your plan set by set — PRs are detected automatically against your history.
      </p>
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
  const setsLogged = session.exercises.reduce((s, e) => s + e.sets.length, 0);
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
          <BigStat label="SETS LOGGED" value={String(setsLogged)} />
          <BigStat label="PRS" value={String(session.prCount)} accent={session.prCount > 0} />
        </div>
        {session.totalVolume > 0 && (
          <div className="bg-grit-card border border-grit p-4 mt-3">
            <p className="label-cap text-[10px] text-grit-dim">TOTAL VOLUME</p>
            <p className="display text-3xl font-extrabold mt-1 text-grit">
              {Math.round(session.totalVolume).toLocaleString()} <span className="text-sm text-grit-dim">kg</span>
            </p>
          </div>
        )}

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
