import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  X,
  Check,
  Play,
  Trophy,
  Share2,
  Flame,
  Lock,
  TrendingUp,
  Ghost,
  Pencil,
  Link2,
  ListPlus,
  Timer,
  StickyNote,
  RefreshCw,
  Dumbbell,
} from "lucide-react";
import { useAppState, getState } from "@/lib/storage";
import { allExercises, getExercise } from "@/lib/exercises";
import { defaultSchedule, isoDay, todayKey, plateBreakdown, warmupRamp } from "@/lib/calc";
import {
  topSetHistory,
  suggestNextWeight,
  ghostSets,
  beatsGhost,
  type TopSet,
  type Suggestion,
  type GhostSet,
} from "@/lib/progression";
import { buildAutopilotPlan } from "@/lib/training-autopilot";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { askConfirm } from "@/lib/confirm";
import { exportSessionToHealth } from "@/lib/health";
import { shareWorkoutToFeed } from "@/lib/auto-share";
import { emitGritEarned } from "@/lib/grit-events";
import { isPersonalRecord } from "@/lib/workout-pr";
import { liveExerciseSwapCandidates } from "@/lib/live-exercise-swap";
import {
  buildSupersetIds,
  completedWorkingSets,
  nextStepAfterWorkingSet,
  supersetPosition,
} from "@/lib/workout-flow";
import { indexAfterMove, indexAfterRemoval, moveItem } from "@/lib/session-edit";
import { BAR_TYPES, DEFAULT_BAR_KG, barLabel, usesBarbell } from "@/lib/bars";
import {
  formatVolume,
  formatWeight,
  formatWeightValue,
  increment,
  plateLoad,
  toDisplay,
  toKg,
  trimNumber,
  unitOf,
  type WeightUnit,
} from "@/lib/units";
import {
  hapticSelection,
  hapticSetLogged,
  hapticSpecialSet,
  hapticUndo,
  hapticWorkoutComplete,
} from "@/lib/haptics";
import { endWorkoutActivity, syncWorkoutActivity } from "@/lib/workout-activity";
import {
  clearWatch,
  drainWatchActions,
  onWatchAction,
  publishToWatch,
  type WatchAction,
} from "@/lib/watch";
import {
  formatDistance,
  formatDuration,
  formatSet,
  isTimedPersonalRecord,
  parseDurationTarget,
  countsForRecords,
  isWorkingSet,
  setVolume,
  timedBestsFor,
  trackingModeFor,
  type TrackingMode,
} from "@/lib/set-tracking";
import { VideoModal } from "@/components/VideoModal";
import { ShareCard } from "@/components/ShareCard";
import { GritEarnedLayer } from "@/components/GritEarnedLayer";
import { RestTimer } from "@/components/RestTimer";
import { FormCoaching } from "@/components/FormCoaching";
import { SessionReflection } from "@/components/SessionReflection";
import { SessionExerciseSheet } from "@/components/SessionExerciseSheet";
import type {
  AppState,
  Exercise,
  ExercisePlan,
  WorkoutSession,
  WorkoutSessionExercise,
  CompletedSet,
  DayKey,
  Program,
  Schedule,
} from "@/lib/types";

type WorkoutSource = "auto" | "program" | "schedule";

/** One set as the logger hands it over, before PR and rest handling. */
type LoggedEntry = {
  weight: number;
  reps: number;
  kind?: CompletedSet["kind"];
  mode?: "duration" | "distance";
  seconds?: number;
  meters?: number;
};
type LiveWorkoutSearch = {
  day?: DayKey;
  source?: Exclude<WorkoutSource, "auto">;
};

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export const Route = createFileRoute("/workout/live")({
  validateSearch: (search: Record<string, unknown>): LiveWorkoutSearch => ({
    day: DAY_KEYS.includes(search.day as DayKey) ? (search.day as DayKey) : undefined,
    source:
      search.source === "schedule" || search.source === "program"
        ? (search.source as LiveWorkoutSearch["source"])
        : undefined,
  }),
  head: () => ({ meta: [{ title: "DEADSET — Live Workout" }] }),
  component: LiveWorkoutPage,
});

function getScheduleForState(state: ReturnType<typeof useAppState>[0]) {
  return state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
}

/**
 * How a movement in this session should be logged. Resolved once, when the
 * session is built, so a mid-session library edit can't change the units of
 * sets already recorded against it.
 */
function resolveTracking(
  state: ReturnType<typeof useAppState>[0],
  exerciseId: string,
  name: string,
  reps: string | undefined,
): { tracking: TrackingMode; targetSeconds?: number } {
  const definition = getExercise(exerciseId, state.savedExercises);
  const tracking = trackingModeFor({ name, tracking: definition?.tracking }, reps);
  const targetSeconds = tracking === "DURATION" ? (parseDurationTarget(reps) ?? 45) : undefined;
  return { tracking, ...(targetSeconds ? { targetSeconds } : {}) };
}

function buildSession(
  state: ReturnType<typeof useAppState>[0],
  dayKey: DayKey,
  source: WorkoutSource = "auto",
): WorkoutSession | null {
  const active = state.programs.find((p) => p.id === state.activeProgramId);
  const autopilot = state.trainingAutopilot?.enabled
    ? buildAutopilotPlan(state, state.trainingAutopilot.strategy)
    : null;
  const autopilotByExercise = new Map(
    (autopilot?.prescriptions ?? []).map((item) => [item.exerciseId, item]),
  );
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
        exercises: d.items.map<WorkoutSessionExercise>((it) => {
          const prescription = autopilotByExercise.get(it.id);
          return {
            exerciseId: it.id,
            name: it.name,
            primary_muscles: it.primary_muscles,
            targetSets: prescription?.reduceSets ? Math.max(2, it.sets - 1) : it.sets,
            targetReps: it.reps,
            plannedWeightKg:
              prescription && prescription.prescribedWeightKg > 0
                ? prescription.prescribedWeightKg
                : it.weightKg,
            ...resolveTracking(state, it.id, it.name, it.reps),
            sets: [],
          };
        }),
      };
    }
    if (source === "program") return null;
    // If the active programme has a rest day, fall through to the user's own
    // schedule instead of blocking training entirely.
  }
  const sched = getScheduleForState(state);
  const d = sched?.[dayKey];
  if (!d || d.exerciseIds.length === 0) return null;
  const supersetIds = buildSupersetIds(d.exerciseIds, d.exerciseConfig);
  return {
    ...base,
    label: d.label,
    programId: null,
    exercises: d.exerciseIds.map<WorkoutSessionExercise>((eid, index) => {
      const ex = getExercise(eid, state.savedExercises);
      const cfg = d.exerciseConfig?.[eid];
      const prescription = autopilotByExercise.get(eid);
      return {
        exerciseId: eid,
        name: ex?.name ?? eid,
        primary_muscles: ex?.muscleGroup ? [ex.muscleGroup] : [],
        targetSets: prescription?.reduceSets
          ? Math.max(2, (cfg?.sets ?? d.sets ?? ex?.sets ?? 3) - 1)
          : (cfg?.sets ?? d.sets ?? ex?.sets ?? 3),
        targetReps: cfg?.reps ?? d.reps ?? ex?.reps ?? "8-12",
        plannedWeightKg:
          prescription && prescription.prescribedWeightKg > 0
            ? prescription.prescribedWeightKg
            : cfg?.weightKg,
        restSeconds: cfg?.restSeconds,
        targetRir: cfg?.targetRir,
        progression: cfg?.progression,
        tempo: cfg?.tempo,
        note: cfg?.note,
        barKg: cfg?.barKg,
        supersetId: supersetIds[index],
        ...resolveTracking(state, eid, ex?.name ?? eid, cfg?.reps ?? d.reps ?? ex?.reps ?? "8-12"),
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
      // Timed efforts have no load x reps pair, and warm-ups and drops are not
      // genuine attempts at the load — neither should move a lift's best.
      e.sets.forEach((cs) => {
        if (cs.mode || !countsForRecords(cs)) return;
        consider(cs.weight, cs.reps);
      });
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
  exerciseNames,
  isToday,
  onStart,
  emptyCta,
}: {
  dayKey: DayKey;
  label: string;
  count: number;
  exerciseNames: string[];
  isToday: boolean;
  onStart: () => void;
  emptyCta?: ReactNode;
}) {
  const empty = count === 0;
  const summary = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="label-cap text-[10px] text-grit-dim">{DAY_SHORT[dayKey]}</span>
        {isToday && (
          <span className="text-[9px] px-1.5 py-0.5 bg-accent-red text-white label-cap">TODAY</span>
        )}
      </div>
      <div className="display uppercase font-extrabold text-grit text-sm truncate">{label}</div>
      <div className="text-[10px] label-cap text-grit-dim mt-0.5">
        {count} {count === 1 ? "exercise" : "exercises"}
      </div>
      {!empty && (
        <div className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-grit-dim">
          {exerciseNames.slice(0, 4).join(" · ")}
          {exerciseNames.length > 4 ? ` · +${exerciseNames.length - 4} more` : ""}
        </div>
      )}
    </div>
  );
  const className =
    "w-full bg-grit-card border p-3 flex items-center gap-3 justify-between text-left";
  const style = { borderColor: isToday ? "#e63222" : "#262626" };

  if (empty) {
    return (
      <div className={`${className} opacity-70`} style={style}>
        {summary}
        {emptyCta ?? <span className="text-[10px] label-cap text-grit-dim">REST</span>}
      </div>
    );
  }

  return (
    <button onClick={onStart} className={`${className} press`} style={style}>
      {summary}
      <Play size={18} className="shrink-0 text-accent-red" />
    </button>
  );
}

function ScheduleDayPicker({
  schedule,
  savedExercises,
  today,
  onStart,
}: {
  schedule: Schedule;
  savedExercises: AppState["savedExercises"];
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
          const exerciseNames = (d?.exerciseIds ?? []).map(
            (id) => getExercise(id, savedExercises)?.name ?? id,
          );
          return (
            <DayPickerRow
              key={k}
              dayKey={k}
              label={d?.label || "REST"}
              count={d?.exerciseIds.length || 0}
              exerciseNames={exerciseNames}
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
  savedExercises,
  today,
  onStartProgram,
  onStartSchedule,
}: {
  active: Program;
  schedule: Schedule | null;
  savedExercises: AppState["savedExercises"];
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
              exerciseNames={d.items.map((item) => item.name)}
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
          <ScheduleDayPicker
            schedule={schedule}
            savedExercises={savedExercises}
            today={today}
            onStart={onStartSchedule}
          />
        </div>
      )}
    </>
  );
}

