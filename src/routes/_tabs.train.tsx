import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Play, Plus, Sparkles, ListPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { GritLogo } from "@/components/GritLogo";
import { VideoModal } from "@/components/VideoModal";
import { RestTimer } from "@/components/RestTimer";
import { useAppState } from "@/lib/storage";
import { EXERCISES, getExercise } from "@/lib/exercises";
import { defaultSchedule, isoDay, todayKey } from "@/lib/calc";
import { generateSchedule } from "@/lib/ai.functions";
import type { DayKey, Schedule, Program } from "@/lib/types";

const DAY_KEYS: DayKey[] = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const DAY_SHORT: Record<DayKey, string> = { MON:"Mon",TUE:"Tue",WED:"Wed",THU:"Thu",FRI:"Fri",SAT:"Sat",SUN:"Sun" };

export const Route = createFileRoute("/_tabs/train")({
  head: () => ({ meta: [{ title: "GRIT — Train" }] }),
  component: TrainPage,
});

function TrainPage() {
  const [state, set] = useAppState();
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey());
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [logFor, setLogFor] = useState<string | null>(null);
  const [resting, setResting] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const generate = useServerFn(generateSchedule);
  const activeProgram: Program | undefined = state.programs.find((p) => p.id === state.activeProgramId);
  const schedule: Schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : ({} as Schedule));
  const day = schedule[selectedDay];
  const programDay = activeProgram?.days[selectedDay];

  async function handleGenerate() {
    if (!state.profile) return;
    setGenLoading(true); setGenError(null);
    try {
      const res = await generate({ data: {
        goal: state.profile.goal, experience: state.profile.experience,
        daysPerWeek: state.profile.daysPerWeek, equipment: state.profile.equipment,
      }});
      const cleaned: Schedule = {} as Schedule;
      for (const k of DAY_KEYS) {
        const d = res.days?.[k];
        cleaned[k] = {
          label: d?.label || "REST",
          exerciseIds: (d?.exerciseIds || []).filter((id) => getExercise(id)),
        };
      }
      set((s) => ({ ...s, schedule: cleaned }));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed");
    } finally { setGenLoading(false); }
  }

  function completeWorkout() {
    const day = isoDay();
    set((s) => s.completedDates.includes(day) ? s : ({ ...s, completedDates: [...s.completedDates, day] }));
  }

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <GritLogo className="text-2xl" />
        <button onClick={() => setEditMode((v) => !v)} className="label-cap" style={{ color: editMode ? "#e63222" : "#8a8a8a" }}>
          {editMode ? "DONE" : "EDIT"}
        </button>
      </header>

      {/* Weekly strip */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {DAY_KEYS.map((k) => {
            const active = k === selectedDay;
            const isToday = k === todayKey();
            const lbl = schedule[k]?.label?.split(" — ")[0] || "REST";
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
      <div className="px-5 mb-5">
        <p className="label-cap">{selectedDay === todayKey() ? "Today" : DAY_SHORT[selectedDay]}</p>
        <h1 className="display text-3xl font-extrabold uppercase text-grit leading-tight mt-1">{day?.label || "REST"}</h1>
      </div>

      <div className="px-5 mb-5 flex gap-2">
        <button onClick={handleGenerate} disabled={genLoading} className="btn-grit flex-1">
          {genLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles size={16} className="mr-2" />}
          Generate Schedule
        </button>
      </div>
      {genError && <p className="px-5 mb-3 text-sm text-accent-red">{genError}</p>}

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
                onClick={() => { setVideoId(ex.videoId); setVideoTitle(ex.name); }}>
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
                <button onClick={() => setLogFor(id)} className="w-full py-3 label-cap" style={{ color: "#e63222" }}>
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
      </div>

      {videoId && <VideoModal videoId={videoId} title={videoTitle} onClose={() => setVideoId(null)} />}
      {logFor && <LogSetModal exerciseId={logFor} onClose={() => setLogFor(null)} onLogged={(secs) => { setLogFor(null); setResting(secs); }} />}
      {resting !== null && <RestTimer seconds={resting} onDone={() => setResting(null)} />}
    </div>
  );
}

function bestSet(logs: { exerciseId: string; weight: number }[], id: string) {
  const f = logs.filter((l) => l.exerciseId === id);
  if (f.length === 0) return null;
  return Math.max(...f.map((l) => l.weight));
}

function LogSetModal({ exerciseId, onClose, onLogged }: { exerciseId: string; onClose: () => void; onLogged: (rest: number) => void }) {
  const [, set] = useAppState();
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const ex = getExercise(exerciseId);
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
        <h3 className="display text-xl uppercase font-extrabold text-grit mb-4">{ex?.name}</h3>
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
