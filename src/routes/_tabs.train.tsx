import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, ListPlus, Flame, Trophy, Heart, Pencil, Shield, Lock } from "lucide-react";

import { VideoModal } from "@/components/VideoModal";
import { Reminders } from "@/components/Reminders";
import { DailyQuests } from "@/components/DailyQuests";
import { Big3Card } from "@/components/Big3Card";
import { WeeklyRecap } from "@/components/WeeklyRecap";
import { QuickLogFAB } from "@/components/QuickLogFAB";
import { RankedArena } from "@/components/RankedArena";
import { TodayReadiness } from "@/components/TodayReadiness";
import { useAppState } from "@/lib/storage";
import { EXERCISES, getExercise } from "@/lib/exercises";
import { calculateGritScore, calculateStreak, defaultSchedule, isoDay, todayKey } from "@/lib/calc";
import { ProBanner } from "@/components/ProBanner";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import type { DayKey, Schedule, Program, Exercise } from "@/lib/types";

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

const SIMPLE_FOCUS = [
  { key: "CHEST", label: "Chest", muscles: ["CHEST"] },
  { key: "BACK", label: "Back", muscles: ["BACK"] },
  { key: "LEGS", label: "Legs", muscles: ["LEGS"] },
  { key: "SHOULDERS", label: "Shoulders", muscles: ["SHOULDERS"] },
  { key: "ARMS", label: "Arms", muscles: ["ARMS"] },
  { key: "CORE", label: "Core", muscles: ["CORE"] },
  { key: "PUSH", label: "Push", muscles: ["CHEST", "SHOULDERS", "ARMS"] },
  { key: "PULL", label: "Pull", muscles: ["BACK", "ARMS"] },
  { key: "UPPER", label: "Upper", muscles: ["CHEST", "BACK", "SHOULDERS", "ARMS"] },
  { key: "LOWER", label: "Lower", muscles: ["LEGS", "CORE"] },
  { key: "FULL BODY", label: "Full body", muscles: ["CHEST", "BACK", "LEGS", "SHOULDERS", "CORE"] },
] as const;

