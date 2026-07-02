import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Loader2,
  Play,
  Plus,
  Sparkles,
  ListPlus,
  Flame,
  Trophy,
  Heart,
  Activity,
} from "lucide-react";
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
import { AsyncStatus } from "@/components/AsyncStatus";
import { toast } from "sonner";
import { ProBanner } from "@/components/ProBanner";
import { InsightsWidget } from "@/components/InsightsWidget";
import { AIToolbox } from "@/components/AIToolbox";
import { usePaywall } from "@/hooks/usePro";
import { Camera } from "lucide-react";
import type { DayKey, Schedule, Program } from "@/lib/types";

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
const DAY_FULL: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

function dayHype(
  dayKey: DayKey,
  label: string,
  isToday: boolean,
): { eyebrow: string; line: string } {
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
  const { open: openPaywall } = usePaywall();
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
  const [editSearch, setEditSearch] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const generate = useServerFn(generateSchedule);
  const activeProgram: Program | undefined = state.programs.find(
    (p) => p.id === state.activeProgramId,
  );
  const schedule: Schedule =
    state.schedule ?? (state.profile ? defaultSchedule(state.profile) : ({} as Schedule));
  const day = schedule[selectedDay];
  const programDay = activeProgram?.days[selectedDay];
  const score = calculateGritScore(state);
  const streak = calculateStreak(state.completedDates);

  async function handleGenerate() {
    setGenLoading(true);
    setGenError(null);
    const profile =
      state.profile ??
      ({
        goal: "MAINTAIN",
        experience: "BEGINNER",
        gender: "OTHER",
        age: 25,
        weightKg: 75,
        heightCm: 175,
        daysPerWeek: 4,
        equipment: "FULL_GYM",
        username: "athlete",
        startingWeightKg: 75,
      } as unknown as NonNullable<typeof state.profile>);
    const buildFromDefault = (): Schedule => {
      const base = defaultSchedule(profile);
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
      const res = await generate({
        data: {
          goal: profile.goal,
          experience: profile.experience,
          daysPerWeek: profile.daysPerWeek,
          equipment: profile.equipment,
        },
      });
      const cleaned: Schedule = {} as Schedule;
      let hasAny = false;
      for (const k of DAY_KEYS) {
        const d = res.days?.[k];
        const ids = (d?.exerciseIds || []).filter((id) => getExercise(id));
        if (ids.length) hasAny = true;
        cleaned[k] = { label: d?.label || "REST", exerciseIds: ids };
      }
      set((s) => ({ ...s, schedule: hasAny ? cleaned : buildFromDefault() }));
    } catch (e) {
      // Non-blocking: we still build a solid default split so the user is
      // never stranded — but surface a toast so they know AI was unavailable
      // and can retry from the generator button.
      const msg = e instanceof Error ? e.message : "AI generator unavailable";
      setGenError(msg);
      toast.error(`${msg} — using a default split`);
      set((s) => ({ ...s, schedule: buildFromDefault() }));
    } finally {
      setGenLoading(false);
    }
  }

  function completeWorkout() {
    const day = isoDay();
    set((s) =>
      s.completedDates.includes(day) ? s : { ...s, completedDates: [...s.completedDates, day] },
    );
  }

  return (
    <div className="animate-fade-in pb-4">
      {/* Strava-style greeting header */}
      <div className="px-5 pt-5 pb-4 animate-slide-down">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#8A8A8A" }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }).toUpperCase()}
            </p>
            <h1 className="display text-2xl font-extrabold text-white mt-0.5">
              {state.profile?.username ? `HEY, ${state.profile.username.toUpperCase()}` : "LET'S TRAIN"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats chips */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "#141414", border: "1px solid #262626" }}
            >
              <Flame size={13} style={{ color: "#E10600" }} />
              <span className="display text-sm font-extrabold text-white">{streak}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/programs"
                className="flex items-center justify-center rounded-full press"
                style={{ width: 34, height: 34, background: "#141414", border: "1px solid #262626" }}
                aria-label="Programs"
              >
                <ListPlus size={15} style={{ color: "#8A8A8A" }} />
              </Link>
              <button
                onClick={() => setEditMode((v) => !v)}
                className="flex items-center justify-center rounded-full press"
                style={{
                  width: 34,
                  height: 34,
                  background: editMode ? "rgba(225,6,0,0.12)" : "#141414",
                  border: `1px solid ${editMode ? "#E10600" : "#262626"}`,
                }}
                aria-label="Edit schedule"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: editMode ? "#E10600" : "#8A8A8A" }}>
                  {editMode ? "Done" : "Edit"}
                </span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* AI feature shortcuts */}
      <AIToolbox />

      {/* Weekly insights widget */}
      <InsightsWidget />

      <div className="px-5">
        {/* Quick-start CTA */}
        {(() => {
          const today = todayKey();
          const isToday = selectedDay === today;
          const selectedItems = activeProgram
            ? activeProgram.days[selectedDay]?.items.length || 0
            : schedule[selectedDay]?.exerciseIds?.length || 0;
          const todaysItems = activeProgram
            ? activeProgram.days[today]?.items.length || 0
            : schedule[today]?.exerciseIds?.length || 0;
          const hasSchedule = !!state.schedule || !!activeProgram;
          const selectedIsRest = selectedItems === 0;
          if (!hasSchedule) {
            return (
              <button
                onClick={handleGenerate}
                disabled={genLoading}
                className="btn-grit w-full text-base py-4 flex items-center justify-center"
                style={{ borderRadius: 12, fontSize: "0.95rem" }}
              >
                {genLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Sparkles size={18} className="mr-2" />}
                {genLoading ? "Building Your Plan…" : "Generate My Schedule"}
              </button>
            );
          }
          if (isToday && !selectedIsRest) {
            return (
              <Link
                to="/workout/live"
                className="btn-grit w-full text-base py-4 flex items-center justify-center"
                style={{ borderRadius: 12, fontSize: "0.95rem", letterSpacing: "0.03em" }}
              >
                <Flame size={18} className="mr-2" /> Start Today's Workout
              </Link>
            );
          }
          if (!isToday && !selectedIsRest) {
            return (
              <div
                className="p-4 text-center"
                style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 12 }}
              >
                <p className="text-sm font-bold text-white">{DAY_FULL[selectedDay]}'s workout</p>
                <p className="text-xs mt-0.5" style={{ color: "#8A8A8A" }}>
                  {isToday ? "" : "Come back on " + DAY_FULL[selectedDay] + " · "}
                  {selectedItems} exercise{selectedItems !== 1 ? "s" : ""}
                  {todaysItems > 0 && !isToday ? (
                    <> &nbsp;·&nbsp;
                      <Link to="/workout/live" style={{ color: "#E10600", fontWeight: 700 }}>
                        Start today's instead ›
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            );
          }
          return (
            <div
              className="p-4 text-center"
              style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 12 }}
            >
              <p className="text-sm font-bold" style={{ color: "#8A8A8A" }}>
                {isToday ? "Rest Day — Recover & Come Back Stronger" : `${DAY_FULL[selectedDay]} is a rest day`}
              </p>
              {!isToday && todaysItems > 0 && (
                <Link to="/workout/live" className="text-xs mt-1.5 block font-bold" style={{ color: "#E10600" }}>
                  Start today's workout instead ›
                </Link>
              )}
            </div>
          );
        })()}
        {genLoading && (
          <div className="mt-2">
            <AsyncStatus loading loadingLabel="Building your schedule…" />
          </div>
        )}
        {genError && !genLoading && (
          <div className="mt-2">
            <AsyncStatus error={genError} onRetry={handleGenerate} retryLabel="Retry AI generator" />
          </div>
        )}
      </div>

      <ProBanner />
      <Reminders />

      {/* Quick actions */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            { to: "/progress", Icon: Activity, label: "Progress" },
            { to: "/programs", Icon: ListPlus, label: "Schedule" },
            { to: "/challenges", Icon: Trophy, label: "Challenge" },
            { to: "/recovery", Icon: Heart, label: "Recovery" },
          ].map(({ to, Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1.5 py-3 press"
              style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 12 }}
            >
              <Icon size={18} style={{ color: "#E10600" }} />
              <span className="text-[10px] font-semibold" style={{ color: "#8A8A8A" }}>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Physique Scan — PRO */}
      <div className="px-5 mb-5">
        <button
          onClick={() => openPaywall({
            feature: "Physique Scan",
            description: "Take photos from 3 angles and our AI will identify your muscle imbalances and weaknesses — then build a programme targeting them.",
          })}
          className="w-full flex items-center gap-4 p-4 press text-left"
          style={{ background: "linear-gradient(135deg,#1a0606 0%,#141414 100%)", border: "1.5px solid rgba(225,6,0,0.4)", borderRadius: 12 }}
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full" style={{ background: "rgba(225,6,0,0.15)", border: "1px solid rgba(225,6,0,0.4)" }}>
            <Camera size={18} style={{ color: "#E10600" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="display text-sm font-extrabold uppercase text-white">Physique Scan</span>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: "#E10600", color: "#fff" }}>PRO</span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "#8A8A8A" }}>Scan your body · detect weaknesses · build your programme</p>
          </div>
          <span style={{ color: "#E10600", fontSize: 18 }}>›</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="px-5 mb-5 animate-slide-up delay-100">
        <Big3Card state={state} />
      </div>
      <div className="px-5 mb-5 animate-slide-up delay-150">
        <WeeklyRecap state={state} />
      </div>

      <DailyQuests />

      {activeProgram && (
        <div className="px-4 mb-3">
          <Link
            to="/programs/$programId"
            params={{ programId: activeProgram.id }}
            className="flex items-center justify-between px-4 py-3 press"
            style={{ background: "rgba(225,6,0,0.1)", border: "1.5px solid rgba(225,6,0,0.4)", borderRadius: 12 }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#E10600" }}>Active Program</p>
              <p className="display uppercase font-extrabold text-white text-sm truncate mt-0.5">
                {activeProgram.name}
              </p>
            </div>
            <div style={{ color: "#E10600", fontSize: 18 }}>›</div>
          </Link>
        </div>
      )}

      {/* Strava-style day strip */}
      <div className="px-4 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {DAY_KEYS.map((k) => {
            const active = k === selectedDay;
            const isToday = k === todayKey();
            const lbl =
              (activeProgram ? activeProgram.days[k].label : schedule[k]?.label)?.split(" — ")[0] ||
              "REST";
            const isRest = lbl === "REST";
            return (
              <button
                key={k}
                onClick={() => setSelectedDay(k)}
                className="flex-shrink-0 flex flex-col items-center pt-2 pb-2 px-2.5 press"
                style={{
                  minWidth: 62,
                  borderRadius: 12,
                  background: active ? "#E10600" : "#141414",
                  border: `1.5px solid ${active ? "#E10600" : isToday ? "rgba(225,6,0,0.5)" : "#262626"}`,
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: active ? "#fff" : isToday ? "#E10600" : "#8A8A8A" }}
                >
                  {DAY_SHORT[k]}
                </span>
                <span
                  className="text-[10px] font-semibold uppercase mt-1 truncate w-full text-center"
                  style={{ color: active ? "rgba(255,255,255,0.85)" : isRest ? "#4A4B52" : "#fff" }}
                >
                  {lbl}
                </span>
                {isToday && !active && (
                  <span
                    className="mt-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: "#E10600" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day header */}
      {(() => {
        const rawLabel = (activeProgram ? programDay?.label : day?.label) || "REST";
        const hype = dayHype(selectedDay, rawLabel, selectedDay === todayKey());
        return (
          <div className="px-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#E10600" }}>
              {hype.eyebrow}
            </p>
            <h2 className="display text-2xl font-extrabold uppercase text-white leading-tight mt-1">
              {rawLabel}
            </h2>
            <p className="text-sm mt-1.5 leading-snug" style={{ color: "#8A8A8A" }}>{hype.line}</p>
          </div>
        );
      })()}

      {/* Edit mode */}
      {editMode && (
        <div
          className="mx-4 mb-4 p-4"
          style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 14 }}
        >
          <p className="label-cap mb-3">Edit {DAY_SHORT[selectedDay]}</p>
          <label className="label-cap block mb-1">Label</label>
          <input
            value={day?.label || ""}
            onChange={(e) =>
              set((s) => ({
                ...s,
                schedule: {
                  ...(s.schedule || schedule),
                  [selectedDay]: {
                    ...(s.schedule?.[selectedDay] || day),
                    label: e.target.value.toUpperCase(),
                  },
                },
              }))
            }
            className="input-grit mb-3"
          />

          {/* Selected exercises */}
          {(day?.exerciseIds?.length || 0) > 0 && (
            <>
              <p className="label-cap mb-2">Selected ({day!.exerciseIds.length}) — tap × to remove, edit sets/reps</p>
              <div className="flex flex-col gap-2 mb-3">
                {day!.exerciseIds.map((id) => {
                  const ex = getExercise(id);
                  if (!ex) return null;
                  const ov = day!.overrides?.[id];
                  const sets = ov?.sets ?? ex.sets;
                  const reps = ov?.reps ?? ex.reps;
                  const updateOverride = (next: { sets?: number; reps?: string }) =>
                    set((s) => {
                      const sched = { ...(s.schedule || schedule) };
                      const cur = sched[selectedDay] || { label: day?.label || "REST", exerciseIds: [] };
                      const overrides = { ...(cur.overrides || {}) };
                      overrides[id] = { ...(overrides[id] || {}), ...next };
                      sched[selectedDay] = { ...cur, overrides };
                      return { ...s, schedule: sched };
                    });
                  return (
                    <div
                      key={id}
                      className="p-2.5 flex items-center gap-2"
                      style={{ background: "rgba(225,6,0,0.08)", border: "1px solid rgba(225,6,0,0.35)", borderRadius: 10 }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase truncate text-white">{ex.name}</p>
                      </div>
                      <input
                        inputMode="numeric"
                        value={sets}
                        onChange={(e) => {
                          const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                          updateOverride({ sets: n });
                        }}
                        className="w-12 h-9 text-center text-sm font-bold bg-black text-white border border-grit"
                        aria-label="sets"
                      />
                      <span className="text-grit-dim text-xs">×</span>
                      <input
                        value={reps}
                        onChange={(e) => updateOverride({ reps: e.target.value })}
                        className="w-16 h-9 text-center text-sm font-bold bg-black text-white border border-grit"
                        aria-label="reps"
                      />
                      <button
                        onClick={() =>
                          set((s) => {
                            const sched = { ...(s.schedule || schedule) };
                            const cur = sched[selectedDay]?.exerciseIds || [];
                            const overrides = { ...(sched[selectedDay]?.overrides || {}) };
                            delete overrides[id];
                            sched[selectedDay] = {
                              ...(sched[selectedDay] || { label: day?.label || "REST" }),
                              exerciseIds: cur.filter((x) => x !== id),
                              overrides,
                            };
                            return { ...s, schedule: sched };
                          })
                        }
                        className="w-8 h-8 flex items-center justify-center text-accent-red font-bold"
                        aria-label="remove"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <p className="label-cap mb-2">Add exercises</p>
          <input
            placeholder="SEARCH NAME OR MUSCLE"
            value={editSearch}
            onChange={(e) => setEditSearch(e.target.value)}
            className="input-grit mb-2"
          />
          <div className="max-h-72 overflow-y-auto -mx-1 px-1">
            <div className="grid grid-cols-1 gap-1.5">
              {EXERCISES.filter((e) => {
                const q = editSearch.trim().toLowerCase();
                if (!q) return true;
                return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
              }).map((e) => {
                const sel = day?.exerciseIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() =>
                      set((s) => {
                        const sched = { ...(s.schedule || schedule) };
                        const cur = sched[selectedDay]?.exerciseIds || [];
                        const next = cur.includes(e.id)
                          ? cur.filter((x) => x !== e.id)
                          : [...cur, e.id];
                        sched[selectedDay] = {
                          ...(sched[selectedDay] || { label: day?.label || "REST" }),
                          exerciseIds: next,
                        };
                        return { ...s, schedule: sched };
                      })
                    }
                    className="p-3 text-left flex items-center justify-between gap-2 press"
                    style={{
                      background: sel ? "rgba(225,6,0,0.08)" : "#141414",
                      border: `1px solid ${sel ? "rgba(225,6,0,0.4)" : "#262626"}`,
                      borderRadius: 10,
                    }}
                  >
                    <div className="min-w-0">
                      <div
                        className="text-xs font-bold uppercase truncate"
                        style={{ color: sel ? "#E10600" : "#ffffff" }}
                      >
                        {e.name}
                      </div>
                      <div className="text-[9px] mt-0.5 font-medium uppercase tracking-wider" style={{ color: "#8A8A8A" }}>
                        {e.muscleGroup} · {e.skill}
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: sel ? "#E10600" : "#8A8A8A", flexShrink: 0 }}
                    >
                      {sel ? "✓" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div className="px-4 flex flex-col gap-3 pb-4">
        {activeProgram ? (
          <>
            {(programDay?.items.length || 0) === 0 && (
              <div
                className="p-8 text-center"
                style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 14 }}
              >
                <p className="display text-2xl uppercase text-white font-extrabold">Rest Day</p>
                <p className="text-sm mt-2 mb-4" style={{ color: "#8A8A8A" }}>Recover. Eat. Sleep. Grow.</p>
                <Link to="/workout/live" className="btn-ghost text-sm py-2.5">
                  Open Freestyle
                </Link>
              </div>
            )}
            {programDay?.items.map((it) => {
              const pr = bestSet(state.logs, it.id);
              return (
                <ExerciseCard
                  key={it.id}
                  name={it.name}
                  sets={`${it.sets} × ${it.reps}`}
                  tags={[it.equipment, ...it.primary_muscles.slice(0, 2)]}
                  pr={pr}
                  onWatch={() => setVideoState({ query: it.youtube_query || it.name, title: it.name })}
                  onLog={() => setLogFor({ id: it.id, name: it.name })}
                />
              );
            })}
            {(programDay?.items.length || 0) > 0 && (
              <button onClick={completeWorkout} className="btn-grit mt-2 mb-4 w-full">
                {state.completedDates.includes(isoDay()) ? "✓ Workout Complete" : "Complete Workout"}
              </button>
            )}
          </>
        ) : (
          <>
            {(day?.exerciseIds || []).length === 0 && (
              <div
                className="p-8 text-center"
                style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 14 }}
              >
                <p className="display text-2xl uppercase text-white font-extrabold">Rest Day</p>
                <p className="text-sm mt-2" style={{ color: "#8A8A8A" }}>Recover. Eat. Sleep. Grow.</p>
              </div>
            )}
            {(day?.exerciseIds || []).map((id) => {
              const ex = getExercise(id);
              if (!ex) return null;
              const ov = day?.overrides?.[id];
              const sets = ov?.sets ?? ex.sets;
              const reps = ov?.reps ?? ex.reps;
              const pr = bestSet(state.logs, id);
              return (
                <ExerciseCard
                  key={id}
                  name={ex.name}
                  sets={`${sets} × ${reps}`}
                  tags={[ex.skill]}
                  pr={pr}
                  videoId={ex.videoId}
                  onWatch={() =>
                    setVideoState({
                      videoId: ex.videoId,
                      title: ex.name,
                      clipStart: ex.clipStart,
                      clipEnd: ex.clipEnd,
                      cue: ex.instruction,
                    })
                  }
                  onLog={() => setLogFor({ id, name: ex.name })}
                />
              );
            })}
            {(day?.exerciseIds?.length || 0) > 0 && (
              <button onClick={completeWorkout} className="btn-grit mt-2 mb-4 w-full">
                {state.completedDates.includes(isoDay()) ? "✓ Workout Complete" : "Complete Workout"}
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

      {logFor && (
        <LogSetModal
          exerciseId={logFor.id}
          exerciseName={logFor.name}
          onClose={() => setLogFor(null)}
          onLogged={(secs) => {
            setLogFor(null);
            setResting(secs);
          }}
        />
      )}
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

function ExerciseCard({
  name,
  sets,
  tags,
  pr,
  videoId,
  onWatch,
  onLog,
}: {
  name: string;
  sets: string;
  tags: string[];
  pr: number | null;
  videoId?: string;
  onWatch: () => void;
  onLog: () => void;
}) {
  return (
    <div
      className="overflow-hidden"
      style={{ background: "#141414", border: "1.5px solid #262626", borderRadius: 14 }}
    >
      <button className="w-full text-left press" onClick={onWatch}>
        <div className="flex gap-0">
          {videoId && (
            <div
              className="relative flex-shrink-0"
              style={{ width: 90, aspectRatio: "1/1", background: "#0A0A0A" }}
            >
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt={name}
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.35)" }}
              >
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 30,
                    height: 30,
                    background: "rgba(225,6,0,0.9)",
                    boxShadow: "0 2px 8px rgba(225,6,0,0.5)",
                  }}
                >
                  <Play size={14} color="#fff" fill="#fff" />
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="display uppercase font-extrabold text-white text-base leading-tight">{name}</p>
              {!videoId && (
                <Play size={16} style={{ color: "#E10600", flexShrink: 0, marginTop: 2 }} />
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: "#8A8A8A" }}>{sets}</p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {tags.filter(Boolean).slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-semibold uppercase px-2 py-0.5"
                  style={{
                    background: "#141414",
                    color: "#8A8A8A",
                    borderRadius: 6,
                    letterSpacing: "0.05em",
                  }}
                >
                  {t}
                </span>
              ))}
              {pr !== null && (
                <span className="pr-badge">
                  ★ PR {pr}kg
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      <div style={{ borderTop: "1px solid #262626" }}>
        <button
          onClick={onLog}
          className="w-full py-2.5 flex items-center justify-center gap-1.5 press"
          style={{ color: "#E10600", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.05em" }}
        >
          <Plus size={14} /> Log Set
        </button>
      </div>
    </div>
  );
}

function LogSetModal({
  exerciseId,
  exerciseName,
  onClose,
  onLogged,
}: {
  exerciseId: string;
  exerciseName?: string;
  onClose: () => void;
  onLogged: (rest: number) => void;
}) {
  const [, set] = useAppState();
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const ex = getExercise(exerciseId);
  const displayName = exerciseName ?? ex?.name ?? "Exercise";
  function save(rest: number) {
    const w = Number(weight);
    const r = Number(reps);
    if (!r) return;
    set((s) => ({
      ...s,
      logs: [...s.logs, { exerciseId, weight: w || 0, reps: r, date: new Date().toISOString() }],
    }));
    onLogged(rest);
  }
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full p-5 max-w-md mx-auto animate-slide-up"
        style={{
          background: "#141414",
          borderTop: "2px solid #E10600",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1 rounded-full mx-auto mb-4"
          style={{ background: "#262626" }}
        />
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#E10600" }}>
          Log Set
        </p>
        <h3 className="display text-xl uppercase font-extrabold text-white mb-5">{displayName}</h3>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="label-cap block mb-1.5">Weight (kg)</label>
            <input
              autoFocus
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="input-grit text-center text-xl font-bold"
            />
          </div>
          <div>
            <label className="label-cap block mb-1.5">Reps</label>
            <input
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="input-grit text-center text-xl font-bold"
            />
          </div>
        </div>
        <p className="label-cap mb-2.5">Start rest timer</p>
        <div className="grid grid-cols-3 gap-2">
          {[60, 90, 120].map((s) => (
            <button
              key={s}
              onClick={() => save(s)}
              className="py-3 font-bold text-sm press"
              style={{
                background: "#141414",
                color: "#ffffff",
                borderRadius: 10,
                border: "1.5px solid #262626",
              }}
            >
              {s}s
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