/*
  Keep the live workout route usable even when there is no selected programme.
  The user's schedule is the source of truth for ordinary training.
*/

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
  const requested = Route.useSearch();

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
          targetSets: Math.max(1, completedWorkingSets(e.sets) || e.targetSets),
          targetReps: e.targetReps,
          plannedWeightKg: e.plannedWeightKg,
          restSeconds: e.restSeconds,
          targetRir: e.targetRir,
          progression: e.progression,
          tempo: e.tempo,
          note: e.note,
          supersetId: e.supersetId,
          sets: [],
        })),
      };
      return { ...st, sessions: [...st.sessions, s], activeSessionId: s.id };
    });
  }

  useEffect(() => {
    set((st) => {
      const activeSession = st.activeSessionId
        ? st.sessions.find((candidate) => candidate.id === st.activeSessionId)
        : undefined;
      if (activeSession) return st;

      // Repair a stale pointer left by an interrupted reset or an older synced
      // state before deciding which workout to open.
      const repairedState = st.activeSessionId ? { ...st, activeSessionId: null } : st;
      if (requested.day) {
        const requestedSession = buildSession(
          repairedState,
          requested.day,
          requested.source ?? "auto",
        );
        if (!requestedSession) return repairedState;
        return {
          ...repairedState,
          sessions: [...repairedState.sessions, requestedSession],
          activeSessionId: requestedSession.id,
        };
      }
      // Already trained today? Land on the day picker instead of silently
      // spinning up a duplicate session.
      const today = isoDay();
      if (repairedState.sessions.some((s) => s.endedAt && s.date === today)) return repairedState;
      const s = buildSession(repairedState, todayKey());
      if (!s) return repairedState;
      return {
        ...repairedState,
        sessions: [...repairedState.sessions, s],
        activeSessionId: s.id,
      };
    });
  }, [requested.day, requested.source, set]);

  const session = state.sessions.find((s) => s.id === state.activeSessionId);

  const [activeIdx, setActiveIdx] = useState(0);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const prAwardedRef = useRef<Set<string>>(new Set());
  const [videoQuery, setVideoQuery] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [showSwap, setShowSwap] = useState(false);
  const [swapQuery, setSwapQuery] = useState("");
  const [finished, setFinished] = useState(false);
  const [finishedSessionId, setFinishedSessionId] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const [rest, setRest] = useState<{ seconds: number; nextIndex: number } | null>(null);
  const [managing, setManaging] = useState(false);
  const [noting, setNoting] = useState(false);
  const [pickingBar, setPickingBar] = useState(false);
  const restPref = state.restTimerSeconds ?? 90;
  const unit = unitOf(state);

  const totals = useMemo(() => {
    if (!session) return { vol: 0, sets: 0, prs: 0 };
    let vol = 0,
      sets = 0,
      prs = 0;
    session.exercises.forEach((e) => {
      e.sets.forEach((s) => {
        if (s.kind === "warmup") return; // warm-ups aren't working volume
        vol += setVolume(s);
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
      session?.exercises.reduce(
        (sum, e) => sum + Math.max(e.targetSets, completedWorkingSets(e.sets)),
        0,
      ) ?? 0,
    [session],
  );
  const completedPlanSets = useMemo(
    () =>
      session?.exercises.reduce((sum, exercise) => sum + completedWorkingSets(exercise.sets), 0) ??
      0,
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
        ? suggestNextWeight(
            state,
            activeExercise.exerciseId,
            activeExercise.targetReps,
            activeExercise.progression ?? "DOUBLE",
          )
        : null,
    [state, activeExercise],
  );
  const ghost = useMemo(
    () =>
      activeExercise && session ? ghostSets(state, activeExercise.exerciseId, session.id) : [],
    [state, activeExercise, session],
  );
  const timedBests = useMemo(
    () =>
      activeExercise && session
        ? timedBestsFor(state.sessions, activeExercise.exerciseId, session.id)
        : { seconds: 0, meters: 0 },
    [state.sessions, activeExercise, session],
  );

  /**
   * The same workout, last time you did it. Strong shows you the last set;
   * this shows whether the whole session is ahead — the number that actually
   * says if you are progressing.
   */
  const lastTime = useMemo(() => {
    if (!session) return null;
    const previous = state.sessions
      .filter((s) => s.endedAt && s.id !== session.id && s.label === session.label)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (!previous) return null;
    const volume = previous.exercises.reduce(
      (sum, e) => sum + e.sets.reduce((inner, cs) => inner + setVolume(cs), 0),
      0,
    );
    return volume > 0 ? { volume, date: previous.date } : null;
  }, [state.sessions, session]);

  // Pre-logged defaults: allocated weight from the schedule → last session
  // containing the exercise → smart suggestion → bodyweight (0).
  const defaults = useMemo(() => {
    const ex = session?.exercises[activeIdx];
    if (!session || !ex) return { weight: 0, reps: 8 };
    const repsGuess = Number(String(ex.targetReps).match(/\d+/)?.[0] ?? 8);
    if (ex.plannedWeightKg != null) return { weight: ex.plannedWeightKg, reps: repsGuess };
    const hist = prefillFromHistory(state, session.id, ex.exerciseId);
    if (hist.weight)
      return { weight: Number(hist.weight) || 0, reps: Number(hist.reps) || repsGuess };
    return { weight: 0, reps: repsGuess };
  }, [state, session, activeIdx]);

  // `applyWatchAction` closes over this render's session, but the watch
  // subscription below is mounted once and must not be torn down and rebuilt
  // on every state change — actions arriving in the gap would be lost. A ref
  // refreshed each render gives the long-lived listener the current handler.
  const applyWatchActionRef = useRef<(action: WatchAction) => void>(() => {});
  useEffect(() => {
    applyWatchActionRef.current = applyWatchAction;
  });

  // Keep the watch showing the current session. Publishing the whole state on
  // every change is cheap and cannot desynchronise the way a missed diff can.
  useEffect(() => {
    void publishToWatch(state, session);
  }, [state, session]);

  // The Lock Screen and Dynamic Island follow the same moments. Only a live,
  // unfinished session gets an activity — finishWorkout ends it explicitly, so
  // this effect never has to guess whether a session is over.
  useEffect(() => {
    if (!session || session.endedAt) return;
    void syncWorkoutActivity(session, activeIdx);
  }, [session, activeIdx]);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    const apply = (action: WatchAction) => {
      if (!disposed) applyWatchActionRef.current(action);
    };

    // Two paths, because iOS suspends this web layer whenever the app is
    // backgrounded — which is where a phone lives while its owner trains.
    // Foreground sets arrive as events; sets logged with the phone in a
    // pocket are buffered natively and collected here on resume.
    void (async () => {
      const buffered = await drainWatchActions();
      buffered.forEach(apply);
      const remove = await onWatchAction(apply);
      if (disposed) remove();
      else unsubscribe = remove;
    })();

    const onResume = () => {
      void drainWatchActions().then((actions) => actions.forEach(apply));
    };
    document.addEventListener("resume", onResume);
    document.addEventListener("visibilitychange", onResume);

    return () => {
      disposed = true;
      unsubscribe?.();
      document.removeEventListener("resume", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  const liveSwapOptions = useMemo(() => {
    if (!session || !activeExercise) return [];
    return liveExerciseSwapCandidates(allExercises(state.savedExercises), {
      currentExerciseId: activeExercise.exerciseId,
      targetMuscles: activeExercise.primary_muscles,
      availableEquipment: state.profile?.equipment,
      reservedExerciseIds: session.exercises
        .filter((_, index) => index !== activeIdx)
        .map((exercise) => exercise.exerciseId),
      query: swapQuery,
    });
  }, [
    activeExercise,
    activeIdx,
    session,
    state.profile?.equipment,
    state.savedExercises,
    swapQuery,
  ]);

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
            style={{
              background: "linear-gradient(135deg, rgba(230,50,34,0.14), #141414)",
              border: "1.5px solid rgba(230,50,34,0.4)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="label-cap text-accent-red text-[10px]">Fastest start</p>
                <p className="display text-lg font-extrabold uppercase text-white leading-none mt-0.5 truncate">
                  Repeat last workout
                </p>
                <p className="text-[11px] text-grit-dim mt-1 truncate">
                  {(lastDone.label || "Session").split(" — ")[0]} · {lastDone.exercises.length}{" "}
                  exercises
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
            savedExercises={state.savedExercises}
            today={today}
            onStartProgram={(k) => startDay(k, "program")}
            onStartSchedule={(k) => startDay(k, "schedule")}
          />
        ) : schedule ? (
          <ScheduleDayPicker
            schedule={schedule}
            savedExercises={state.savedExercises}
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
  const currentSuperset = supersetPosition(session.exercises, activeIdx);
  const progressionLabel =
    current.progression === "DOUBLE"
      ? "Double progression"
      : current.progression === "LINEAR"
        ? "Linear load"
        : current.progression === "HOLD"
          ? "Manual progression"
          : null;
  const totalEx = session.exercises.length;
  const progress = Math.min(100, Math.round((completedPlanSets / Math.max(1, plannedSets)) * 100));

  function logSet(entry: LoggedEntry) {
    logSetAt(activeIdx, entry);
  }

  /**
   * Record a set against one movement. Takes an index rather than reading the
   * active one so a set logged on the Apple Watch runs through identical PR
   * detection, grit and rest handling — two code paths for "log a set" is how
   * a watch companion ends up awarding records the phone does not.
   */
  function logSetAt(index: number, entry: LoggedEntry) {
    const { weight, reps, kind, mode, seconds, meters } = entry;
    const ex = session!.exercises[index];
    if (!ex) return;
    // Compute the PR flag INSIDE the updater against fresh state, so a rapid
    // double-tap (which reads the same render-closure state twice) can't award
    // and count the same PR twice. Warm-up and drop sets never PR.
    let awardedPR = false;
    // Captured for the share card: the record this set beat, read from the same
    // fresh state that decided the PR, before the new set is written into it.
    let prPreviousBest = 0;
    let prIsBodyweight = false;
    // Timed and distance efforts get their own record line, and no share card:
    // the PR card is built around a load and a rep count.
    let timedPRLabel: string | null = null;
    set((st) => {
      const definition = getExercise(ex.exerciseId, st.savedExercises);
      if (mode) {
        const bests = timedBestsFor(st.sessions, ex.exerciseId, session!.id);
        awardedPR = isTimedPersonalRecord({ mode, seconds, meters, kind }, bests);
        if (awardedPR) {
          timedPRLabel =
            mode === "duration" ? formatDuration(seconds ?? 0) : `${Math.round(meters ?? 0)}m`;
        }
      } else {
        const { bestWeight, bestBwReps } = bestsFor(st, ex.exerciseId);
        const supportsBodyweight = definition?.equipment.includes("BODYWEIGHT") ?? false;
        awardedPR = isPersonalRecord({
          weight,
          reps,
          bestWeight,
          bestBodyweightReps: bestBwReps,
          supportsBodyweight,
          // A set to failure is still a genuine attempt at the load, so it can
          // set a record; warm-ups and drops cannot.
          specialSet: !countsForRecords({ kind }),
        });
        if (awardedPR) {
          prIsBodyweight = weight <= 0;
          prPreviousBest = prIsBodyweight ? bestBwReps : bestWeight;
        }
      }
      const newSet: CompletedSet = {
        weight,
        reps,
        ...(awardedPR ? { isPR: true } : {}),
        ...(kind ? { kind } : {}),
        ...(mode ? { mode } : {}),
        ...(seconds ? { seconds } : {}),
        ...(meters ? { meters } : {}),
      };
      return {
        ...st,
        sessions: st.sessions.map((s) =>
          s.id === session!.id
            ? {
                ...s,
                exercises: s.exercises.map((e, i) =>
                  i === index ? { ...e, sets: [...e.sets, newSet] } : e,
                ),
              }
            : s,
        ),
      };
    });
    if (kind) hapticSpecialSet();
    else if (!awardedPR) hapticSetLogged();

    if (awardedPR) {
      // Undo + re-tick must not farm the award twice.
      const key = `${ex.exerciseId}:${weight}:${reps}:${seconds ?? 0}:${meters ?? 0}`;
      if (!prAwardedRef.current.has(key)) {
        prAwardedRef.current.add(key);
        if (timedPRLabel) {
          emitGritEarned(25, `NEW PR — ${ex.name.toUpperCase()} ${timedPRLabel}`, "pr");
        } else {
          emitGritEarned(25, `NEW PR — ${ex.name.toUpperCase()}`, "pr", {
            pr: {
              exercise: ex.name,
              weight,
              reps,
              ...(prPreviousBest > 0 ? { previousBest: prPreviousBest } : {}),
              ...(prIsBodyweight ? { bodyweight: true } : {}),
            },
          });
        }
      }
    }
    // Superset movements rotate immediately and rest only after a full round.
    // Warm-ups stay on the current movement; drops keep the normal rest flow.
    if (kind === "warmup") return;
    const exerciseRest = ex.restSeconds ?? restPref;
    const step =
      kind === "drop"
        ? { nextIndex: index, shouldRest: true }
        : nextStepAfterWorkingSet(session!.exercises, index);
    if (!step.shouldRest || exerciseRest <= 0) {
      setActiveIdx(step.nextIndex);
      return;
    }
    setRest({ seconds: exerciseRest, nextIndex: step.nextIndex });
  }

  /**
   * Apply something the athlete did on their Apple Watch.
   *
   * Everything routes through the same functions the phone's own buttons use,
   * so a watch-logged set earns the same PR, the same grit and the same rest.
   */
  function applyWatchAction(action: WatchAction) {
    const live = getState().sessions.find((s) => s.id === action.sessionId);
    // The session it targets is over, or a different one has started since.
    // Applying it anyway would write sets into the wrong workout.
    if (!live || live.endedAt || live.id !== session?.id) return;
    const index = live.exercises.findIndex((e) => e.exerciseId === action.exerciseId);

    if (action.kind === "finish") {
      finishWorkout();
      return;
    }
    if (index < 0) return;

    if (action.kind === "undoSet") {
      mutateExercise(index, (e) => ({ ...e, sets: e.sets.slice(0, -1) }));
      return;
    }
    logSetAt(index, {
      weight: action.weight,
      reps: action.reps,
      ...(action.mode ? { mode: action.mode } : {}),
      ...(action.seconds ? { seconds: action.seconds } : {}),
      ...(action.meters ? { meters: action.meters } : {}),
    });
  }

  /** Rewrite this session in place, leaving every other session untouched. */
  function mutateSession(fn: (s: WorkoutSession) => WorkoutSession) {
    set((st) => ({
      ...st,
      sessions: st.sessions.map((s) => (s.id === session!.id ? fn(s) : s)),
    }));
  }

  /** Rewrite one exercise of this session in place. */
  function mutateExercise(
    index: number,
    fn: (e: WorkoutSessionExercise) => WorkoutSessionExercise,
  ) {
    mutateSession((s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => (i === index ? fn(e) : e)),
    }));
  }

  function undoLastSet() {
    const ex = session!.exercises[activeIdx];
    if (!ex || ex.sets.length === 0) return;
    hapticUndo();
    mutateExercise(activeIdx, (e) => ({ ...e, sets: e.sets.slice(0, -1) }));
  }

  /**
   * Correct a set that was already ticked. Every logged set stays editable for
   * the length of the session — a mis-tapped weight three sets ago shouldn't
   * mean unwinding everything after it.
   */
  function editSet(setIndex: number, patch: LoggedEntry) {
    mutateExercise(activeIdx, (e) => ({
      ...e,
      sets: e.sets.map((cs, i) =>
        i === setIndex
          ? {
              ...cs,
              weight: patch.weight,
              reps: patch.reps,
              ...(patch.seconds ? { seconds: patch.seconds } : { seconds: undefined }),
              ...(patch.meters ? { meters: patch.meters } : { meters: undefined }),
            }
          : cs,
      ),
    }));
  }

  function deleteSet(setIndex: number) {
    hapticUndo();
    mutateExercise(activeIdx, (e) => ({
      ...e,
      sets: e.sets.filter((_, i) => i !== setIndex),
    }));
  }

  /** Per-exercise rest, changed on the gym floor and kept for next time. */
  function setExerciseRest(seconds: number) {
    const ex = session!.exercises[activeIdx];
    if (!ex) return;
    mutateExercise(activeIdx, (e) => ({ ...e, restSeconds: seconds }));
    persistToPlan(ex.exerciseId, { restSeconds: seconds });
  }

  /** Which bar this movement is loaded on — drives plate and warm-up maths. */
  function setExerciseBar(barKg: number) {
    const ex = session!.exercises[activeIdx];
    if (!ex) return;
    mutateExercise(activeIdx, (e) => ({ ...e, barKg }));
    persistToPlan(ex.exerciseId, { barKg });
    hapticSelection();
  }

  /** A cue written mid-session, kept on the plan so it shows up next time. */
  function setExerciseNote(note: string) {
    const ex = session!.exercises[activeIdx];
    if (!ex) return;
    const trimmed = note.trim();
    mutateExercise(activeIdx, (e) => ({ ...e, note: trimmed || undefined }));
    persistToPlan(ex.exerciseId, { note: trimmed || undefined });
  }

  /**
   * Write one field back onto the day's plan, so an adjustment made during a
   * workout survives into the next one. Only touches the scheduled day — a
   * session started from a programme leaves the programme alone.
   */
  function persistToPlan(exerciseId: string, patch: Partial<ExercisePlan>) {
    set((st) => {
      const schedule = st.schedule ?? (st.profile ? defaultSchedule(st.profile) : null);
      const day = schedule?.[session!.dayKey];
      if (!schedule || !day || !day.exerciseIds.includes(exerciseId)) return st;
      const config = { ...(day.exerciseConfig ?? {}) };
      const next = { ...(config[exerciseId] ?? {}), ...patch };
      // Clearing a note shouldn't leave an empty key behind.
      for (const key of Object.keys(next) as Array<keyof ExercisePlan>) {
        if (next[key] === undefined) delete next[key];
      }
      config[exerciseId] = next;
      return {
        ...st,
        schedule: { ...schedule, [session!.dayKey]: { ...day, exerciseConfig: config } },
      };
    });
  }

  /** Add a movement that wasn't planned — the rack was taken, or you felt good. */
  function addExerciseLive(exercise: Exercise) {
    const alreadyThere = session!.exercises.findIndex((e) => e.exerciseId === exercise.id);
    if (alreadyThere >= 0) {
      setActiveIdx(alreadyThere);
      return;
    }
    const entry: WorkoutSessionExercise = {
      exerciseId: exercise.id,
      name: exercise.name,
      primary_muscles: [exercise.muscleGroup],
      targetSets: exercise.sets,
      targetReps: exercise.reps,
      addedLive: true,
      ...resolveTracking(state, exercise.id, exercise.name, exercise.reps),
      sets: [],
    };
    mutateSession((s) => ({ ...s, exercises: [...s.exercises, entry] }));
    setActiveIdx(session!.exercises.length);
  }

  /**
   * Swap the movement in this slot for another. Logged sets belong to the old
   * movement, so a swap after work is done is refused rather than silently
   * reattributing them — remove and add instead.
   */
  async function replaceExerciseLive(exercise: Exercise) {
    const current = session!.exercises[activeIdx];
    if (!current) return;
    if (current.sets.length > 0) {
      const ok = await askConfirm({
        title: `Drop ${current.sets.length} logged ${current.sets.length === 1 ? "set" : "sets"}?`,
        message: `Those sets were logged against ${current.name}. Swapping to ${exercise.name} throws them away.`,
        confirmLabel: "Swap anyway",
        danger: true,
      });
      if (!ok) return;
    }
    mutateExercise(activeIdx, () => ({
      exerciseId: exercise.id,
      name: exercise.name,
      primary_muscles: [exercise.muscleGroup],
      targetSets: current.targetSets,
      targetReps: exercise.reps,
      addedLive: true,
      ...resolveTracking(state, exercise.id, exercise.name, exercise.reps),
      sets: [],
    }));
  }

  async function removeExerciseLive(index: number) {
    const target = session!.exercises[index];
    if (!target) return;
    if (session!.exercises.length <= 1) return;
    if (target.sets.length > 0) {
      const ok = await askConfirm({
        title: `Remove ${target.name}?`,
        message: `${target.sets.length} logged ${target.sets.length === 1 ? "set" : "sets"} on this movement will be thrown away.`,
        confirmLabel: "Remove",
        danger: true,
      });
      if (!ok) return;
    }
    const lengthBefore = session!.exercises.length;
    mutateSession((s) => ({ ...s, exercises: s.exercises.filter((_, i) => i !== index) }));
    setActiveIdx((i) => indexAfterRemoval(i, index, lengthBefore));
  }

  /** Reorder the session when the gym floor doesn't match the plan. */
  function moveExerciseLive(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= session!.exercises.length) return;
    mutateSession((s) => ({ ...s, exercises: moveItem(s.exercises, index, direction) }));
    setActiveIdx((i) => indexAfterMove(i, index, direction));
  }

  /**
   * Apply a smart swap to this session slot without carrying an unsafe load
   * or stale tracking mode onto a different movement. The slot's programming
   * (sets, reps, rest, RIR, tempo and superset) remains intact.
   */
  function chooseLiveSwap(replacement: Exercise) {
    if (!session || current.sets.length > 0) return;
    mutateExercise(activeIdx, (target) => {
      // Re-check inside the state update so a late set cannot be reattributed
      // to the replacement if it lands at the same time as this tap.
      if (target.sets.length > 0) return target;
      const tracking = resolveTracking(state, replacement.id, replacement.name, target.targetReps);
      return {
        ...target,
        exerciseId: replacement.id,
        name: replacement.name,
        primary_muscles: [replacement.muscleGroup],
        // A load on a different movement is not a safe default.
        plannedWeightKg: undefined,
        addedLive: true,
        // Explicitly clear a previous duration target before resolving the
        // replacement's tracking mode.
        targetSeconds: undefined,
        ...tracking,
        sets: [],
      };
    });
    hapticSelection();
    setShowSwap(false);
    setSwapQuery("");
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
                const sets = e.sets.map((cs, j) => (j === e.sets.length - 1 ? { ...cs, rpe } : cs));
                return { ...e, sets };
              }),
            }
          : s,
      ),
    }));
  }

  function finishWorkout() {
    // Guard the whole action, not just the reducer: set() is synchronous, so
    // after the first tap getState() already reflects endedAt. Without this,
    // a fast double-tap fires grit, the feed post and the Health export twice.
    if (getState().sessions.find((s) => s.id === session!.id)?.endedAt) return;
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
          totalVolume += setVolume(cs);
          if (cs.isPR) prCount += 1;
        }),
      );
      const newLogs = [...st.logs];
      live.exercises.forEach((e) => {
        let best: CompletedSet | null = null;
        e.sets.forEach((cs) => {
          // Only true load x reps attempts set the best: a timed hold has no
          // weight-and-reps pair to write into the lift log.
          if (cs.weight <= 0 || cs.mode || !countsForRecords(cs)) return;
          if (
            !best ||
            cs.weight > best.weight ||
            (cs.weight === best.weight && cs.reps > best.reps)
          )
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
    // Send the watch back to idle now rather than waiting for the next render
    // to publish it: the app is often backgrounded the moment a workout ends,
    // and a wrist still showing a live session is worse than a blank one.
    void clearWatch();
    void endWorkoutActivity();
    hapticWorkoutComplete();
    emitGritEarned(50, "WORKOUT COMPLETE", "quest");
    // Apple Health export (native iOS, user-enabled): rings + watch credit.
    if (getState().healthSync?.enabled && getState().healthSync?.exportWorkouts) {
      const finished = getState().sessions.find((s) => s.id === session!.id);
      if (finished) void exportSessionToHealth(finished);
    }
    // Posting is explicit opt-in; a finished workout is private by default.
    if (getState().autoShareWorkouts === true) {
      const finished = getState().sessions.find((s) => s.id === session!.id);
      if (finished) void shareWorkoutToFeed(finished);
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
    void clearWatch();
    void endWorkoutActivity();
    nav({ to: "/train" });
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0a0a0a", paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={discardWorkout}
          className="icon-btn text-grit-dim"
          aria-label="Exit workout"
        >
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

      {lastTime && (
        <div className="border-b border-grit px-4 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="label-cap text-[9px] text-grit-dim">
              VS LAST {session.label.toUpperCase()}
            </span>
            <span
              className="display text-xs font-extrabold tabular-nums"
              style={{ color: totals.vol >= lastTime.volume ? "#22c55e" : "#8a8a8a" }}
            >
              {totals.vol >= lastTime.volume
                ? `AHEAD BY ${formatVolume(totals.vol - lastTime.volume, unit).toUpperCase()}`
                : `${formatVolume(lastTime.volume - totals.vol, unit).toUpperCase()} TO GO`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.round((totals.vol / lastTime.volume) * 100))}%`,
                background: totals.vol >= lastTime.volume ? "#22c55e" : "#e63222",
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 border-b border-grit">
        <button
          onClick={() => setManaging(true)}
          className="flex-shrink-0 flex h-8 w-8 items-center justify-center border border-grit text-grit-dim press"
          aria-label="Edit session exercises"
        >
          <ListPlus size={15} />
        </button>
        {session.exercises.map((e, i) => {
          const done = e.targetSets > 0 && completedWorkingSets(e.sets) >= e.targetSets;
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
          setActiveIdx((i) => (dx < 0 ? Math.min(totalEx - 1, i + 1) : Math.max(0, i - 1)));
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
            {currentSuperset && (
              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase text-accent-red">
                <Link2 size={13} />
                Superset · movement {currentSuperset.position} of {currentSuperset.total}
              </p>
            )}
            {(current.targetRir != null || current.tempo || progressionLabel) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {progressionLabel && (
                  <span className="rounded-md border border-amber-300/25 bg-amber-300/[0.06] px-2 py-1 text-[9px] font-black uppercase text-amber-300">
                    {progressionLabel}
                  </span>
                )}
                {current.targetRir != null && (
                  <span className="rounded-md border border-grit px-2 py-1 text-[9px] font-black uppercase text-grit-dim">
                    {current.targetRir} RIR
                  </span>
                )}
                {current.tempo && (
                  <span className="rounded-md border border-grit px-2 py-1 text-[9px] font-black uppercase text-grit-dim">
                    {current.tempo} tempo
                  </span>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  // Cycle the common gym intervals; kept on the plan for next time.
                  const options = [0, 60, 90, 120, 180];
                  const now = current.restSeconds ?? restPref;
                  const next = options[(options.indexOf(now) + 1) % options.length]!;
                  setExerciseRest(next);
                }}
                className="flex items-center gap-1 rounded-md border border-grit px-2 py-1 text-[9px] font-black uppercase text-grit-dim press"
                aria-label="Change rest for this exercise"
              >
                <Timer size={11} />
                {(current.restSeconds ?? restPref) === 0
                  ? "no rest"
                  : `${current.restSeconds ?? restPref}s rest`}
              </button>
              {usesBarbell(current.name) && (
                <button
                  onClick={() => setPickingBar(true)}
                  className="flex items-center gap-1 rounded-md border border-grit px-2 py-1 text-[9px] font-black uppercase text-grit-dim press"
                  aria-label="Change the bar for this exercise"
                >
                  <Dumbbell size={11} />
                  {barLabel(current.barKg)}
                </button>
              )}
              <button
                onClick={() => setNoting(true)}
                className="flex items-center gap-1 rounded-md border border-grit px-2 py-1 text-[9px] font-black uppercase text-grit-dim press"
                aria-label="Note for this exercise"
              >
                <StickyNote size={11} />
                {current.note ? "edit note" : "note"}
              </button>
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <Link
              to="/lift/$exerciseId"
              params={{ exerciseId: current.exerciseId }}
              className="flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-grit px-1 text-grit-dim"
              aria-label="Lift history"
              title="Lift history"
            >
              <Trophy size={15} />
              <span className="text-[7px] font-black uppercase">History</span>
            </Link>
            <button
              type="button"
              disabled={current.sets.length > 0}
              onClick={() => {
                if (!isPro || proLoading) {
                  openPaywall("smart-swaps");
                  return;
                }
                setSwapQuery("");
                setShowSwap(true);
              }}
              className="flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-grit px-1 text-grit-dim disabled:opacity-35"
              aria-label={
                current.sets.length > 0
                  ? "Exercise swaps are available before logging a set"
                  : "Swap this exercise"
              }
              title={current.sets.length > 0 ? "Swap before logging a set" : "Swap exercise"}
            >
              <RefreshCw size={15} />
              <span className="text-[7px] font-black uppercase">Swap</span>
            </button>
            <button
              onClick={() => {
                setVideoQuery(current.name + " form");
                setVideoTitle(current.name);
              }}
              className="flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-accent-red px-1"
              aria-label={`${current.name} form guide`}
              title="Form guide"
            >
              <Play size={15} className="text-accent-red" />
              <span className="text-[7px] font-black uppercase text-accent-red">Form</span>
            </button>
          </div>
        </div>

        {current.note && (
          <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2.5">
            <p className="label-cap text-[9px] text-amber-300">Workout cue</p>
            <p className="mt-1 text-xs leading-relaxed text-grit">{current.note}</p>
          </div>
        )}

        {/* Form cues, collapsed: reachable between sets without leaving the workout. */}
        <div className="mb-3">
          <FormCoaching exerciseId={current.exerciseId} name={current.name} compact />
        </div>

        {current.tracking && current.tracking !== "WEIGHT" ? (
          <TimedSetLogger
            key={`${session.id}:${activeIdx}`}
            exercise={current}
            bests={timedBests}
            unit={unit}
            onLog={logSet}
            onEditSet={editSet}
            onDeleteSet={deleteSet}
          />
        ) : (
          <SetLogger
            key={`${session.id}:${activeIdx}`}
            exercise={current}
            defaultWeight={defaults.weight}
            defaultReps={defaults.reps}
            requiresWeight={
              !(
                getExercise(current.exerciseId, state.savedExercises)?.equipment.includes(
                  "BODYWEIGHT",
                ) ?? false
              )
            }
            barKg={current.barKg ?? DEFAULT_BAR_KG}
            unit={unit}
            history={evolution}
            suggestion={suggestion}
            ghost={ghost}
            isProUser={isPro}
            proLoading={proLoading}
            onLog={logSet}
            onUndo={undoLastSet}
            onRpe={rpeLastSet}
            onEditSet={editSet}
            onDeleteSet={deleteSet}
          />
        )}
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
      {managing && (
        <SessionExerciseSheet
          exercises={session.exercises}
          activeIndex={activeIdx}
          saved={state.savedExercises}
          onAdd={addExerciseLive}
          onReplace={(exercise) => void replaceExerciseLive(exercise)}
          onRemove={(index) => void removeExerciseLive(index)}
          onMove={moveExerciseLive}
          onSelect={setActiveIdx}
          onClose={() => setManaging(false)}
        />
      )}
      {pickingBar && (
        <BarPickerSheet
          name={current.name}
          barKg={current.barKg ?? DEFAULT_BAR_KG}
          unit={unit}
          onPick={(kg) => {
            setExerciseBar(kg);
            setPickingBar(false);
          }}
          onClose={() => setPickingBar(false)}
        />
      )}
      {noting && (
        <NoteSheet
          name={current.name}
          note={current.note ?? ""}
          onSave={(note) => {
            setExerciseNote(note);
            setNoting(false);
          }}
          onClose={() => setNoting(false)}
        />
      )}
      {showSwap && (
        <LiveExerciseSwap
          currentName={current.name}
          candidates={liveSwapOptions}
          query={swapQuery}
          onQueryChange={setSwapQuery}
          onChoose={chooseLiveSwap}
          onClose={() => {
            setShowSwap(false);
            setSwapQuery("");
          }}
        />
      )}
      {rest && rest.seconds > 0 && (
        <RestTimer
          key={session.exercises[activeIdx]?.sets.length ?? 0}
          seconds={rest.seconds}
          nextExercise={session.exercises[rest.nextIndex]?.name}
          onDone={() => {
            setActiveIdx(rest.nextIndex);
            setRest(null);
          }}
          onDisable={() => {
            set((s) => ({ ...s, restTimerSeconds: 0 }));
            setActiveIdx(rest.nextIndex);
            setRest(null);
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

function LiveExerciseSwap({
  currentName,
  candidates,
  query,
  onQueryChange,
  onChoose,
  onClose,
}: {
  currentName: string;
  candidates: Exercise[];
  query: string;
  onQueryChange: (value: string) => void;
  onChoose: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-black/75 p-3 sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-swap-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-[#111214] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
          <div className="min-w-0">
            <p className="label-cap text-[9px] text-pro">PRO SMART SWAP</p>
            <h2
              id="live-swap-title"
              className="display mt-1 text-2xl font-black uppercase text-grit"
            >
              Keep the session moving
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-grit-dim">
              Replace {currentName} before you log a set. Your workout targets stay in place.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn shrink-0 text-grit-dim"
            aria-label="Close exercise swaps"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search alternatives"
            className="input-grit w-full"
            aria-label="Search exercise alternatives"
          />
          <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {candidates.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => onChoose(exercise)}
                className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-left press hover:border-accent-red/60"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-red/10 text-accent-red">
                  <Dumbbell size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-grit">
                    {exercise.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase text-grit-dim">
                    {exercise.muscleGroup} ·{" "}
                    {exercise.equipmentLabel ?? exercise.equipment[0].replace("_", " ")}
                  </span>
                </span>
                <RefreshCw size={15} className="shrink-0 text-accent-red" />
              </button>
            ))}
            {candidates.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-8 text-center">
                <p className="text-sm font-bold text-grit">No matching swap found</p>
                <p className="mt-1 text-xs leading-relaxed text-grit-dim">
                  Try a broader search or keep the planned movement for today.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetLogger({
  exercise,
  defaultWeight,
  defaultReps,
  requiresWeight,
  barKg,
  unit,
  history,
  suggestion,
  ghost,
  isProUser,
  proLoading,
  onLog,
  onUndo,
  onRpe,
  onEditSet,
  onDeleteSet,
}: {
  exercise: WorkoutSessionExercise;
  defaultWeight: number;
  defaultReps: number;
  requiresWeight: boolean;
  /** Bar this movement is loaded on, so plates and warm-ups match reality. */
  barKg: number;
  /** kg or lb — display only; every stored weight stays in kilograms. */
  unit: WeightUnit;
  history: TopSet[];
  suggestion: Suggestion | null;
  ghost: GhostSet[];
  isProUser: boolean;
  proLoading: boolean;
  onLog: (entry: LoggedEntry) => void;
  onUndo: () => void;
  onRpe: (rpe: number) => void;
  onEditSet: (setIndex: number, patch: LoggedEntry) => void;
  onDeleteSet: (setIndex: number) => void;
}) {
  // Pre-logged flow: every set arrives filled from the plan. In the gym you
  // just tick the row — no typing, no timers. Tap the pencil to adjust a
  // pending set if the day deviates from the plan.
  const [override, setOverride] = useState<{ weight: number; reps: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingSet, setEditingSet] = useState<number | null>(null);
  const [weightError, setWeightError] = useState(false);
  const [extraSets, setExtraSets] = useState(0);
  const editWeightRef = useRef<HTMLInputElement>(null);
  const editRepsRef = useRef<HTMLInputElement>(null);

  const logged = exercise.sets.length;
  // Working rows keep their plan even when warm-up/drop sets are interleaved:
  // reserve targetSets working rows PLUS however many special sets are logged.
  const loggedWorking = exercise.sets.filter(isWorkingSet).length;
  const plannedWorking = Math.max(exercise.targetSets + extraSets, loggedWorking);
  const planned = plannedWorking + (logged - loggedWorking);
  const nextWeight = override?.weight ?? defaultWeight;
  const nextReps = override?.reps ?? defaultReps;
  const progressionLocked = proLoading || !isProUser;
  const bodyweight = nextWeight <= 0;
  // Loaded from the movement's own bar: a trap bar is 5 kg heavier than the
  // Olympic default, which is enough to hand out the wrong plates.
  const plates = !bodyweight && barKg > 0 ? plateLoad(nextWeight, barKg, unit) : null;
  // Warm-up ramp stays available until the first working set is logged, so all
  // ramp steps can be ticked off (logging one warm-up shouldn't hide the rest).
  const ramp = loggedWorking === 0 && nextWeight >= barKg + 10 ? warmupRamp(nextWeight, barKg) : [];

  function applySuggestion() {
    if (progressionLocked) {
      openPaywall("progression");
      return;
    }
    if (!suggestion) return;
    setOverride({ weight: suggestion.weightKg, reps: nextReps });
  }

  function saveEdit() {
    // Typed in the athlete's units; every stored weight stays in kilograms.
    const typed = Number((editWeightRef.current?.value ?? "").replace(/[^0-9.]/g, ""));
    const w = Number.isFinite(typed) ? toKg(typed, unit) : Number.NaN;
    const r = Math.floor(Number((editRepsRef.current?.value ?? "").replace(/[^0-9]/g, "")));
    if (requiresWeight && (!Number.isFinite(w) || w <= 0)) {
      setWeightError(true);
      editWeightRef.current?.focus();
      return;
    }
    setOverride({
      weight: Number.isFinite(w) && w >= 0 ? w : nextWeight,
      reps: Number.isFinite(r) && r > 0 ? r : nextReps,
    });
    setWeightError(false);
    setEditing(false);
  }

  function openWeightEditor() {
    setWeightError(false);
    setEditing(true);
    requestAnimationFrame(() => editWeightRef.current?.focus());
  }

  const fmt = (w: number, r: number) => formatSet({ weight: w, reps: r }, requiresWeight);

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
                  {formatWeightValue(h.weight, unit)}
                </span>
                {i < history.length - 1 && <span className="text-grit-dim text-[10px]">→</span>}
              </span>
            ))}
            <span className="label-cap text-[8px] text-grit-dim ml-1">
              {unit.toUpperCase()} TOP SET
            </span>
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
                  {g.weight > 0
                    ? `${formatWeightValue(g.weight, unit)}×${g.reps}`
                    : `${g.reps} reps`}
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
              {progressionLocked
                ? "SMART SUGGESTION"
                : suggestion.kind === "up"
                  ? "MOVE UP"
                  : "HOLD & EARN IT"}
            </span>
            <span
              className={
                "text-xs text-grit font-bold" + (progressionLocked ? " blur-[5px] select-none" : "")
              }
            >
              {formatWeight(suggestion.weightKg, unit)} — {suggestion.reason}
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
              onClick={() => onLog({ weight: w.weight, reps: w.reps, kind: "warmup" })}
              className="text-[10px] text-grit-dim border border-grit rounded-full px-2 py-0.5 press hover:border-accent-red hover:text-grit"
            >
              {formatWeightValue(w.weight, unit)}
              {unit}×{w.reps}
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
                  // Every logged set stays correctable, not just the last tick.
                  setEditingSet(i);
                  return;
                }
                if (isNext) {
                  if (requiresWeight && nextWeight <= 0) {
                    openWeightEditor();
                    return;
                  }
                  onLog({ weight: nextWeight, reps: nextReps });
                }
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
                  style={{
                    color:
                      doneSet?.kind === "drop" || doneSet?.kind === "failure"
                        ? "#e63222"
                        : "#8a8a8a",
                  }}
                >
                  {doneSet?.kind === "drop"
                    ? "DROP"
                    : doneSet?.kind === "warmup"
                      ? "WARM-UP"
                      : // Failure is a marker on a working set, so it keeps its
                        // number — it is the set you planned, taken to the end.
                        `SET ${done ? exercise.sets.slice(0, i + 1).filter(isWorkingSet).length : loggedWorking + (i - logged) + 1}${doneSet?.kind === "failure" ? " · TO FAILURE" : ""}`}
                </span>
              </span>
              <span className="display text-lg font-extrabold text-grit leading-none flex items-center">
                {done ? formatSet(doneSet!, requiresWeight, unit) : fmt(nextWeight, nextReps)}
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
            {(
              [
                { label: "Easy", rpe: 7 },
                { label: "Solid", rpe: 8 },
                { label: "Hard", rpe: 9 },
                { label: "Max", rpe: 10 },
              ] as const
            ).map((o) => (
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
              defaultValue={nextWeight > 0 ? formatWeightValue(nextWeight, unit) : ""}
              placeholder={unit}
              className={`input-grit ${weightError ? "border-accent-red" : ""}`}
              aria-label={`Weight (${unit})`}
            />
            <input
              ref={editRepsRef}
              inputMode="numeric"
              defaultValue={String(nextReps)}
              placeholder="reps"
              className="input-grit"
              aria-label="Reps"
            />
            <button
              type="button"
              onClick={saveEdit}
              aria-label="Save set weight and reps"
              className="btn-grit px-4"
            >
              <Check size={16} />
            </button>
          </div>
          {weightError && (
            <p className="mt-2 text-xs font-semibold text-accent-red">
              Enter the working weight before logging this set.
            </p>
          )}
        </div>
      )}

      <div className="mt-2 grid grid-cols-3 gap-2">
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
            if (requiresWeight && nextWeight <= 0) {
              openWeightEditor();
              return;
            }
            // Same load and reps as the working set, marked. It still counts
            // toward the plan and can still set a record — you did the work.
            onLog({ weight: nextWeight, reps: nextReps, kind: "failure" });
          }}
          className="w-full border border-dashed border-accent-red/40 rounded-xl py-2.5 label-cap text-[10px] text-accent-red press"
        >
          + To failure
        </button>
        <button
          type="button"
          onClick={() => {
            if (requiresWeight && nextWeight <= 0) {
              openWeightEditor();
              return;
            }
            // Drop set: ~20% off the working weight, logged straight away and
            // marked (never a PR, but counts as volume).
            // Rounded to something the athlete's own gym can actually load:
            // 2.5 kg steps in a kilo gym, 5 lb steps in a pound one.
            const step = increment(unit);
            const dropW =
              nextWeight > 0
                ? Math.max(
                    toKg(step, unit),
                    toKg(Math.round((toDisplay(nextWeight, unit) * 0.8) / step) * step, unit),
                  )
                : 0;
            onLog({ weight: dropW, reps: nextReps, kind: "drop" });
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
          <span className="label-cap text-[9px] text-grit-dim ml-auto">
            BAR {trimNumber(plates.bar)}
            {unit.toUpperCase()}
          </span>
          {plates.remainder > 0 && (
            <span className="text-[10px] text-accent-red w-full">
              {trimNumber(plates.remainder)}
              {unit} short of {formatWeight(nextWeight, unit)} — needs microplates
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-grit-dim mt-3 leading-relaxed">
        Tap a set to tick it off, or tap a logged one to fix it — swipe for the next exercise. PRs
        are detected automatically.
      </p>

      {editingSet !== null && exercise.sets[editingSet] && (
        <SetEditorSheet
          set={exercise.sets[editingSet]!}
          index={editingSet}
          requiresWeight={requiresWeight}
          unit={unit}
          onSave={(patch) => {
            onEditSet(editingSet, patch);
            setEditingSet(null);
          }}
          onDelete={() => {
            onDeleteSet(editingSet);
            setEditingSet(null);
          }}
          onClose={() => setEditingSet(null)}
        />
      )}
    </div>
  );
}

/**
 * A cue written on the gym floor. Saved onto the day's plan, so the thing you
 * worked out mid-set is waiting for you the next time you do this movement.
 */
function NoteSheet({
  name,
  note,
  onSave,
  onClose,
}: {
  name: string;
  note: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={`Note for ${name}`}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl border-t border-grit bg-grit-card p-5"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="label-cap text-[10px] text-accent-red">CUE — {name.toUpperCase()}</p>
          <button onClick={onClose} className="icon-btn text-grit-dim" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <textarea
          ref={ref}
          defaultValue={note}
          rows={3}
          placeholder="Elbows tucked, pause on the chest…"
          className="input-grit mt-3 w-full resize-none"
          aria-label={`Note for ${name}`}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-grit-dim">
          Kept on your plan for this day — it shows up next time you train this movement.
        </p>
        <button onClick={() => onSave(ref.current?.value ?? "")} className="btn-grit mt-3 w-full">
          Save cue
        </button>
      </div>
    </div>
  );
}

/**
 * Which bar this movement is loaded on.
 *
 * Setting it fixes two things at once: the plate breakdown stops assuming an
 * Olympic bar, and the warm-up ramp stops suggesting weights lighter than the
 * bar you are holding.
 */
function BarPickerSheet({
  name,
  barKg,
  unit,
  onPick,
  onClose,
}: {
  name: string;
  barKg: number;
  unit: WeightUnit;
  onPick: (kg: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={`Bar for ${name}`}
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full overflow-auto rounded-t-2xl border-t border-grit bg-grit-card p-5"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="label-cap text-[10px] text-accent-red">BAR — {name.toUpperCase()}</p>
          <button onClick={onClose} className="icon-btn text-grit-dim" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <ul className="mt-3 space-y-1.5">
          {BAR_TYPES.map((bar) => {
            const active = bar.kg === barKg;
            return (
              <li key={bar.id}>
                <button
                  onClick={() => onPick(bar.kg)}
                  className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left press"
                  style={{ borderColor: active ? "#e63222" : "#262626" }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-grit">{bar.name}</span>
                    <span className="label-cap text-[9px] text-grit-dim">{bar.note}</span>
                  </span>
                  <span className="display text-sm font-extrabold text-grit">
                    {bar.kg > 0 ? formatWeight(bar.kg, unit) : "—"}
                  </span>
                  {active && <Check size={15} className="text-accent-red" />}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-grit-dim">
          Saved on your plan for this movement — plate maths and warm-ups use it from now on.
        </p>
      </div>
    </div>
  );
}

/** mm:ss in, seconds out. Accepts a bare number of seconds too. */
function parseClock(raw: string): number {
  const text = raw.trim();
  if (!text) return 0;
  const parts = text.split(":");
  if (parts.length === 2) {
    const mins = Number(parts[0]!.replace(/[^0-9]/g, "")) || 0;
    const secs = Number(parts[1]!.replace(/[^0-9]/g, "")) || 0;
    return mins * 60 + secs;
  }
  return Math.max(0, Math.round(Number(text.replace(/[^0-9.]/g, "")) || 0));
}

/** Seconds as an editable mm:ss string. */
function clockValue(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Correct or delete a set that was already logged. Opens over the logger so
 * the athlete never has to unwind good sets to fix a bad one.
 */
function SetEditorSheet({
  set: logged,
  index,
  requiresWeight,
  unit,
  onSave,
  onDelete,
  onClose,
}: {
  set: CompletedSet;
  index: number;
  requiresWeight: boolean;
  unit: WeightUnit;
  onSave: (patch: LoggedEntry) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const weightRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const distanceRef = useRef<HTMLInputElement>(null);

  function save() {
    // Typed in the athlete's units, stored in kilograms — the conversion
    // happens here so nothing downstream ever sees a pound value.
    const typed = Number((weightRef.current?.value ?? "").replace(/[^0-9.]/g, ""));
    const weight = Number.isFinite(typed) ? toKg(typed, unit) : Number.NaN;
    const reps = Math.floor(Number((repsRef.current?.value ?? "").replace(/[^0-9]/g, "")));
    const seconds = timeRef.current ? parseClock(timeRef.current.value) : undefined;
    const meters = distanceRef.current
      ? Math.round(Number(distanceRef.current.value.replace(/[^0-9.]/g, "")) || 0)
      : undefined;
    onSave({
      weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
      reps: logged.mode ? 0 : Number.isFinite(reps) && reps > 0 ? reps : logged.reps,
      ...(logged.mode ? { mode: logged.mode } : {}),
      ...(seconds ? { seconds } : {}),
      ...(meters ? { meters } : {}),
    });
  }

  const label =
    logged.kind === "warmup"
      ? "WARM-UP SET"
      : logged.kind === "drop"
        ? "DROP SET"
        : `SET ${index + 1}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${label.toLowerCase()}`}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl border-t border-grit bg-grit-card p-5"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="label-cap text-[10px] text-accent-red">EDIT {label}</p>
          <button onClick={onClose} className="icon-btn text-grit-dim" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {logged.mode === "duration" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label-cap text-[9px] text-grit-dim">TIME (MM:SS)</span>
              <input
                ref={timeRef}
                inputMode="numeric"
                defaultValue={clockValue(logged.seconds ?? 0)}
                className="input-grit mt-1 w-full"
                aria-label="Hold time"
              />
            </label>
            <label className="block">
              <span className="label-cap text-[9px] text-grit-dim">
                ADDED LOAD ({unit.toUpperCase()})
              </span>
              <input
                ref={weightRef}
                inputMode="decimal"
                defaultValue={logged.weight > 0 ? formatWeightValue(logged.weight, unit) : ""}
                placeholder="0"
                className="input-grit mt-1 w-full"
                aria-label={`Added load in ${unit}`}
              />
            </label>
          </div>
        ) : logged.mode === "distance" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label-cap text-[9px] text-grit-dim">DISTANCE (M)</span>
              <input
                ref={distanceRef}
                inputMode="numeric"
                defaultValue={logged.meters ? String(logged.meters) : ""}
                className="input-grit mt-1 w-full"
                aria-label="Distance in metres"
              />
            </label>
            <label className="block">
              <span className="label-cap text-[9px] text-grit-dim">TIME (MM:SS)</span>
              <input
                ref={timeRef}
                inputMode="numeric"
                defaultValue={logged.seconds ? clockValue(logged.seconds) : ""}
                placeholder="0:00"
                className="input-grit mt-1 w-full"
                aria-label="Elapsed time"
              />
            </label>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label-cap text-[9px] text-grit-dim">
                {requiresWeight
                  ? `WEIGHT (${unit.toUpperCase()})`
                  : `ADDED LOAD (${unit.toUpperCase()})`}
              </span>
              <input
                ref={weightRef}
                inputMode="decimal"
                defaultValue={logged.weight > 0 ? formatWeightValue(logged.weight, unit) : ""}
                placeholder={requiresWeight ? unit : "0"}
                className="input-grit mt-1 w-full"
                aria-label={`Weight in ${unit}`}
              />
            </label>
            <label className="block">
              <span className="label-cap text-[9px] text-grit-dim">REPS</span>
              <input
                ref={repsRef}
                inputMode="numeric"
                defaultValue={String(logged.reps)}
                className="input-grit mt-1 w-full"
                aria-label="Reps"
              />
            </label>
          </div>
        )}

        {logged.isPR && (
          <p className="mt-3 text-[11px] leading-relaxed text-grit-dim">
            This set is flagged as a PR. Editing it changes the numbers on the set, but the record
            it already earned stands.
          </p>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <button onClick={save} className="btn-grit">
            Save set
          </button>
          <button
            onClick={onDelete}
            className="border border-accent-red/50 rounded-xl px-4 label-cap text-[10px] text-accent-red press"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Logger for movements measured in time or distance. A plank logged as reps
 * poisons the rep history and hands out fake PRs, so holds, carries and
 * conditioning get a stopwatch and their own records instead.
 */
function TimedSetLogger({
  exercise,
  bests,
  unit,
  onLog,
  onEditSet,
  onDeleteSet,
}: {
  exercise: WorkoutSessionExercise;
  bests: { seconds: number; meters: number };
  unit: WeightUnit;
  onLog: (entry: LoggedEntry) => void;
  onEditSet: (setIndex: number, patch: LoggedEntry) => void;
  onDeleteSet: (setIndex: number) => void;
}) {
  const distance = exercise.tracking === "DISTANCE";
  const target = exercise.targetSeconds ?? 45;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [editingSet, setEditingSet] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const loadRef = useRef<HTMLInputElement>(null);
  const distanceRef = useRef<HTMLInputElement>(null);

  // Wall-clock based, not tick-counted: a backgrounded phone throttles timers,
  // and a hold that reads short because iOS paused the tab is worse than none.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt != null) setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  const logged = exercise.sets.length;
  const planned = Math.max(exercise.targetSets, logged);
  const addedLoad = () => {
    const typed = Number((loadRef.current?.value ?? "").replace(/[^0-9.]/g, ""));
    // Typed in the athlete's units; stored in kilograms like every other load.
    return Number.isFinite(typed) && typed > 0 ? toKg(typed, unit) : 0;
  };

  function stopAndLog() {
    const seconds = elapsed;
    setRunning(false);
    startedAtRef.current = null;
    setElapsed(0);
    if (seconds <= 0) return;
    onLog({ weight: addedLoad(), reps: 0, mode: "duration", seconds });
  }

  function logDistance() {
    const meters = Math.round(
      Number((distanceRef.current?.value ?? "").replace(/[^0-9.]/g, "")) || 0,
    );
    if (meters <= 0) return;
    onLog({
      weight: 0,
      reps: 0,
      mode: "distance",
      meters,
      ...(elapsed ? { seconds: elapsed } : {}),
    });
    setRunning(false);
    startedAtRef.current = null;
    setElapsed(0);
    if (distanceRef.current) distanceRef.current.value = "";
  }

  return (
    <div className="mt-5 bg-grit-card border border-grit rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="label-cap text-accent-red text-[10px]">
          {distance ? "DISTANCE EFFORT" : "TIMED HOLD"}
        </p>
        <p className="label-cap text-[10px] text-grit-dim">
          {logged}/{planned} · {distance ? "PER SET" : formatDuration(target)}
        </p>
      </div>

      {(distance ? bests.meters : bests.seconds) > 0 && (
        <div className="mt-3 flex items-center gap-2 border border-grit rounded-xl px-3 py-2">
          <Ghost size={11} className="ghost-live text-accent-red" />
          <span className="label-cap text-[9px] text-grit-dim">BEST SO FAR</span>
          <span className="display ml-auto text-sm font-extrabold text-grit">
            {distance ? formatDistance(bests.meters) : formatDuration(bests.seconds)}
          </span>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-grit px-4 py-5 text-center">
        <p
          className="display text-5xl font-extrabold tabular-nums leading-none"
          style={{ color: !distance && elapsed >= target ? "#22c55e" : "#f5f5f5" }}
          aria-live="off"
        >
          {formatDuration(elapsed)}
        </p>
        {!distance && (
          <p className="label-cap mt-2 text-[9px] text-grit-dim">
            {elapsed >= target ? "TARGET BEATEN" : `TARGET ${formatDuration(target)}`}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (running) {
                setRunning(false);
                startedAtRef.current = null;
                return;
              }
              startedAtRef.current = Date.now() - elapsed * 1000;
              setRunning(true);
            }}
            className="btn-ghost"
          >
            {running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
          </button>
          <button
            type="button"
            onClick={distance ? logDistance : stopAndLog}
            disabled={!distance && elapsed <= 0}
            className="btn-grit disabled:opacity-40"
          >
            <Check size={16} className="mr-2" />
            Log set
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {distance ? (
          <label className="block">
            <span className="label-cap text-[9px] text-grit-dim">DISTANCE (M)</span>
            <input
              ref={distanceRef}
              inputMode="numeric"
              placeholder="1000"
              className="input-grit mt-1 w-full"
              aria-label="Distance in metres"
            />
          </label>
        ) : (
          <label className="block">
            <span className="label-cap text-[9px] text-grit-dim">
              ADDED LOAD ({unit.toUpperCase()})
            </span>
            <input
              ref={loadRef}
              inputMode="decimal"
              placeholder="0"
              className="input-grit mt-1 w-full"
              aria-label={`Added load in ${unit}`}
            />
          </label>
        )}
        {!distance && (
          <button
            type="button"
            onClick={() =>
              onLog({ weight: addedLoad(), reps: 0, mode: "duration", seconds: target })
            }
            className="mt-[18px] border border-dashed border-grit rounded-xl py-2.5 label-cap text-[10px] text-grit-dim press"
          >
            Log {formatDuration(target)}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {Array.from({ length: planned }, (_, i) => {
          const doneSet = i < logged ? exercise.sets[i] : null;
          return (
            <button
              key={i}
              type="button"
              disabled={!doneSet}
              onClick={() => doneSet && setEditingSet(i)}
              className="w-full flex items-center justify-between border rounded-xl px-3 py-3 press text-left disabled:opacity-40"
              style={{
                borderColor: doneSet
                  ? doneSet.isPR
                    ? "rgba(230,50,34,.6)"
                    : "rgba(34,197,94,.4)"
                  : "#262626",
                background: doneSet ? "rgba(34,197,94,.05)" : undefined,
              }}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border"
                  style={{
                    borderColor: doneSet ? "#22c55e" : "#3a3a3a",
                    background: doneSet ? "#22c55e" : "transparent",
                  }}
                >
                  {doneSet && <Check size={14} className="text-black" strokeWidth={3} />}
                </span>
                <span className="label-cap text-[10px] text-[#8a8a8a]">SET {i + 1}</span>
              </span>
              <span className="display text-lg font-extrabold text-grit leading-none flex items-center">
                {doneSet ? formatSet(doneSet, false) : "—"}
                {doneSet?.isPR && <Flame size={14} className="ml-2 text-accent-red" />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-grit-dim mt-3 leading-relaxed">
        {distance
          ? "Log the distance you covered — time is optional. Distance efforts never count toward tonnage."
          : "Time under tension, not reps. Holds never count toward tonnage, and your record is the longest one."}
      </p>

      {editingSet !== null && exercise.sets[editingSet] && (
        <SetEditorSheet
          set={exercise.sets[editingSet]!}
          index={editingSet}
          requiresWeight={false}
          unit={unit}
          onSave={(patch) => {
            onEditSet(editingSet, patch);
            setEditingSet(null);
          }}
          onDelete={() => {
            onDeleteSet(editingSet);
            setEditingSet(null);
          }}
          onClose={() => setEditingSet(null)}
        />
      )}
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
  const unit = unitOf(getState());
  const [state] = useAppState();
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
              {Math.round(session.totalVolume).toLocaleString()}{" "}
              <span className="text-sm text-grit-dim">{unit}</span>
            </p>
          </div>
        )}

        <div className="mt-3">
          <SessionReflection sessionId={session.id} />
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
      {share && (
        <ShareCard
          session={session}
          displayName={state.profile?.displayName || state.profile?.username || undefined}
          username={state.profile?.username}
          onClose={onCloseShare}
        />
      )}
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
