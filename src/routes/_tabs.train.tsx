import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Play, Plus, Sparkles, ListPlus, Flame, Trophy, Heart } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { VideoModal } from "@/components/VideoModal";
import { RestTimer } from "@/components/RestTimer";
import { Reminders } from "@/components/Reminders";
import { DailyQuests } from "@/components/DailyQuests";
import { Big3Card } from "@/components/Big3Card";
import { WeeklyRecap } from "@/components/WeeklyRecap";
import { QuickLogFAB } from "@/components/QuickLogFAB";
import { useAppState } from "@/lib/storage";
import { EXERCISES, getExercise } from "@/lib/exercises";
import { calculateGritScore, calculateStreak, defaultSchedule, isoDay, todayKey } from "@/lib/calc";
import { generateSchedule } from "@/lib/ai.functions";
import type { DayKey, Schedule, Program } from "@/lib/types";

const DAY_KEYS: DayKey[] = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const DAY_SHORT: Record<DayKey, string> = { MON:"Mon",TUE:"Tue",WED:"Wed",THU:"Thu",FRI:"Fri",SAT:"Sat",SUN:"Sun" };
const DAY_FULL: Record<DayKey, string> = { MON:"Monday",TUE:"Tuesday",WED:"Wednesday",THU:"Thursday",FRI:"Friday",SAT:"Saturday",SUN:"Sunday" };

function dayHype(dayKey: DayKey, label: string, isToday: boolean): { eyebrow: string; line: string } {
  const focus = (label || "REST").split(" — ")[0];
  const isRest = focus === "REST" || !focus;
  const dayName = DAY_FULL[dayKey].toUpperCase();
  if (isRest) {
    return {
      eyebrow: isToday ? `IT'S ${dayName} · REST DAY` : `${dayName} · REST`,
      line: isToday ? "Recover hard. Eat. Sleep. Come back stronger." : "Scheduled recovery day.",
    };
  }
  const hype: Record<string, string> = {
    CHEST: "Time to build that armor. Press heavy, control the descent.",
    BACK: "Pull like you mean it. Width, thickness, no half reps.",
    LEGS: "No skipping. Drive through the floor and earn the size.",
    SHOULDERS: "Capped delts day. Press overhead, own every rep.",
    ARMS: "Pump city. Slow eccentrics, full squeeze.",
    CORE: "Brace, breathe, burn. Bulletproof the midsection.",
    PUSH: "Chest, shoulders, triceps — push everything away from you.",
    PULL: "Back and biceps — pull the weight, pull yourself up.",
    UPPER: "Upper body grind. Hit every angle.",
    LOWER: "Quads, hams, glutes. Earn the staircase tomorrow.",
    FULL: "Full body assault. Compound lifts, big effort.",
  };
  const line = hype[focus] ?? "Lock in. Hit every set with intent.";
  return {
    eyebrow: isToday ? `IT'S ${dayName} · TODAY'S MISSION` : `${dayName} · ON DECK`,
    line,
  };
}


export const Route = createFileRoute("/_tabs/train")({
  head: () => ({ meta: [{ title: "DEADSET — Train" }] }),
  component: TrainPage,
});