type SimpleFocusKey = (typeof SIMPLE_FOCUS)[number]["key"];

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
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey());
  const [videoState, setVideoState] = useState<{
    videoId?: string;
    query?: string;
    title: string;
    clipStart?: number;
    clipEnd?: number;
    cue?: string;
  } | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editSearch, setEditSearch] = useState("");
  const [easyFocus, setEasyFocus] = useState<SimpleFocusKey[]>(["UPPER"]);
  const [easySets, setEasySets] = useState("3");
  const [easyReps, setEasyReps] = useState("8-12");

  const activeProgram: Program | undefined = state.programs.find(
    (p) => p.id === state.activeProgramId,
  );
  const schedule: Schedule =
    state.schedule ?? (state.profile ? defaultSchedule(state.profile) : ({} as Schedule));
  const day = schedule[selectedDay];
  const programDay = activeProgram?.days[selectedDay];
  const score = calculateGritScore(state);
  const streak = calculateStreak(state.completedDates);

  const { isPro, loading: proLoading } = usePro();
  const armorLocked = !proLoading && !isPro;
  const armorShields = Math.max(0, Math.min(3, state.streakArmor?.shields ?? 0));
  const armorSavedDate = (() => {
    const used = state.streakArmor?.usedDates;
    if (!used || used.length === 0) return null;
    for (const daysAgo of [1, 2]) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      if (used.includes(isoDay(d))) return d;
    }
    return null;
  })();

  useEffect(() => {
    if (!editMode) return;
    const current = schedule[selectedDay];
    setEasySets(String(current?.sets ?? 3));
    setEasyReps(current?.reps ?? "8-12");
    // Only resync when changing day/opening edit mode; syncing on every schedule write
    // would fight the mobile keyboard while the user is mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, selectedDay]);

  function toggleEasyFocus(key: SimpleFocusKey) {
    setEasyFocus((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function easyMuscles() {
    return Array.from(
      new Set(
        easyFocus.flatMap((key) => SIMPLE_FOCUS.find((focus) => focus.key === key)?.muscles ?? []),
      ),
    ) as Exercise["muscleGroup"][];
  }

  function buildEasyExercises() {
    const muscles = easyMuscles();
    const equipment = state.profile?.equipment ?? "FULL_GYM";
    const picked: string[] = [];
    for (const muscle of muscles) {
      const candidates = EXERCISES.filter(
        (exercise) =>
          exercise.muscleGroup === muscle &&
          (exercise.equipment.includes(equipment) || exercise.equipment.includes("BODYWEIGHT")),
      ).slice(0, muscles.length <= 2 ? 3 : 2);
      for (const exercise of candidates) {
        if (!picked.includes(exercise.id)) picked.push(exercise.id);
      }
    }
    return picked.slice(0, 6);
  }

  function applyEasyDay(rest = false) {
    const sets = Math.max(1, Math.min(12, Number(easySets) || day?.sets || 3));
    const reps = easyReps.trim() || "8-12";
    const muscles = easyMuscles();
    const label = rest
      ? "REST"
      : `${easyFocus.length === 1 ? easyFocus[0] : muscles.join(" / ")} — ${muscles.join(" / ")}`;
    set((s) => ({
      ...s,
      schedule: {
        ...(s.schedule || schedule),
        [selectedDay]: {
          label,
          exerciseIds: rest ? [] : buildEasyExercises(),
          sets,
          reps,
        },
      },
    }));
  }

  function updateDayTrainingDose(next: { sets?: number; reps?: string }) {
    set((s) => {
      const existingSchedule = s.schedule || schedule;
      const currentDay = existingSchedule[selectedDay] ||
        day || {
          label: "REST",
          exerciseIds: [],
        };
      return {
        ...s,
        schedule: {
          ...existingSchedule,
          [selectedDay]: {
            ...currentDay,
            ...next,
          },
        },
      };
    });
  }

  function handleEasySetsChange(rawValue: string) {
    const raw = rawValue.replace(/[^\d]/g, "").slice(0, 2);
    setEasySets(raw);
    if (!raw) return;
    updateDayTrainingDose({ sets: Math.max(1, Math.min(12, Number(raw))) });
  }

  function handleEasySetsBlur() {
    const clamped = Math.max(1, Math.min(12, Number(easySets) || day?.sets || 3));
    setEasySets(String(clamped));
    updateDayTrainingDose({ sets: clamped });
  }

  function handleEasyRepsChange(rawValue: string) {
    const next = rawValue.slice(0, 16);
    setEasyReps(next);
    updateDayTrainingDose({ reps: next.trim() || "8-12" });
  }

  // Seeds a sensible starter week from the profile so the user has something to edit,
  // then drops them straight into the manual builder.
  function startBuildingSplit() {
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
    const base = defaultSchedule(profile);
    const cleaned: Schedule = {} as Schedule;
    for (const k of DAY_KEYS) {
      const d = base[k];
      cleaned[k] = {
        label: d?.label || "REST",
        exerciseIds: (d?.exerciseIds || []).filter((id) => getExercise(id)),
      };
    }
    set((s) => ({ ...s, schedule: cleaned }));
    setEditMode(true);
  }

  function completeWorkout() {
    const day = isoDay();
    set((s) =>
      s.completedDates.includes(day) ? s : { ...s, completedDates: [...s.completedDates, day] },
    );
  }

  const selectedLabel = (activeProgram ? programDay?.label : day?.label) || "REST";
  const selectedHype = dayHype(selectedDay, selectedLabel, selectedDay === todayKey());

  return (
    <div className="deadset-page">
      <header className="deadset-section">
        <div className="deadset-hero-card p-5">
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-cap text-accent-red">{selectedHype.eyebrow}</p>
                <h1 className="display text-[2.45rem] font-black uppercase text-grit leading-[0.92] mt-2">
                  {selectedLabel}
                </h1>
                <p className="text-sm text-grit-dim mt-3 leading-relaxed max-w-[28rem]">
                  {selectedHype.line}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Link to="/profile" className="deadset-glass-strip rounded-2xl px-3 py-2 text-right">
                  <p className="label-cap text-[8px]">GRIT</p>
                  <p className="display text-2xl font-black text-grit leading-none">
                    {score.total}
                  </p>
                  <p className="text-[10px] text-grit-dim mt-1">{streak}d streak</p>
                </Link>
                {armorLocked ? (
                  <button
                    onClick={() => openPaywall("streak-armor")}
                    className="press relative flex items-center gap-1 pr-1"
                    aria-label="Unlock Streak Armor"
                  >
                    {[0, 1, 2].map((i) => (
                      <Shield key={i} size={14} className="text-grit-dim" />
                    ))}
                    <Lock size={10} className="absolute -top-1 -right-0.5 text-grit-dim" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    {isPro && <span className="label-cap text-[8px] text-grit-dim mr-0.5">ARMOR</span>}
                    {[0, 1, 2].map((i) => (
                      <Shield
                        key={i}
                        size={14}
                        className={i < armorShields ? "text-accent-red fill-current" : "text-grit-dim"}
                      />
                    ))}
                  </div>
                )}
                {armorSavedDate && (
                  <p className="text-[10px] text-grit-dim text-right leading-snug max-w-[10rem]">
                    Streak Armor saved your{" "}
                    {armorSavedDate.toLocaleDateString(undefined, { weekday: "short" })} —{" "}
                    {armorShields} left this month
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              {(() => {
                const today = todayKey();
                const programItems = activeProgram?.days[today]?.items.length || 0;
                const scheduleItems = schedule[today]?.exerciseIds?.length || 0;
                const todaysItems = programItems || scheduleItems;
                const hasSchedule = !!state.schedule || !!activeProgram;
                const canStart = todaysItems > 0;
                if (canStart) {
                  return (
                    <Link
                      to="/workout/live"
                      className="btn-grit flex-1 min-h-[54px] text-sm flex items-center justify-center rounded-2xl"
                    >
                      <Flame size={18} className="mr-2" /> Start Workout
                    </Link>
                  );
                }
                if (!hasSchedule) {
                  return (
                    <button
                      onClick={startBuildingSplit}
                      className="btn-grit flex-1 min-h-[54px] text-sm flex items-center justify-center rounded-2xl"
                    >
                      <Pencil size={18} className="mr-2" />
                      Build My Split
                    </button>
                  );
                }
                return (
                  <Link
                    to="/workout/live"
                    className="btn-ghost flex-1 min-h-[54px] text-sm flex items-center justify-center rounded-2xl"
                  >
                    Train Another Day
                  </Link>
                );
              })()}
              <button
                onClick={() => setEditMode((v) => !v)}
                className="btn-ghost min-h-[54px] px-4 rounded-2xl"
                style={{ color: editMode ? "#e63222" : "#f5f5f0" }}
              >
                {editMode ? "Done" : "Edit"}
              </button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {DAY_KEYS.map((k) => {
                const active = k === selectedDay;
                const isToday = k === todayKey();
                const lbl =
                  (activeProgram ? activeProgram.days[k].label : schedule[k]?.label)?.split(
                    " — ",
                  )[0] || "REST";
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedDay(k)}
                    className="flex-shrink-0 min-w-[74px] rounded-2xl px-3 py-2.5 border text-center press"
                    style={{
                      borderColor: active ? "#e63222" : "rgba(255,255,255,.10)",
                      background: active ? "rgba(230,50,34,.16)" : "rgba(0,0,0,.30)",
                    }}
                  >
                    <div
                      className="label-cap text-[9px]"
                      style={{ color: isToday ? "#e63222" : "#8a8a8a" }}
                    >
                      {DAY_SHORT[k]}
                    </div>
                    <div className="text-[11px] font-black uppercase mt-1 text-grit truncate">
                      {lbl}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>
      <TodayReadiness state={state} schedule={schedule} />
      <ProBanner />
      <Reminders />

      <div className="deadset-section">
        <div className="grid grid-cols-3 gap-2">
          <Link
            to="/programs"
            className="btn-ghost rounded-2xl py-3 flex items-center justify-center gap-2 text-xs"
          >
            <ListPlus size={14} /> Plan
          </Link>
          <Link
            to="/challenges"
            className="btn-ghost rounded-2xl py-3 flex items-center justify-center gap-2 text-xs"
          >
            <Trophy size={14} /> Arena
          </Link>
          <Link
            to="/recovery"
            className="btn-ghost rounded-2xl py-3 flex items-center justify-center gap-2 text-xs"
          >
            <Heart size={14} /> Recover
          </Link>
        </div>
      </div>

      <section className="deadset-section">
        <RankedArena state={state} compact />
      </section>
      <div className="deadset-section">
        <Big3Card state={state} />
      </div>
      <div className="deadset-section">
        <WeeklyRecap state={state} />
      </div>

      <DailyQuests />

      {activeProgram && (
        <div className="px-5 mb-3">
          <Link
            to="/programs/$programId"
            params={{ programId: activeProgram.id }}
            className="block bg-grit-card border border-accent-red px-3 py-2"
          >
            <p className="label-cap text-[9px] text-accent-red">ACTIVE PROGRAM</p>
            <p className="display uppercase font-extrabold text-grit text-sm truncate">
              {activeProgram.name}
            </p>
          </Link>
        </div>
      )}

      {/* Edit mode: assign muscle group + searchable exercise picker */}
      {editMode && (
        <div className="deadset-section">
          <div className="bg-grit-card border border-grit p-4">
            <div className="mb-5 rounded-[1.4rem] border border-accent-red/60 bg-black/30 p-4">
              <p className="label-cap text-accent-red text-[10px]">EASY SCHEDULE BUILDER</p>
              <h2 className="display text-2xl font-extrabold uppercase text-grit leading-none mt-1">
                {DAY_FULL[selectedDay]}
              </h2>
              <p className="text-xs text-grit-dim mt-2 leading-relaxed">
                Pick what you want to train, choose sets and reps, then DEADSET fills the day with
                exercises. Use the search below only if you want to fine-tune.
              </p>

              <p className="label-cap text-[10px] mt-4 mb-2">1. Muscles / split</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SIMPLE_FOCUS.map((focus) => {
                  const active = easyFocus.includes(focus.key);
                  return (
                    <button
                      key={focus.key}
                      onClick={() => toggleEasyFocus(focus.key)}
                      className="border px-3 py-3 text-left rounded-2xl press"
                      style={{
                        borderColor: active ? "#e63222" : "#262626",
                        background: active ? "rgba(230,50,34,.14)" : "#080808",
                      }}
                    >
                      <span
                        className="label-cap text-[10px]"
                        style={{ color: active ? "#e63222" : "#8a8a8a" }}
                      >
                        {focus.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="label-cap text-[10px] mt-4 mb-2">2. Sets and reps</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-cap text-[9px] block mb-1">Sets</label>
                  <input
                    value={easySets}
                    onChange={(e) => handleEasySetsChange(e.target.value)}
                    onBlur={handleEasySetsBlur}
                    onFocus={(e) => e.currentTarget.select()}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="input-grit"
                  />
                </div>
                <div>
                  <label className="label-cap text-[9px] block mb-1">Reps</label>
                  <input
                    value={easyReps}
                    onChange={(e) => handleEasyRepsChange(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder="8-12"
                    maxLength={16}
                    className="input-grit"
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2 mt-4">
                <button
                  onClick={() => applyEasyDay(false)}
                  disabled={easyFocus.length === 0}
                  className="btn-grit py-3 disabled:opacity-40 rounded-2xl"
                >
                  Build {DAY_SHORT[selectedDay]}
                </button>
                <button
                  onClick={() => applyEasyDay(true)}
                  className="btn-ghost py-3 px-4 rounded-2xl"
                >
                  Rest
                </button>
              </div>
            </div>

            <p className="label-cap mb-3">Advanced edit {DAY_SHORT[selectedDay]}</p>
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

            {/* Selected exercises — per-exercise allocation */}
            {(day?.exerciseIds?.length || 0) > 0 && (
              <>
                <p className="label-cap mb-2">
                  Selected ({day!.exerciseIds.length}) · sets × reps × kg
                </p>
                <div className="flex flex-col gap-2 mb-3">
                  {day!.exerciseIds.map((id) => {
                    const ex = getExercise(id);
                    if (!ex) return null;
                    const cfg = day?.exerciseConfig?.[id] ?? {};
                    const patchCfg = (patch: Partial<{ sets?: number; reps?: string; weightKg?: number }>) =>
                      set((s) => {
                        const sched = { ...(s.schedule || schedule) };
                        const cur = sched[selectedDay] || { label: day?.label || "REST", exerciseIds: [] };
                        sched[selectedDay] = {
                          ...cur,
                          exerciseConfig: {
                            ...(cur.exerciseConfig ?? {}),
                            [id]: { ...(cur.exerciseConfig?.[id] ?? {}), ...patch },
                          },
                        };
                        return { ...s, schedule: sched };
                      });
                    return (
                      <div key={id} className="border border-grit rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-grit uppercase tracking-wide truncate">
                            {ex.name}
                          </p>
                          <button
                            onClick={() =>
                              set((s) => {
                                const sched = { ...(s.schedule || schedule) };
                                const cur = sched[selectedDay]?.exerciseIds || [];
                                sched[selectedDay] = {
                                  ...(sched[selectedDay] || { label: day?.label || "REST" }),
                                  exerciseIds: cur.filter((x) => x !== id),
                                };
                                return { ...s, schedule: sched };
                              })
                            }
                            className="text-accent-red text-sm press px-1"
                            aria-label={`Remove ${ex.name}`}
                          >
                            ×
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                          <input
                            inputMode="numeric"
                            defaultValue={cfg.sets ?? ""}
                            onBlur={(e) => {
                              const n = parseInt(e.target.value, 10);
                              patchCfg({ sets: Number.isFinite(n) && n > 0 ? Math.min(12, n) : undefined });
                            }}
                            placeholder={`${day?.sets ?? ex.sets} sets`}
                            className="input-grit px-2 py-1.5 text-xs"
                            aria-label={`${ex.name} sets`}
                          />
                          <input
                            defaultValue={cfg.reps ?? ""}
                            maxLength={12}
                            onBlur={(e) => patchCfg({ reps: e.target.value.trim() || undefined })}
                            placeholder={`${day?.reps ?? ex.reps}`}
                            className="input-grit px-2 py-1.5 text-xs"
                            aria-label={`${ex.name} reps`}
                          />
                          <input
                            inputMode="decimal"
                            defaultValue={cfg.weightKg ?? ""}
                            onBlur={(e) => {
                              const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                              patchCfg({ weightKg: Number.isFinite(n) && n > 0 ? n : undefined });
                            }}
                            placeholder="kg"
                            className="input-grit px-2 py-1.5 text-xs"
                            aria-label={`${ex.name} working weight`}
                          />
                        </div>
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
                  return (
                    e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
                  );
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
                      className="p-3 border text-left flex items-center justify-between gap-2 rounded-2xl press"
                      style={{ borderColor: sel ? "#e63222" : "#262626", background: "#0a0a0a" }}
                    >
                      <div className="min-w-0">
                        <div
                          className="text-xs font-bold uppercase truncate"
                          style={{ color: sel ? "#e63222" : "#f5f5f0" }}
                        >
                          {e.name}
                        </div>
                        <div className="text-[9px] label-cap text-grit-dim mt-0.5">
                          {e.muscleGroup} · {e.skill}
                        </div>
                      </div>
                      <span
                        className="text-[10px] label-cap"
                        style={{ color: sel ? "#e63222" : "#8a8a8a" }}
                      >
                        {sel ? "ADDED" : "+ ADD"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exercises */}
      <div className="deadset-section flex flex-col gap-3">
        <div className="deadset-section-title">
          <div>
            <p className="label-cap text-accent-red text-[10px]">Workout plan</p>
            <h2 className="display text-2xl font-black uppercase text-grit leading-none">
              {selectedDay === todayKey() ? "Today" : DAY_FULL[selectedDay]}
            </h2>
          </div>
          <button
            onClick={() => setEditMode((v) => !v)}
            className="label-cap text-[10px]"
            style={{ color: editMode ? "#e63222" : "#8a8a8a" }}
          >
            {editMode ? "Done editing" : "Edit plan"}
          </button>
        </div>
        {activeProgram ? (
          <>
            {(programDay?.items.length || 0) === 0 && (
              <div className="bg-grit-card border border-grit p-8 text-center">
                <p className="display text-2xl uppercase text-grit font-extrabold">Rest Day</p>
                <p className="text-sm text-[#8a8a8a] mt-2 mb-4">Recover. Eat. Sleep.</p>
                <Link to="/workout/live" className="btn-ghost inline-block">
                  Train another day
                </Link>
              </div>
            )}
            {programDay?.items.map((it) => {
              const pr = bestSet(state.logs, it.id);
              return (
                <div key={it.id} className="bg-grit-card border border-grit overflow-hidden press">
                  <button
                    className="w-full p-3 text-left"
                    onClick={() =>
                      setVideoState({ query: it.youtube_query || it.name, title: it.name })
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="display uppercase font-extrabold text-grit text-lg leading-tight">
                        {it.name}
                      </div>
                      <Play size={18} className="text-accent-red flex-shrink-0" />
                    </div>
                    <div className="text-xs text-[#8a8a8a] mt-1">
                      {it.sets} × {it.reps}
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 border border-grit uppercase font-bold tracking-wider">
                        {it.equipment}
                      </span>
                      {it.primary_muscles.slice(0, 2).map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-2 py-0.5 border border-grit uppercase font-bold tracking-wider text-grit-dim"
                        >
                          {m}
                        </span>
                      ))}
                      {pr && (
                        <span className="text-[10px] px-2 py-0.5 bg-accent-red text-white uppercase font-bold tracking-wider">
                          PR {pr}KG
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
            {(programDay?.items.length || 0) > 0 && (
              <button onClick={completeWorkout} className="btn-grit mt-4 mb-2 rounded-2xl">
                {state.completedDates.includes(isoDay())
                  ? "Workout Complete ✓"
                  : "Complete Workout"}
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
                <div key={id} className="bg-grit-card border border-grit overflow-hidden press">
                  <button
                    className="w-full grid grid-cols-[96px_1fr] gap-0 text-left"
                    onClick={() =>
                      setVideoState({
                        videoId: ex.videoId,
                        title: ex.name,
                        clipStart: ex.clipStart,
                        clipEnd: ex.clipEnd,
                        cue: ex.instruction,
                      })
                    }
                  >
                    <div className="relative bg-black" style={{ aspectRatio: "1 / 1" }}>
                      <img
                        src={`https://img.youtube.com/vi/${ex.videoId}/mqdefault.jpg`}
                        alt={ex.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Play size={26} className="text-white" />
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="display uppercase font-extrabold text-grit text-lg leading-tight">
                        {ex.name}
                      </div>
                      <div className="text-xs text-[#8a8a8a] mt-1">
                        {day?.sets ?? ex.sets} × {day?.reps ?? ex.reps}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 border border-grit uppercase font-bold tracking-wider">
                          {ex.skill}
                        </span>
                        {pr && (
                          <span className="text-[10px] px-2 py-0.5 bg-accent-red text-white uppercase font-bold tracking-wider">
                            PR {pr}KG
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
            {(day?.exerciseIds?.length || 0) > 0 && (
              <button onClick={completeWorkout} className="btn-grit mt-4 mb-2 rounded-2xl">
                {state.completedDates.includes(isoDay())
                  ? "Workout Complete ✓"
                  : "Complete Workout"}
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

      <QuickLogFAB />
    </div>
  );
}

function bestSet(logs: { exerciseId: string; weight: number }[], id: string) {
  const f = logs.filter((l) => l.exerciseId === id);
  if (f.length === 0) return null;
  return Math.max(...f.map((l) => l.weight));
}
