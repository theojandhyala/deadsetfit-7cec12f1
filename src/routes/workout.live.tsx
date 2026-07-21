import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { X, Check, Play, Trophy, Share2, Flame, Lock, TrendingUp, Ghost, Pencil } from "lucide-react";
import { useAppState, getState } from "@/lib/storage";
import { getExercise } from "@/lib/exercises";
import { defaultSchedule, isoDay, todayKey, plateBreakdown, warmupRamp } from "@/lib/calc";
import { topSetHistory, suggestNextWeight, ghostSets, beatsGhost, type TopSet, type Suggestion, type GhostSet } from "@/lib/progression";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { askConfirm } from "@/lib/confirm";
import { exportSessionToHealth } from "@/lib/health";
import { emitGritEarned } from "@/lib/grit-events";
import { VideoModal } from "@/components/VideoModal";
import { ShareCard } from "@/components/ShareCard";
import { GritEarnedLayer } from "@/components/GritEarnedLayer";
import { RestTimer } from "@/components/RestTimer";
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
      // Warm-up and drop sets never count toward a lift's best (and so never PR).
      e.sets.forEach((cs) => cs.kind || consider(cs.weight, cs.reps));
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

  // One-tap restart of the most recent finished session — same exercises and
  // targets, fresh (empty) sets. The fastest path back into training.
  function repeatSession(sourceId: string) {
    set((st) => {
      const last = st.sessions.find((s) => s.id === sourceId);
      if (!last) return st;
      const s: WorkoutSession = {
        id: crypto.randomUUID(),
        date: isoDay(),
        dayKey: last.dayKey,
        programId: last.programId ?? null,
        startedAt: new Date().toISOString(),
        totalVolume: 0,
        prCount: 0,
        label: last.label,
        exercises: last.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          name: e.name,
          primary_muscles: e.primary_muscles,
          targetSets: Math.max(1, e.sets.length || e.targetSets),
          targetReps: e.targetReps,
          sets: [],
        })),
      };
      return { ...st, sessions: [...st.sessions, s], activeSessionId: s.id };
    });
  }

  useEffect(() => {
    set((st) => {
      if (st.activeSessionId) return st;
      // Already trained today? Land on the day picker instead of silently
      // spinning up a duplicate session.
      const today = isoDay();
      if (st.sessions.some((s) => s.endedAt && s.date === today)) return st;
      const s = buildSession(st, todayKey());
      if (!s) return st;
      return { ...st, sessions: [...st.sessions, s], activeSessionId: s.id };
    });
  }, [set]);

  const session = state.sessions.find((s) => s.id === state.activeSessionId);

  const [activeIdx, setActiveIdx] = useState(0);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const prAwardedRef = useRef<Set<string>>(new Set());
  const [videoQuery, setVideoQuery] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [finished, setFinished] = useState(false);
  const [finishedSessionId, setFinishedSessionId] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const [resting, setResting] = useState(false);
  const restPref = state.restTimerSeconds ?? 90;

  const totals = useMemo(() => {
    if (!session) return { vol: 0, sets: 0, prs: 0 };
    let vol = 0,
      sets = 0,
      prs = 0;
    session.exercises.forEach((e) => {
      e.sets.forEach((s) => {
        if (s.kind === "warmup") return; // warm-ups aren't working volume
        vol += s.weight * s.reps;
        sets += 1;
        if (s.isPR) prs += 1;
      });
    });
    return { vol, sets, prs };
  }, [session]);

  // Planned counts never lag behind reality: an exercise's plan is at least
  // as long as what's already logged (extra sets stay visible after remounts).
  const plannedSets = useMemo(
    () =>
      session?.exercises.reduce((sum, e) => sum + Math.max(e.targetSets, e.sets.length), 0) ?? 0,
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
  const ghost = useMemo(
    () =>
      activeExercise && session
        ? ghostSets(state, activeExercise.exerciseId, session.id)
        : [],
    [state, activeExercise, session],
  );

  // Pre-logged defaults: allocated weight from the schedule → last session
  // containing the exercise → smart suggestion → bodyweight (0).
  const defaults = useMemo(() => {
    const ex = session?.exercises[activeIdx];
    if (!session || !ex) return { weight: 0, reps: 8 };
    const repsGuess = Number(String(ex.targetReps).match(/\d+/)?.[0] ?? 8);
    if (ex.plannedWeightKg != null) return { weight: ex.plannedWeightKg, reps: repsGuess };
    const hist = prefillFromHistory(state, session.id, ex.exerciseId);
    if (hist.weight) return { weight: Number(hist.weight) || 0, reps: Number(hist.reps) || repsGuess };
    return { weight: 0, reps: repsGuess };
  }, [state, session, activeIdx]);

  if (finished && finishedSessionId) {
    const finalSession = state.sessions.find((s) => s.id === finishedSessionId);
    if (finalSession) {
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
  }

  if (!session) {
    const active = state.programs.find((p) => p.id === state.activeProgramId);
    const schedule = getScheduleForState(state);
    const today = todayKey();
    const lastDone = [...state.sessions]
      .filter((s) => s.endedAt && s.exercises.some((e) => e.sets.length > 0))
      .sort((a, b) => (b.startedAt || b.date).localeCompare(a.startedAt || a.date))[0];
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
        {lastDone && (
          <button
            onClick={() => repeatSession(lastDone.id)}
            className="deadset-3d-panel deadset-lift w-full p-4 mb-5 text-left press"
            style={{ background: "linear-gradient(135deg, rgba(230,50,34,0.14), #141414)", border: "1.5px solid rgba(230,50,34,0.4)" }}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="label-cap text-accent-red text-[10px]">Fastest start</p>
                <p className="display text-lg font-extrabold uppercase text-white leading-none mt-0.5 truncate">
                  Repeat last workout
                </p>
                <p className="text-[11px] text-grit-dim mt-1 truncate">
                  {(lastDone.label || "Session").split(" — ")[0]} · {lastDone.exercises.length} exercises
                </p>
              </div>
              <Play size={22} style={{ color: "#e63222" }} className="shrink-0" />
            </div>
          </button>
        )}
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


  function logSet(weight: number, reps: number, kind?: "warmup" | "drop") {
    const ex = session!.exercises[activeIdx];
    if (!ex) return;
    // Compute the PR flag INSIDE the updater against fresh state, so a rapid
    // double-tap (which reads the same render-closure state twice) can't award
    // and count the same PR twice. Warm-up and drop sets never PR.
    let awardedPR = false;
    set((st) => {
      const { bestWeight, bestBwReps } = bestsFor(st, ex.exerciseId);
      awardedPR = kind ? false : weight > 0 ? weight > bestWeight : reps > bestBwReps;
      const newSet: CompletedSet = {
        weight,
        reps,
        ...(awardedPR ? { isPR: true } : {}),
        ...(kind ? { kind } : {}),
      };
      return {
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
      };
    });
    if (awardedPR) {
      // Undo + re-tick must not farm the award twice.
      const key = `${ex.exerciseId}:${weight}:${reps}`;
      if (!prAwardedRef.current.has(key)) {
        prAwardedRef.current.add(key);
        emitGritEarned(25, `NEW PR — ${ex.name.toUpperCase()}`, "pr");
      }
    }
    // Auto rest-timer after each working/drop set (not warm-ups) unless the
    // lifter has turned it off (restTimerSeconds === 0).
    if (restPref > 0 && kind !== "warmup") setResting(true);
  }

  function undoLastSet() {
    const ex = session!.exercises[activeIdx];
    if (!ex || ex.sets.length === 0) return;
    set((st) => ({
      ...st,
      sessions: st.sessions.map((s) =>
        s.id === session!.id
          ? {
              ...s,
              exercises: s.exercises.map((e, i) =>
                i === activeIdx ? { ...e, sets: e.sets.slice(0, -1) } : e,
              ),
            }
          : s,
      ),
    }));
  }

  // Tag the effort of the most recently logged set (optional, one tap). Feeds
  // the RPE-aware progression suggestion next session.
  function rpeLastSet(rpe: number) {
    set((st) => ({
      ...st,
      sessions: st.sessions.map((s) =>
        s.id === session!.id
          ? {
              ...s,
              exercises: s.exercises.map((e, i) => {
                if (i !== activeIdx || e.sets.length === 0) return e;
                const sets = e.sets.map((cs, j) =>
                  j === e.sets.length - 1 ? { ...cs, rpe } : cs,
                );
                return { ...e, sets };
              }),
            }
          : s,
      ),
    }));
  }

  function finishWorkout() {
    const day = isoDay();
    const endedAt = new Date().toISOString();
    set((st) => {
      const live = st.sessions.find((s) => s.id === session!.id);
      // endedAt guard: a double-tap on Finish must not duplicate log entries,
      // grit awards, or Health exports.
      if (!live || live.endedAt) return st;
      let totalVolume = 0;
      let prCount = 0;
      live.exercises.forEach((e) =>
        e.sets.forEach((cs) => {
          if (cs.kind === "warmup") return; // warm-ups aren't working volume
          totalVolume += cs.weight * cs.reps;
          if (cs.isPR) prCount += 1;
        }),
      );
      const newLogs = [...st.logs];
      live.exercises.forEach((e) => {
        let best: CompletedSet | null = null;
        e.sets.forEach((cs) => {
          if (cs.weight <= 0 || cs.kind) return; // only true working sets set the best
          if (!best || cs.weight > best.weight || (cs.weight === best.weight && cs.reps > best.reps))
            best = cs;
        });
        if (best) {
          const b: CompletedSet = best;
          // Local day (matches session.date) — a UTC timestamp here would land
          // on the next calendar day for evening lifters west of UTC and show
          // as phantom volume the day after.
          newLogs.push({ exerciseId: e.exerciseId, weight: b.weight, reps: b.reps, date: day });
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
    setFinishedSessionId(session!.id);
    setFinished(true);
    emitGritEarned(50, "WORKOUT COMPLETE", "quest");
    // Apple Health export (native iOS, user-enabled): rings + watch credit.
    if (getState().healthSync?.enabled && getState().healthSync?.exportWorkouts) {
      const finished = getState().sessions.find((s) => s.id === session!.id);
      if (finished) void exportSessionToHealth(finished);
    }
  }

  async function discardWorkout() {
    const ok = await askConfirm({
      title: "Discard this workout?",
      message: "Logged sets from this session are thrown away.",
      confirmLabel: "Discard",
      danger: true,
    });
    if (!ok) return;
    set((st) => ({
      ...st,
      sessions: st.sessions.filter((s) => s.id !== session!.id),
      activeSessionId: null,
    }));
    nav({ to: "/train" });
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
        <div className="text-right">
          <p className="label-cap text-[10px] text-grit-dim">DONE</p>
          <p className="display text-2xl font-extrabold text-grit tabular-nums leading-none">
            {totals.sets}/{plannedSets}
          </p>
        </div>
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

      <div
        className="flex-1 px-5 py-4 overflow-auto"
        onTouchStart={(e) => {
          swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const start = swipeRef.current;
          swipeRef.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) < 64 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
          setActiveIdx((i) =>
            dx < 0 ? Math.min(totalEx - 1, i + 1) : Math.max(0, i - 1),
          );
        }}
      >
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
          defaultWeight={defaults.weight}
          defaultReps={defaults.reps}
          history={evolution}
          suggestion={suggestion}
          ghost={ghost}
          isProUser={isPro}
          proLoading={proLoading}
          onLog={logSet}
          onUndo={undoLastSet}
          onRpe={rpeLastSet}
        />
      </div>


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
          onClick={async () => {
            if (totals.sets === 0) {
              const ok = await askConfirm({
                title: "No sets logged",
                message: "Finish anyway? The session counts for your streak but logs no volume.",
                confirmLabel: "Finish",
              });
              if (!ok) return;
            }
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
      {resting && restPref > 0 && (
        <RestTimer
          key={session.exercises[activeIdx]?.sets.length ?? 0}
          seconds={restPref}
          onDone={() => setResting(false)}
          onDisable={() => {
            set((s) => ({ ...s, restTimerSeconds: 0 }));
            setResting(false);
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


function SetLogger({
  exercise,
  defaultWeight,
  defaultReps,
  history,
  suggestion,
  ghost,
  isProUser,
  proLoading,
  onLog,
  onUndo,
  onRpe,
}: {
  exercise: WorkoutSessionExercise;
  defaultWeight: number;
  defaultReps: number;
  history: TopSet[];
  suggestion: Suggestion | null;
  ghost: GhostSet[];
  isProUser: boolean;
  proLoading: boolean;
  onLog: (weight: number, reps: number, kind?: "warmup" | "drop") => void;
  onUndo: () => void;
  onRpe: (rpe: number) => void;
}) {
  // Pre-logged flow: every set arrives filled from the plan. In the gym you
  // just tick the row — no typing, no timers. Tap the pencil to adjust a
  // pending set if the day deviates from the plan.
  const [override, setOverride] = useState<{ weight: number; reps: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [extraSets, setExtraSets] = useState(0);
  const editWeightRef = useRef<HTMLInputElement>(null);
  const editRepsRef = useRef<HTMLInputElement>(null);

  const logged = exercise.sets.length;
  // Working rows keep their plan even when warm-up/drop sets are interleaved:
  // reserve targetSets working rows PLUS however many special sets are logged.
  const loggedWorking = exercise.sets.filter((s) => !s.kind).length;
  const plannedWorking = Math.max(exercise.targetSets + extraSets, loggedWorking);
  const planned = plannedWorking + (logged - loggedWorking);
  const nextWeight = override?.weight ?? defaultWeight;
  const nextReps = override?.reps ?? defaultReps;
  const progressionLocked = proLoading || !isProUser;
  const bodyweight = nextWeight <= 0;
  const plates = !bodyweight && nextWeight >= 20 ? plateBreakdown(nextWeight) : null;
  // Warm-up ramp stays available until the first working set is logged, so all
  // ramp steps can be ticked off (logging one warm-up shouldn't hide the rest).
  const ramp = loggedWorking === 0 && nextWeight >= 30 ? warmupRamp(nextWeight) : [];

  function applySuggestion() {
    if (progressionLocked) {
      openPaywall("progression");
      return;
    }
    if (!suggestion) return;
    setOverride({ weight: suggestion.weightKg, reps: nextReps });
  }

  function saveEdit() {
    const w = Number((editWeightRef.current?.value ?? "").replace(/[^0-9.]/g, ""));
    const r = Math.floor(Number((editRepsRef.current?.value ?? "").replace(/[^0-9]/g, "")));
    setOverride({
      weight: Number.isFinite(w) && w >= 0 ? w : nextWeight,
      reps: Number.isFinite(r) && r > 0 ? r : nextReps,
    });
    setEditing(false);
  }

  const fmt = (w: number, r: number) => (w > 0 ? `${w} kg × ${r}` : `${r} reps`);

  return (
    <div className="mt-5 bg-grit-card border border-grit rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="label-cap text-accent-red text-[10px]">YOUR PLAN</p>
        <p className="label-cap text-[10px] text-grit-dim">
          {logged}/{planned} · {exercise.targetReps} reps
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

      {ghost.length > 0 && (
        <button
          type="button"
          onClick={() => progressionLocked && openPaywall("progression")}
          className="mt-2 w-full text-left border border-grit rounded-xl px-3 py-2 press"
        >
          <div className="flex items-center justify-between">
            <span className="label-cap text-[9px] text-grit-dim flex items-center gap-1.5">
              <Ghost size={11} className="ghost-live text-accent-red" /> GHOST — LAST SESSION
            </span>
            {progressionLocked ? (
              <Lock size={11} className="text-accent-red" />
            ) : (
              <span className="label-cap text-[8px] text-grit-dim">BEAT IT</span>
            )}
          </div>
          <div
            className={
              "mt-1.5 flex items-center gap-1.5 flex-wrap" +
              (progressionLocked ? " blur-[5px] select-none" : "")
            }
            aria-hidden={progressionLocked || undefined}
          >
            {ghost.map((g, i) => {
              const mine = exercise.sets[i];
              const beaten = mine ? beatsGhost(mine, g) : false;
              return (
                <span
                  key={i}
                  className="display text-xs font-extrabold rounded-full border px-2 py-0.5"
                  style={{
                    color: mine ? (beaten ? "#22c55e" : "#e63222") : "#8a8a8a",
                    borderColor: mine
                      ? beaten
                        ? "rgba(34,197,94,0.5)"
                        : "rgba(230,50,34,0.5)"
                      : "#262626",
                    textDecoration: beaten ? "line-through" : undefined,
                  }}
                >
                  {g.weight > 0 ? `${g.weight}×${g.reps}` : `${g.reps} reps`}
                </span>
              );
            })}
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
          <span className="label-cap text-[9px] text-grit-dim">WARM-UP · TAP TO LOG</span>
          {ramp.map((w) => (
            <button
              key={w.pct}
              type="button"
              onClick={() => onLog(w.weight, w.reps, "warmup")}
              className="text-[10px] text-grit-dim border border-grit rounded-full px-2 py-0.5 press hover:border-accent-red hover:text-grit"
            >
              {w.weight}kg×{w.reps}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {Array.from({ length: planned }, (_, i) => {
          const done = i < logged;
          const isNext = i === logged;
          const doneSet = done ? exercise.sets[i] : null;
          return (
            <button
              key={i}
              type="button"
              disabled={!done && !isNext}
              onClick={() => {
                if (done) {
                  // Only the most recent tick can be taken back.
                  if (i === logged - 1) onUndo();
                  return;
                }
                if (isNext) onLog(nextWeight, nextReps);
              }}
              className="w-full flex items-center justify-between border rounded-xl px-3 py-3 press text-left disabled:opacity-40"
              style={{
                borderColor: done
                  ? doneSet?.isPR
                    ? "rgba(230,50,34,.6)"
                    : "rgba(34,197,94,.4)"
                  : isNext
                    ? "#3a3a3a"
                    : "#262626",
                background: done ? "rgba(34,197,94,.05)" : undefined,
              }}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border"
                  style={{
                    borderColor: done ? "#22c55e" : "#3a3a3a",
                    background: done ? "#22c55e" : "transparent",
                  }}
                >
                  {done && <Check size={14} className="text-black" strokeWidth={3} />}
                </span>
                <span
                  className="label-cap text-[10px]"
                  style={{ color: doneSet?.kind === "drop" ? "#e63222" : "#8a8a8a" }}
                >
                  {doneSet?.kind === "drop"
                    ? "DROP"
                    : doneSet?.kind === "warmup"
                      ? "WARM-UP"
                      : `SET ${done ? exercise.sets.slice(0, i + 1).filter((s) => !s.kind).length : loggedWorking + (i - logged) + 1}`}
                </span>
              </span>
              <span className="display text-lg font-extrabold text-grit leading-none flex items-center">
                {done ? fmt(doneSet!.weight, doneSet!.reps) : fmt(nextWeight, nextReps)}
                {doneSet?.isPR && <Flame size={14} className="ml-2 text-accent-red" />}
                {isNext && !editing && (
                  <Pencil
                    size={13}
                    className="ml-2.5 text-grit-dim"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(true);
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* One-tap effort tag for the set you just logged — optional, and it
          teaches the progression engine how hard the weight felt. */}
      {logged > 0 && exercise.sets[logged - 1]?.rpe == null && (
        <div className="mt-2 border border-grit rounded-xl px-3 py-2.5">
          <p className="label-cap text-[9px] text-grit-dim mb-2">How hard was set {logged}?</p>
          <div className="grid grid-cols-4 gap-1.5">
            {([
              { label: "Easy", rpe: 7 },
              { label: "Solid", rpe: 8 },
              { label: "Hard", rpe: 9 },
              { label: "Max", rpe: 10 },
            ] as const).map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => onRpe(o.rpe)}
                className="rounded-lg border border-grit bg-grit-card py-2 text-[11px] font-bold text-grit press hover:border-accent-red"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {logged > 0 && exercise.sets[logged - 1]?.rpe != null && (
        <p className="mt-2 text-center label-cap text-[9px] text-grit-dim">
          Set {logged} logged at RPE {exercise.sets[logged - 1]!.rpe}
        </p>
      )}

      {editing && (
        <div className="mt-2 border border-accent-red/40 rounded-xl p-3">
          <p className="label-cap text-[9px] text-accent-red mb-2">ADJUST NEXT SET</p>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              ref={editWeightRef}
              inputMode="decimal"
              defaultValue={nextWeight > 0 ? String(nextWeight) : ""}
              placeholder="kg"
              className="input-grit"
              aria-label="Weight (kg)"
            />
            <input
              ref={editRepsRef}
              inputMode="numeric"
              defaultValue={String(nextReps)}
              placeholder="reps"
              className="input-grit"
              aria-label="Reps"
            />
            <button onClick={saveEdit} className="btn-grit px-4">
              <Check size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setExtraSets((n) => n + 1)}
          className="w-full border border-dashed border-grit rounded-xl py-2.5 label-cap text-[10px] text-grit-dim press"
        >
          + Extra set
        </button>
        <button
          type="button"
          onClick={() => {
            // Drop set: ~20% off the working weight, logged straight away and
            // marked (never a PR, but counts as volume).
            const dropW = nextWeight > 0 ? Math.max(2.5, Math.round((nextWeight * 0.8) / 2.5) * 2.5) : 0;
            onLog(dropW, nextReps, "drop");
          }}
          className="w-full border border-dashed border-accent-red/40 rounded-xl py-2.5 label-cap text-[10px] text-accent-red press"
        >
          + Drop set
        </button>
      </div>

      {plates && logged < planned && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap border border-grit rounded-xl px-3 py-2">
          <span className="label-cap text-[9px] text-grit-dim">BARBELL · PER SIDE</span>
          {plates.perSide.length === 0 ? (
            <span className="text-[11px] text-grit-dim">bar only</span>
          ) : (
            plates.perSide.map((pl, i) => (
              <span
                key={i}
                className="display text-xs font-extrabold text-grit border border-accent-red/40 rounded-full px-2 py-0.5"
              >
                {pl}
              </span>
            ))
          )}
          <span className="label-cap text-[9px] text-grit-dim ml-auto">BAR {plates.barKg}KG</span>
          {plates.remainderKg > 0 && (
            <span className="text-[10px] text-accent-red w-full">
              {plates.remainderKg}kg short of {nextWeight}kg — needs microplates
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-grit-dim mt-3 leading-relaxed">
        Tap a set to tick it off — swipe for the next exercise. PRs are detected automatically.
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