function TrainPage() {
  const [state, set] = useAppState();
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey());
  const [videoState, setVideoState] = useState<{
    videoId?: string;
    query?: string;
    title: string;
    clipStart?: number;
    clipEnd?: number;
    cue?: string;
  } | null>(null);

  const [logFor, setLogFor] = useState<{ id: string; name: string } | null>(null);
  const [resting, setResting] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const generate = useServerFn(generateSchedule);
  const activeProgram: Program | undefined = state.programs.find((p) => p.id === state.activeProgramId);
  const schedule: Schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : ({} as Schedule));
  const day = schedule[selectedDay];
  const programDay = activeProgram?.days[selectedDay];
  const score = calculateGritScore(state);
  const streak = calculateStreak(state.completedDates);

  async function handleGenerate() {
    if (!state.profile) return;
    setGenLoading(true); setGenError(null);
    const buildFromDefault = (): Schedule => {
      const base = defaultSchedule(state.profile!);
      const cleaned: Schedule = {} as Schedule;
      for (const k of DAY_KEYS) {
        const d = base[k];
        cleaned[k] = {
          label: d?.label || "REST",
          exerciseIds: (d?.exerciseIds || []).filter((id) => getExercise(id)),
        };
      }
      return cleaned;
    };
    try {
      const res = await generate({ data: {
        goal: state.profile.goal, experience: state.profile.experience,
        daysPerWeek: state.profile.daysPerWeek, equipment: state.profile.equipment,
      }});
      const cleaned: Schedule = {} as Schedule;
      let hasAny = false;
      for (const k of DAY_KEYS) {
        const d = res.days?.[k];
        const ids = (d?.exerciseIds || []).filter((id) => getExercise(id));
        if (ids.length) hasAny = true;
        cleaned[k] = { label: d?.label || "REST", exerciseIds: ids };
      }
      set((s) => ({ ...s, schedule: hasAny ? cleaned : buildFromDefault() }));
    } catch {
      // Silent fallback so the user never sees an error — build a solid default split.
      set((s) => ({ ...s, schedule: buildFromDefault() }));
    } finally { setGenLoading(false); }
  }

  function completeWorkout() {
    const day = isoDay();
    set((s) => s.completedDates.includes(day) ? s : ({ ...s, completedDates: [...s.completedDates, day] }));
  }

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Link to="/profile" className="flex items-center gap-2.5">
          <div className="flex flex-col leading-tight">
            <span className="label-cap text-[9px]">PWR</span>
            <span className="display text-lg font-extrabold text-grit">{score.total}</span>
          </div>
          <div className="w-px h-6 bg-grit" />
          <div className="flex items-center gap-1">
            <Flame size={14} className="text-accent-red" />
            <span className="display text-lg font-extrabold text-grit">{streak}</span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/programs" className="label-cap text-grit-dim text-xs flex items-center gap-1">
            <ListPlus size={14} /> PROGRAMS
          </Link>
          <button onClick={() => setEditMode((v) => !v)} className="label-cap" style={{ color: editMode ? "#e63222" : "#8a8a8a" }}>
            {editMode ? "DONE" : "EDIT"}
          </button>
        </div>
      </header>
      <Reminders />

      <div className="px-5 mb-5"><Big3Card state={state} /></div>
      <div className="px-5 mb-5"><WeeklyRecap state={state} /></div>



      {/* ===== QUICK ACTIONS — everything you need, up top ===== */}
      {(() => {
        const today = todayKey();
        const todaysItems = activeProgram
          ? (activeProgram.days[today]?.items.length || 0)
          : (schedule[today]?.exerciseIds?.length || 0);
        const hasSchedule = !!state.schedule || !!activeProgram;
        const canStart = todaysItems > 0;
        return (
          <div className="px-5 mb-5">
            <div className="grid grid-cols-1 gap-2">
              {canStart ? (
                <Link to="/workout/live" className="btn-grit w-full text-base py-4 flex items-center justify-center">
                  <Flame size={18} className="mr-2" /> Start Today's Workout
                </Link>
              ) : !hasSchedule ? (
                <button onClick={handleGenerate} disabled={genLoading} className="btn-grit w-full text-base py-4 flex items-center justify-center">
                  {genLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Sparkles size={18} className="mr-2" />}
                  Generate My Schedule
                </button>
              ) : (
                <div className="bg-grit-card border border-grit p-3 text-center">
                  <p className="label-cap text-accent-red text-[10px]">REST DAY</p>
                  <p className="text-xs text-grit-dim mt-1">No exercises today — recover & come back stronger.</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Link to="/programs" className="btn-ghost py-2.5 flex items-center justify-center gap-2 text-xs">
                  <ListPlus size={14} /> Schedule
                </Link>
                <Link to="/challenges" className="btn-ghost py-2.5 flex items-center justify-center gap-2 text-xs">
                  <Trophy size={14} /> Challenge
                </Link>
                <Link to="/recovery" className="btn-ghost py-2.5 flex items-center justify-center gap-2 text-xs">
                  <Heart size={14} /> Recovery
                </Link>
              </div>
            </div>
            {genError && <p className="text-xs text-accent-red mt-2">{genError}</p>}
          </div>
        );
      })()}

      <DailyQuests />





      {activeProgram && (
        <div className="px-5 mb-3">
          <Link
            to="/programs/$programId"
            params={{ programId: activeProgram.id }}
            className="block bg-grit-card border border-accent-red px-3 py-2"
          >
            <p className="label-cap text-[9px] text-accent-red">ACTIVE PROGRAM</p>
            <p className="display uppercase font-extrabold text-grit text-sm truncate">{activeProgram.name}</p>
          </Link>
        </div>
      )}

      {/* Weekly strip */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {DAY_KEYS.map((k) => {
            const active = k === selectedDay;
            const isToday = k === todayKey();
            const lbl = (activeProgram ? activeProgram.days[k].label : schedule[k]?.label)?.split(" — ")[0] || "REST";
            return (
              <button key={k} onClick={() => setSelectedDay(k)}
                className="flex-shrink-0 min-w-[68px] p-2 border text-center"
                style={{
                  borderColor: active ? "#e63222" : "#262626",
                  background: active ? "#1a1a1a" : "transparent",
                }}>
                <div className="label-cap" style={{ color: isToday ? "#e63222" : undefined }}>{DAY_SHORT[k]}</div>
                <div className="text-xs font-bold uppercase mt-1 text-grit truncate">{lbl}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today header */}
      {(() => {
        const rawLabel = (activeProgram ? programDay?.label : day?.label) || "REST";
        const hype = dayHype(selectedDay, rawLabel, selectedDay === todayKey());
        return (
          <div className="px-5 mb-5">
            <p className="label-cap text-accent-red">{hype.eyebrow}</p>
            <h1 className="display text-3xl font-extrabold uppercase text-grit leading-tight mt-1">
              {rawLabel}
            </h1>
            <p className="text-sm text-grit-dim mt-2 leading-snug">{hype.line}</p>
          </div>
        );
      })()}



      {/* Edit mode: assign muscle group per day */}
      {editMode && (
        <div className="px-5 mb-5 bg-grit-card border border-grit p-4">
          <p className="label-cap mb-3">Edit {DAY_SHORT[selectedDay]}</p>
          <label className="label-cap block mb-1">Label</label>
          <input
            value={day?.label || ""}
            onChange={(e) => set((s) => ({ ...s, schedule: { ...(s.schedule || schedule), [selectedDay]: { ...(s.schedule?.[selectedDay] || day), label: e.target.value.toUpperCase() } } }))}
            className="input-grit mb-3"
          />
          <p className="label-cap mb-2">Exercises</p>
          <div className="grid grid-cols-2 gap-2">
            {EXERCISES.map((e) => {
              const sel = day?.exerciseIds.includes(e.id);
              return (
                <button key={e.id}
                  onClick={() => set((s) => {
                    const sched = { ...(s.schedule || schedule) };
                    const cur = sched[selectedDay]?.exerciseIds || [];
                    const next = cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id];
                    sched[selectedDay] = { ...(sched[selectedDay] || { label: day?.label || "" }), exerciseIds: next };
                    return { ...s, schedule: sched };
                  })}
                  className="p-2 border text-left text-xs font-bold uppercase"
                  style={{ borderColor: sel ? "#e63222" : "#262626", color: sel ? "#e63222" : "#f5f5f0" }}>
                  {e.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Exercises */}
      <div className="px-5 flex flex-col gap-3">
        {activeProgram ? (
          <>
            {(programDay?.items.length || 0) === 0 && (
              <div className="bg-grit-card border border-grit p-8 text-center">
                <p className="display text-2xl uppercase text-grit font-extrabold">Rest Day</p>
                <p className="text-sm text-[#8a8a8a] mt-2">Recover. Eat. Sleep.</p>
              </div>
            )}
            {programDay?.items.map((it) => {
              const pr = bestSet(state.logs, it.id);
              return (
                <div key={it.id} className="bg-grit-card border border-grit">
                  <button className="w-full p-3 text-left"
                    onClick={() => setVideoState({ query: it.youtube_query || it.name, title: it.name })}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="display uppercase font-extrabold text-grit text-lg leading-tight">{it.name}</div>
                      <Play size={18} className="text-accent-red flex-shrink-0" />
                    </div>
                    <div className="text-xs text-[#8a8a8a] mt-1">{it.sets} × {it.reps}</div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 border border-grit uppercase font-bold tracking-wider">{it.equipment}</span>
                      {it.primary_muscles.slice(0, 2).map((m) => (
                        <span key={m} className="text-[10px] px-2 py-0.5 border border-grit uppercase font-bold tracking-wider text-grit-dim">{m}</span>
                      ))}
                      {pr && <span className="text-[10px] px-2 py-0.5 bg-accent-red text-white uppercase font-bold tracking-wider">PR {pr}KG</span>}
                    </div>
                  </button>
                  <div className="border-t border-grit">
                    <button onClick={() => setLogFor({ id: it.id, name: it.name })} className="w-full py-3 label-cap" style={{ color: "#e63222" }}>
                      <Plus size={14} className="inline mr-1 -mt-0.5" /> Log Set
                    </button>
                  </div>
                </div>
              );
            })}
            {(programDay?.items.length || 0) > 0 && (
              <button onClick={completeWorkout} className="btn-grit mt-4 mb-2">
                {state.completedDates.includes(isoDay()) ? "Workout Complete ✓" : "Complete Workout"}
              </button>
            )}
          </>
        ) : (
          <>
            {(day?.exerciseIds || []).length === 0 && (
              <div className="bg-grit-card border border-grit p-8 text-center">
                <p className="display text-2xl uppercase text-grit font-extrabold">Rest Day</p>
                <p className="text-sm text-[#8a8a8a] mt-2">Recover. Eat. Sleep.</p>
              </div>
            )}
            {(day?.exerciseIds || []).map((id) => {
              const ex = getExercise(id);
              if (!ex) return null;
              const pr = bestSet(state.logs, id);
              return (
                <div key={id} className="bg-grit-card border border-grit">
                  <button className="w-full grid grid-cols-[96px_1fr] gap-0 text-left"
                    onClick={() => setVideoState({ videoId: ex.videoId, title: ex.name, clipStart: ex.clipStart, clipEnd: ex.clipEnd, cue: ex.instruction })}>
                    <div className="relative bg-black" style={{ aspectRatio: "1 / 1" }}>
                      <img src={`https://img.youtube.com/vi/${ex.videoId}/mqdefault.jpg`} alt={ex.name} className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Play size={26} className="text-white" />
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="display uppercase font-extrabold text-grit text-lg leading-tight">{ex.name}</div>
                      <div className="text-xs text-[#8a8a8a] mt-1">{ex.sets} × {ex.reps}</div>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 border border-grit uppercase font-bold tracking-wider">{ex.skill}</span>
                        {pr && <span className="text-[10px] px-2 py-0.5 bg-accent-red text-white uppercase font-bold tracking-wider">PR {pr}KG</span>}
                      </div>
                    </div>
                  </button>
                  <div className="border-t border-grit">
                    <button onClick={() => setLogFor({ id, name: ex.name })} className="w-full py-3 label-cap" style={{ color: "#e63222" }}>
                      <Plus size={14} className="inline mr-1 -mt-0.5" /> Log Set
                    </button>
                  </div>
                </div>
              );
            })}
            {(day?.exerciseIds?.length || 0) > 0 && (
              <button onClick={completeWorkout} className="btn-grit mt-4 mb-2">
                {state.completedDates.includes(isoDay()) ? "Workout Complete ✓" : "Complete Workout"}
              </button>
            )}
          </>
        )}
      </div>

      {videoState && (
        <VideoModal
          videoId={videoState.videoId}
          query={videoState.query}
          title={videoState.title}
          clipStart={videoState.clipStart}
          clipEnd={videoState.clipEnd}
          cue={videoState.cue}
          onClose={() => setVideoState(null)}
        />
      )}

      {logFor && <LogSetModal exerciseId={logFor.id} exerciseName={logFor.name} onClose={() => setLogFor(null)} onLogged={(secs) => { setLogFor(null); setResting(secs); }} />}
      {resting !== null && <RestTimer seconds={resting} onDone={() => setResting(null)} />}
      <QuickLogFAB />
    </div>
  );
}

function bestSet(logs: { exerciseId: string; weight: number }[], id: string) {
  const f = logs.filter((l) => l.exerciseId === id);
  if (f.length === 0) return null;
  return Math.max(...f.map((l) => l.weight));
}

function LogSetModal({ exerciseId, exerciseName, onClose, onLogged }: { exerciseId: string; exerciseName?: string; onClose: () => void; onLogged: (rest: number) => void }) {
  const [, set] = useAppState();
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const ex = getExercise(exerciseId);
  const displayName = exerciseName ?? ex?.name ?? "Exercise";
  function save(rest: number) {
    const w = Number(weight); const r = Number(reps);
    if (!r) return;
    set((s) => ({ ...s, logs: [...s.logs, { exerciseId, weight: w || 0, reps: r, date: new Date().toISOString() }] }));
    onLogged(rest);
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full bg-grit-card border-t border-accent-red p-5 max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
        <p className="label-cap mb-1">Log Set</p>
        <h3 className="display text-xl uppercase font-extrabold text-grit mb-4">{displayName}</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label-cap block mb-1">Weight (kg)</label>
            <input autoFocus inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="input-grit" />
          </div>
          <div>
            <label className="label-cap block mb-1">Reps</label>
            <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="input-grit" />
          </div>
        </div>
        <p className="label-cap mb-2">Rest</p>
        <div className="grid grid-cols-3 gap-2">
          {[60, 90, 120].map((s) => (
            <button key={s} onClick={() => save(s)} className="btn-grit">{s}s</button>
          ))}
        </div>
      </div>
    </div>
  );
}
