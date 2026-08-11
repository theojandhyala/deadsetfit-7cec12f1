import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  CircleCheck,
  ChevronRight,
  Copy,
  Crown,
  Dumbbell,
  Lock,
  Plus,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { usePro } from "@/hooks/usePro";
import { askConfirm } from "@/lib/confirm";
import { defaultSchedule, todayKey, updateScheduleDay } from "@/lib/calc";
import { currentWeekStart, getWeeklyCompetitionStats } from "@/lib/competition";
import { allExercises, EXERCISES, getExercise } from "@/lib/exercises";
import { libraryExerciseToExercise } from "@/lib/exercise-library";
import { listExercises } from "@/lib/library.functions";
import { openPaywall } from "@/lib/paywall-events";
import { useAppState } from "@/lib/storage";
import type { DayKey, DaySchedule, Exercise, ExercisePlan, Schedule } from "@/lib/types";

export const Route = createFileRoute("/_tabs/plan")({
  head: () => ({ meta: [{ title: "DEADSET - Weekly Plan" }] }),
  component: PlanPage,
});

const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAMES: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

const PRESETS: {
  label: string;
  muscles: Exercise["muscleGroup"][];
  limit: number;
}[] = [
  { label: "Push", muscles: ["CHEST", "SHOULDERS", "ARMS"], limit: 5 },
  { label: "Pull", muscles: ["BACK", "ARMS"], limit: 5 },
  { label: "Legs", muscles: ["LEGS", "CORE"], limit: 5 },
  { label: "Upper", muscles: ["CHEST", "BACK", "SHOULDERS", "ARMS"], limit: 5 },
  { label: "Lower", muscles: ["LEGS", "CORE"], limit: 5 },
  { label: "Full body", muscles: ["LEGS", "CHEST", "BACK", "CORE"], limit: 5 },
];
const MUSCLE_FILTERS: Array<Exercise["muscleGroup"] | "ALL"> = [
  "ALL",
  "CHEST",
  "BACK",
  "LEGS",
  "SHOULDERS",
  "ARMS",
  "CORE",
];
const QUICK_REP_TARGETS = ["3-5", "6-8", "8-12", "10-15", "12-20", "AMRAP"] as const;

function blankSchedule(): Schedule {
  const schedule = {} as Schedule;
  for (const day of DAYS) schedule[day] = { label: "REST", exerciseIds: [] };
  return schedule;
}

function estimateMinutes(day?: DaySchedule, saved: Exercise[] = []) {
  if (!day?.exerciseIds.length) return 0;
  const sets = day.exerciseIds.reduce(
    (total, id) =>
      total + (day.exerciseConfig?.[id]?.sets ?? day.sets ?? getExercise(id, saved)?.sets ?? 3),
    0,
  );
  return Math.max(20, Math.round(sets * 2.2));
}

function shortLabel(label?: string) {
  return (label || "REST").split(" - ")[0].split(" — ")[0].trim();
}

function programMuscle(muscles: string[]): Exercise["muscleGroup"] {
  const value = muscles.join(" ").toUpperCase();
  if (/CHEST|PECTORAL/.test(value)) return "CHEST";
  if (/BACK|LAT|TRAP|RHOMBOID/.test(value)) return "BACK";
  if (/QUAD|HAMSTRING|GLUTE|CALF|LEG/.test(value)) return "LEGS";
  if (/SHOULDER|DELT/.test(value)) return "SHOULDERS";
  if (/BICEP|TRICEP|FOREARM|ARM/.test(value)) return "ARMS";
  return "CORE";
}

function PlanPage() {
  const [state, set] = useAppState();
  const { isPro, loading: proLoading } = usePro();
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey());
  const [editingDay, setEditingDay] = useState(false);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState<Exercise["muscleGroup"] | "ALL">("ALL");
  const [equipmentFilter, setEquipmentFilter] = useState("ALL");
  const [showCustom, setShowCustom] = useState(false);
  const [advancedExerciseId, setAdvancedExerciseId] = useState<string | null>(null);
  const [swapExerciseId, setSwapExerciseId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState<Exercise["muscleGroup"]>("CHEST");
  const [customEquipment, setCustomEquipment] = useState<"FULL_GYM" | "HOME_GYM" | "BODYWEIGHT">(
    "FULL_GYM",
  );

  const libraryQuery = useQuery({
    queryKey: ["plan-exercise-library"],
    queryFn: () => listExercises({ data: { limit: 2000 } }),
    staleTime: 30 * 60 * 1000,
  });
  const remoteExercises = useMemo(
    () => (libraryQuery.data?.exercises ?? []).map(libraryExerciseToExercise),
    [libraryQuery.data?.exercises],
  );
  const exercisePool = useMemo(() => {
    const byName = new Map<string, Exercise>();
    for (const exercise of [...remoteExercises, ...state.savedExercises, ...EXERCISES]) {
      byName.set(exercise.name.trim().toLowerCase(), exercise);
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [remoteExercises, state.savedExercises]);

  const schedule =
    state.schedule ?? (state.profile ? defaultSchedule(state.profile) : blankSchedule());
  const activeProgram = state.programs.find((program) => program.id === state.activeProgramId);
  const programExercises: Exercise[] = activeProgram
    ? DAYS.flatMap((dayKey) =>
        activeProgram.days[dayKey].items.map<Exercise>((item) => ({
          id: item.id,
          name: item.name,
          muscleGroup: programMuscle(item.primary_muscles),
          equipment: ["FULL_GYM"],
          equipmentLabel: item.equipment,
          skill: "INTERMEDIATE",
          sets: item.sets,
          reps: item.reps,
          videoId: "",
          youtubeQuery: item.youtube_query,
          instruction: `Perform ${item.name} with controlled technique.`,
        })),
      )
    : [];
  const savedAndProgramExercises = [...state.savedExercises, ...programExercises];
  const displaySchedule: Schedule = activeProgram
    ? DAYS.reduce((result, dayKey) => {
        const programDay = activeProgram.days[dayKey];
        result[dayKey] = {
          label: programDay?.label || "REST",
          exerciseIds: (programDay?.items ?? []).map((item) => item.id),
          exerciseConfig: Object.fromEntries(
            (programDay?.items ?? []).map((item) => [
              item.id,
              { sets: item.sets, reps: item.reps },
            ]),
          ),
        };
        return result;
      }, {} as Schedule)
    : schedule;
  const selected = schedule[selectedDay] ?? { label: "REST", exerciseIds: [] };
  const trainingDays = DAYS.filter((day) => displaySchedule[day]?.exerciseIds.length > 0).length;
  const weeklyMinutes = DAYS.reduce(
    (total, day) => total + estimateMinutes(displaySchedule[day], savedAndProgramExercises),
    0,
  );
  const weeklySets = DAYS.reduce(
    (total, day) =>
      total +
      (displaySchedule[day]?.exerciseIds ?? []).reduce(
        (sets, id) =>
          sets +
          (displaySchedule[day]?.exerciseConfig?.[id]?.sets ??
            displaySchedule[day]?.sets ??
            getExercise(id, savedAndProgramExercises)?.sets ??
            3),
        0,
      ),
    0,
  );
  const weeklyProgress = getWeeklyCompetitionStats(state);
  const completedDayKeys = new Set(
    state.sessions
      .filter((session) => session.endedAt && session.date >= currentWeekStart())
      .map((session) => session.dayKey),
  );

  const availableExercises = useMemo(() => {
    const query = search.trim().toLowerCase();
    const equipment = state.profile?.equipment;
    const swapTarget = swapExerciseId
      ? getExercise(swapExerciseId, state.savedExercises)
      : undefined;
    return exercisePool
      .filter((exercise) => {
        const equipmentMatch =
          !equipment ||
          exercise.equipment.includes(equipment) ||
          exercise.equipment.includes("BODYWEIGHT");
        const queryMatch =
          !query ||
          exercise.name.toLowerCase().includes(query) ||
          exercise.muscleGroup.toLowerCase().includes(query) ||
          exercise.equipmentLabel?.toLowerCase().includes(query) ||
          exercise.secondaryMuscles?.some((muscle) => muscle.toLowerCase().includes(query));
        const muscleMatch = muscleFilter === "ALL" || exercise.muscleGroup === muscleFilter;
        const specificEquipmentMatch =
          equipmentFilter === "ALL" ||
          exercise.equipmentLabel?.toUpperCase() === equipmentFilter ||
          exercise.equipment.includes(equipmentFilter as "FULL_GYM" | "HOME_GYM" | "BODYWEIGHT");
        const swapMatch =
          !swapTarget ||
          (exercise.id !== swapTarget.id &&
            !selected.exerciseIds.includes(exercise.id) &&
            exercise.muscleGroup === swapTarget.muscleGroup);
        return equipmentMatch && queryMatch && muscleMatch && specificEquipmentMatch && swapMatch;
      })
      .slice(0, query ? 300 : 160);
  }, [
    equipmentFilter,
    exercisePool,
    muscleFilter,
    search,
    selected.exerciseIds,
    state.profile?.equipment,
    state.savedExercises,
    swapExerciseId,
  ]);

  function saveSchedule(next: Schedule) {
    set((current) => ({ ...current, schedule: next }));
  }

  function scrollToBuilder(id: "exercise-picker" | "day-movements") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function beginDayEdit(dayKey: DayKey) {
    setSelectedDay(dayKey);
    setEditingDay(true);
    setShowCopy(false);
    setShowPicker(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById("day-editor")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function finishDayEdit() {
    setEditingDay(false);
    setShowCopy(false);
    setShowPicker(false);
    requestAnimationFrame(() => {
      document.getElementById("week-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openExercisePicker() {
    setSwapExerciseId(null);
    setShowPicker(true);
    scrollToBuilder("exercise-picker");
  }

  function closeExercisePicker() {
    setShowPicker(false);
    setSwapExerciseId(null);
    scrollToBuilder("day-movements");
  }

  function openSmartSwap(exerciseId: string) {
    if (!isPro) {
      openPaywall("smart-swaps");
      return;
    }
    const exercise = getExercise(exerciseId, state.savedExercises);
    setSwapExerciseId(exerciseId);
    setSearch("");
    setEquipmentFilter("ALL");
    setMuscleFilter(exercise?.muscleGroup ?? "ALL");
    setShowPicker(true);
    scrollToBuilder("exercise-picker");
  }

  function updateSelected(updater: (day: DaySchedule) => DaySchedule) {
    set((current) => {
      const currentSchedule =
        current.schedule ?? (current.profile ? defaultSchedule(current.profile) : blankSchedule());
      return {
        ...current,
        schedule: updateScheduleDay(currentSchedule, selectedDay, updater),
      };
    });
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const equipment = state.profile?.equipment;
    const localExercises = allExercises(state.savedExercises);
    const exerciseIds: string[] = [];
    for (const muscle of preset.muscles) {
      const match = localExercises.find(
        (exercise) =>
          exercise.muscleGroup === muscle &&
          (!equipment ||
            exercise.equipment.includes(equipment) ||
            exercise.equipment.includes("BODYWEIGHT")) &&
          !exerciseIds.includes(exercise.id),
      );
      if (match) exerciseIds.push(match.id);
    }
    for (const exercise of localExercises) {
      if (exerciseIds.length >= preset.limit) break;
      if (
        preset.muscles.includes(exercise.muscleGroup) &&
        !exerciseIds.includes(exercise.id) &&
        (!equipment ||
          exercise.equipment.includes(equipment) ||
          exercise.equipment.includes("BODYWEIGHT"))
      ) {
        exerciseIds.push(exercise.id);
      }
    }
    updateSelected(() => ({
      label: preset.label.toUpperCase(),
      exerciseIds,
      sets: 3,
      reps: "8-12",
    }));
    toast.success(`${DAY_NAMES[selectedDay]} set to ${preset.label}`);
  }

  function setRestDay() {
    updateSelected(() => ({ label: "REST", exerciseIds: [] }));
    setShowPicker(false);
    toast.success(`${DAY_NAMES[selectedDay]} is now a rest day`);
  }

  function toggleExercise(exercise: Exercise) {
    if (!EXERCISES.some((builtIn) => builtIn.id === exercise.id)) {
      set((current) =>
        current.savedExercises.some((saved) => saved.id === exercise.id)
          ? current
          : { ...current, savedExercises: [...current.savedExercises, exercise] },
      );
    }
    updateSelected((day) => {
      const removing = day.exerciseIds.includes(exercise.id);
      const exerciseIds = removing
        ? day.exerciseIds.filter((id) => id !== exercise.id)
        : [...day.exerciseIds, exercise.id];
      const exerciseConfig = { ...(day.exerciseConfig ?? {}) };
      if (removing) delete exerciseConfig[exercise.id];
      return {
        ...day,
        label: exerciseIds.length
          ? day.label === "REST"
            ? exercise.muscleGroup
            : day.label
          : "REST",
        exerciseIds,
        exerciseConfig: Object.keys(exerciseConfig).length ? exerciseConfig : undefined,
      };
    });
  }

  function replaceExercise(replacement: Exercise) {
    if (!swapExerciseId) return;
    const original = getExercise(swapExerciseId, state.savedExercises);
    if (!EXERCISES.some((builtIn) => builtIn.id === replacement.id)) {
      set((current) =>
        current.savedExercises.some((saved) => saved.id === replacement.id)
          ? current
          : { ...current, savedExercises: [...current.savedExercises, replacement] },
      );
    }
    updateSelected((day) => {
      const exerciseIds = day.exerciseIds.map((id) =>
        id === swapExerciseId ? replacement.id : id,
      );
      const exerciseConfig = { ...(day.exerciseConfig ?? {}) };
      const originalConfig = exerciseConfig[swapExerciseId];
      delete exerciseConfig[swapExerciseId];
      if (originalConfig) exerciseConfig[replacement.id] = originalConfig;
      return {
        ...day,
        exerciseIds,
        exerciseConfig: Object.keys(exerciseConfig).length ? exerciseConfig : undefined,
      };
    });
    setShowPicker(false);
    setSwapExerciseId(null);
    scrollToBuilder("day-movements");
    toast.success(`${original?.name ?? "Exercise"} swapped for ${replacement.name}`);
  }

  function createCustomExercise() {
    const name = customName.trim().slice(0, 60);
    if (name.length < 2) {
      toast.error("Enter an exercise name");
      return;
    }
    const exercise: Exercise = {
      id: `custom-${crypto.randomUUID()}`,
      name,
      muscleGroup: customMuscle,
      equipment: [customEquipment],
      equipmentLabel: customEquipment.replace("_", " "),
      skill: "INTERMEDIATE",
      sets: 3,
      reps: "8-12",
      videoId: "",
      youtubeQuery: `${name} exercise form`,
      instruction: `Perform ${name} with controlled technique and a full comfortable range of motion.`,
      isCustom: true,
    };
    set((current) => {
      const currentSchedule =
        current.schedule ?? (current.profile ? defaultSchedule(current.profile) : blankSchedule());
      const currentDay = currentSchedule[selectedDay];
      return {
        ...current,
        savedExercises: [...current.savedExercises, exercise],
        schedule: {
          ...currentSchedule,
          [selectedDay]: {
            ...currentDay,
            label: currentDay.label === "REST" ? customMuscle : currentDay.label,
            exerciseIds: [...currentDay.exerciseIds, exercise.id],
          },
        },
      };
    });
    setCustomName("");
    setShowCustom(false);
    toast.success(`${name} added to ${DAY_NAMES[selectedDay]}`);
  }

  function setWorkoutSize(size: 3 | 4 | 5 | 6 | 7 | 8) {
    const equipment = state.profile?.equipment;
    const nextSchedule = { ...schedule };
    for (const dayKey of DAYS) {
      const day = schedule[dayKey];
      if (!day.exerciseIds.length) continue;
      const exerciseIds = [...day.exerciseIds];
      if (exerciseIds.length > size) exerciseIds.length = size;
      if (exerciseIds.length < size) {
        const label = day.label.toUpperCase();
        const preferredMuscles = PRESETS.find((preset) =>
          label.includes(preset.label.toUpperCase()),
        )?.muscles;
        const candidates = allExercises(state.savedExercises).filter(
          (candidate) =>
            !exerciseIds.includes(candidate.id) &&
            (!equipment ||
              candidate.equipment.includes(equipment) ||
              candidate.equipment.includes("BODYWEIGHT")) &&
            (!preferredMuscles || preferredMuscles.includes(candidate.muscleGroup)),
        );
        for (const candidate of candidates) {
          if (exerciseIds.length >= size) break;
          exerciseIds.push(candidate.id);
        }
      }
      const exerciseConfig = day.exerciseConfig
        ? Object.fromEntries(
            Object.entries(day.exerciseConfig).filter(([exerciseId]) =>
              exerciseIds.includes(exerciseId),
            ),
          )
        : undefined;
      nextSchedule[dayKey] = {
        ...day,
        exerciseIds,
        exerciseConfig:
          exerciseConfig && Object.keys(exerciseConfig).length ? exerciseConfig : undefined,
      };
    }
    set((current) => ({
      ...current,
      profile: current.profile
        ? { ...current.profile, exercisesPerSession: size }
        : current.profile,
      schedule: nextSchedule,
    }));
    toast.success(`Workouts set to ${size} exercises`);
  }

  function moveExercise(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selected.exerciseIds.length) return;
    const exerciseIds = [...selected.exerciseIds];
    [exerciseIds[index], exerciseIds[target]] = [exerciseIds[target], exerciseIds[index]];
    updateSelected((day) => ({ ...day, exerciseIds }));
  }

  function updateExercise(exerciseId: string, patch: Partial<ExercisePlan>) {
    updateSelected((day) => ({
      ...day,
      exerciseConfig: {
        ...(day.exerciseConfig ?? {}),
        [exerciseId]: { ...(day.exerciseConfig?.[exerciseId] ?? {}), ...patch },
      },
    }));
  }

  function copyTo(target: DayKey) {
    saveSchedule({
      ...schedule,
      [target]: {
        ...selected,
        exerciseIds: [...selected.exerciseIds],
        exerciseConfig: selected.exerciseConfig
          ? Object.fromEntries(
              Object.entries(selected.exerciseConfig).map(([id, config]) => [id, { ...config }]),
            )
          : undefined,
      },
    });
    setShowCopy(false);
    toast.success(`Copied to ${DAY_NAMES[target]}`);
  }

  async function rebalanceWeek() {
    if (!isPro) {
      openPaywall("plan-audit");
      return;
    }
    if (!state.profile) return;
    const confirmed = await askConfirm({
      title: "Rebalance your week?",
      message:
        "DEADSET will rebuild the week around your training days, equipment and session length. Your current weekly schedule will be replaced.",
      confirmLabel: "Rebalance",
    });
    if (!confirmed) return;
    saveSchedule(defaultSchedule(state.profile));
    setSelectedDay(todayKey());
    toast.success("Your week has been rebalanced");
  }

  return (
    <div className="deadset-page pb-6">
      <header className="deadset-section">
        <div className="deadset-panel p-5 sm:p-6">
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Link
                  to="/train"
                  aria-label="Back to training"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/10 bg-black/30 text-grit-dim press"
                >
                  <ArrowLeft size={18} />
                </Link>
                <div className="min-w-0">
                  <p className="deadset-kicker">Week command</p>
                  <h1 className="display mt-2 text-4xl font-black uppercase leading-[0.9] text-grit sm:text-5xl">
                    Your Plan
                  </h1>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-grit-dim">
                    Build the week. Set the order. Know exactly what happens every day.
                  </p>
                </div>
              </div>
              <div className="hidden shrink-0 border-l border-white/10 pl-4 text-right sm:block">
                <p className="display text-3xl font-black leading-none text-accent-red">
                  {weeklyProgress.score}
                </p>
                <p className="mt-1 text-[9px] font-black uppercase text-grit-dim">Weekly score</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 border-y border-white/10 bg-black/25">
              <WeekStat label="Training" value={`${trainingDays} days`} />
              <WeekStat label="Volume" value={`${weeklySets} sets`} />
              {/* Compact unit — "~78 min" truncated to "~78 M…" on 390px phones */}
              <WeekStat label="Duration" value={`~${weeklyMinutes}m`} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-grit-dim">
              <span className="flex min-w-0 items-center gap-2">
                <CalendarDays size={14} className="shrink-0 text-accent-red" />
                <span className="truncate">
                  {weeklyProgress.days}/{trainingDays || 0} sessions finished this week
                </span>
              </span>
              <span className="shrink-0 font-black uppercase text-grit">
                {completedDayKeys.size ? "In progress" : "Ready"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {activeProgram ? (
        <section className="deadset-section">
          <div className="border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="label-cap text-[10px] text-amber-300">Currently running</p>
            <h2 className="display mt-1 text-xl font-black uppercase text-grit">
              {activeProgram.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-grit-dim">
              This program controls your workouts. The week below now shows exactly what it has
              planned for each day.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                to="/programs/$programId"
                params={{ programId: activeProgram.id }}
                className="btn-grit flex min-h-12 items-center justify-center"
              >
                Edit active program
              </Link>
              <button
                onClick={() => {
                  set((current) => ({ ...current, activeProgramId: null }));
                  toast.success("Your weekly plan is now active");
                }}
                className="btn-ghost min-h-12"
              >
                Use weekly plan
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="deadset-section">
          <div className="deadset-toolbar px-3">
            <span className="mr-3 grid h-7 w-7 place-items-center rounded bg-emerald-400/10 text-emerald-400">
              <Check size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-grit">Weekly plan is active</p>
              <p className="mt-0.5 truncate text-[10px] text-grit-dim">
                Training and live workouts follow this schedule.
              </p>
            </div>
            <span className="h-2 w-2 bg-emerald-400" />
          </div>
        </section>
      )}

      {!activeProgram && (
        <section className="deadset-section">
          <div className="deadset-panel-muted flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="deadset-kicker">Session build</p>
              <h2 className="display mt-2 text-xl font-black uppercase text-grit">
                Movements per workout
              </h2>
              <p className="mt-1 text-xs text-grit-dim">
                Set the default. Fine-tune each day below.
              </p>
            </div>
            <div className="flex shrink-0 items-center rounded-md border border-white/12 bg-black">
              <button
                onClick={() =>
                  setWorkoutSize(
                    Math.max(3, (state.profile?.exercisesPerSession ?? 5) - 1) as
                      | 3
                      | 4
                      | 5
                      | 6
                      | 7
                      | 8,
                  )
                }
                disabled={(state.profile?.exercisesPerSession ?? 5) <= 3}
                aria-label="Use fewer exercises per workout"
                className="grid h-11 w-10 place-items-center text-xl font-bold text-grit-dim disabled:opacity-30"
              >
                -
              </button>
              <span className="display grid h-11 w-11 place-items-center border-x border-white/10 text-xl font-black text-grit">
                {state.profile?.exercisesPerSession ?? 5}
              </span>
              <button
                onClick={() =>
                  setWorkoutSize(
                    Math.min(8, (state.profile?.exercisesPerSession ?? 5) + 1) as
                      | 3
                      | 4
                      | 5
                      | 6
                      | 7
                      | 8,
                  )
                }
                disabled={(state.profile?.exercisesPerSession ?? 5) >= 8}
                aria-label="Use more exercises per workout"
                className="grid h-11 w-10 place-items-center text-xl font-bold text-grit-dim disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        </section>
      )}

      <section id="week-map" className="deadset-section scroll-mt-4">
        <div className="deadset-section-title">
          <div>
            <p className="deadset-kicker">Seven-day map</p>
            <h2 className="display mt-2 text-2xl font-black uppercase text-grit">
              {activeProgram ? "Current week" : "Your week"}
            </h2>
            <p className="mt-1 text-xs text-grit-dim">
              Open a day to see the full session and targets.
            </p>
          </div>
          {activeProgram ? (
            <Link
              to="/programs/$programId"
              params={{ programId: activeProgram.id }}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-grit-dim"
            >
              Edit program
              <ChevronRight size={13} />
            </Link>
          ) : (
            <button
              onClick={() => void rebalanceWeek()}
              disabled={proLoading}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-grit-dim disabled:opacity-50"
            >
              {!isPro ? <Lock size={12} /> : <Sparkles size={12} className="text-amber-300" />}
              Rebalance
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e10] shadow-[0_18px_46px_rgba(0,0,0,.3)]">
          {DAYS.map((dayKey) => {
            const day = displaySchedule[dayKey];
            const active = dayKey === selectedDay;
            const today = dayKey === todayKey();
            const isRest = !day?.exerciseIds.length;
            const exerciseNames = (day?.exerciseIds ?? [])
              .map((id) => getExercise(id, savedAndProgramExercises)?.name)
              .filter(Boolean);
            const completed = completedDayKeys.has(dayKey);
            return (
              <div
                key={dayKey}
                className="border-b border-white/10 last:border-b-0"
                style={{
                  background: active
                    ? "linear-gradient(90deg, rgba(230,50,34,.12), rgba(23,24,27,.98) 46%)"
                    : "#111214",
                  boxShadow: active ? "inset 3px 0 0 #e63222" : undefined,
                }}
              >
                <button
                  onClick={() => {
                    setSelectedDay(dayKey);
                    setEditingDay(false);
                    setShowCopy(false);
                    setShowPicker(false);
                  }}
                  className="flex min-h-[78px] w-full items-center gap-3 px-3 py-3 text-left press sm:px-4"
                  aria-expanded={active}
                  aria-label={`${DAY_NAMES[dayKey]}: ${shortLabel(day?.label)}`}
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-md border text-[10px] font-black uppercase"
                    style={{
                      borderColor: today ? "#e63222" : "rgba(255,255,255,.11)",
                      color: today ? "#e63222" : "#8a8a8a",
                      background: today ? "rgba(230,50,34,.1)" : "rgba(0,0,0,.3)",
                    }}
                  >
                    {completed ? <CircleCheck size={18} className="text-emerald-400" /> : dayKey}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-grit-dim">
                        {DAY_NAMES[dayKey]}
                      </span>
                      {today && (
                        <span className="rounded-sm bg-accent-red px-1.5 py-0.5 text-[8px] font-black uppercase text-white">
                          Today
                        </span>
                      )}
                      {completed && (
                        <span className="text-[8px] font-black uppercase text-emerald-400">
                          Complete
                        </span>
                      )}
                    </span>
                    <span className="display mt-0.5 block truncate text-base font-black uppercase text-grit">
                      {shortLabel(day?.label)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-grit-dim">
                      {isRest ? "Recovery day" : exerciseNames.join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-grit-dim">
                    {!isRest && `${day.exerciseIds.length}`}
                    <ChevronRight
                      size={16}
                      className={`transition-transform ${active ? "rotate-90" : ""}`}
                    />
                  </span>
                </button>

                {active && !isRest && (
                  <div className="border-t border-white/10 bg-black/20 px-3 pb-4 pt-3 sm:px-4">
                    <div className="space-y-2">
                      {day.exerciseIds.map((exerciseId, index) => {
                        const exercise = getExercise(exerciseId, savedAndProgramExercises);
                        if (!exercise) return null;
                        const config = day.exerciseConfig?.[exerciseId];
                        const sets = config?.sets ?? day.sets ?? exercise.sets;
                        const reps = config?.reps ?? day.reps ?? exercise.reps;
                        return (
                          <div
                            key={exerciseId}
                            className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] text-xs last:border-0"
                          >
                            <span className="deadset-index h-6 w-6 text-[10px]">{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-semibold text-grit">
                              {exercise.name}
                            </span>
                            <span className="shrink-0 font-bold text-grit-dim">
                              {sets} x {reps}
                              {config?.weightKg ? ` @ ${config.weightKg}kg` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link
                        to="/workout/live"
                        search={{
                          day: dayKey,
                          source: activeProgram ? "program" : "schedule",
                        }}
                        className="btn-grit flex min-h-11 items-center justify-center gap-2 text-xs"
                      >
                        <Play size={14} />
                        Start workout
                      </Link>
                      {activeProgram ? (
                        <Link
                          to="/programs/$programId"
                          params={{ programId: activeProgram.id }}
                          className="btn-ghost flex min-h-11 items-center justify-center text-xs"
                        >
                          Edit program
                        </Link>
                      ) : (
                        <button
                          onClick={() => beginDayEdit(dayKey)}
                          className="btn-ghost min-h-11 text-xs"
                        >
                          Edit exercises
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {active && isRest && !activeProgram && (
                  <div className="border-t border-white/10 bg-black/20 px-3 py-4 sm:px-4">
                    <p className="text-xs leading-relaxed text-grit-dim">
                      No workout is scheduled. Keep it as recovery or build a session for this day.
                    </p>
                    <button
                      onClick={() => beginDayEdit(dayKey)}
                      className="btn-ghost mt-3 min-h-11 w-full text-xs"
                    >
                      <Plus size={14} className="mr-2 inline" />
                      Plan this day
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {!activeProgram && editingDay && (
        <section id="day-editor" className="deadset-section scroll-mt-4">
          <div className="deadset-panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="deadset-kicker">Editing {DAY_NAMES[selectedDay]}</p>
                <input
                  key={`label-${selectedDay}`}
                  defaultValue={selected.label}
                  onBlur={(event) => {
                    const label = event.target.value.trim().toUpperCase() || "TRAINING";
                    event.target.value = label;
                    updateSelected((day) => ({ ...day, label }));
                  }}
                  aria-label={`${DAY_NAMES[selectedDay]} workout name`}
                  className="display mt-2 w-full border-0 bg-transparent p-0 text-3xl font-black uppercase leading-none text-grit outline-none"
                />
                <p className="mt-1 text-xs text-grit-dim">
                  {selected.exerciseIds.length
                    ? `${selected.exerciseIds.length} exercises - about ${estimateMinutes(selected, state.savedExercises)} min`
                    : "Recovery day - no workout scheduled"}
                </p>
              </div>
              <button
                onClick={() => setShowCopy((current) => !current)}
                disabled={!selected.exerciseIds.length}
                aria-label="Copy this day"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/10 bg-black/25 text-grit-dim disabled:opacity-30"
              >
                <Copy size={16} />
              </button>
            </div>

            {showCopy && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="label-cap mb-2 text-[9px] text-grit-dim">Copy this workout to</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {DAYS.filter((day) => day !== selectedDay).map((day) => (
                    <button
                      key={day}
                      onClick={() => copyTo(day)}
                      className="btn-ghost min-h-11 px-2 text-[10px]"
                    >
                      {DAY_NAMES[day].slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="deadset-kicker">Starting targets</p>
                  <p className="mt-1 text-xs leading-relaxed text-grit-dim">
                    Every movement starts here unless you override it.
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-accent-red/30 bg-accent-red/10 px-2 py-1 text-[9px] font-black uppercase text-accent-red">
                  {selected.sets ?? 3} x {selected.reps ?? "8-12"}
                </span>
              </div>

              <div className="mt-3">
                <p className="mb-2 text-[9px] font-black uppercase text-grit-dim">Sets</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {[2, 3, 4, 5, 6, 7].map((sets) => (
                    <button
                      key={sets}
                      onClick={() => updateSelected((day) => ({ ...day, sets }))}
                      aria-pressed={(selected.sets ?? 3) === sets}
                      className={`grid min-h-11 place-items-center rounded-md border text-sm font-black ${
                        (selected.sets ?? 3) === sets
                          ? "border-accent-red bg-accent-red/10 text-accent-red"
                          : "border-white/10 bg-black/30 text-grit-dim"
                      }`}
                    >
                      {sets}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-2 text-[9px] font-black uppercase text-grit-dim">Reps</p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {QUICK_REP_TARGETS.map((reps) => (
                    <button
                      key={reps}
                      onClick={() => updateSelected((day) => ({ ...day, reps }))}
                      aria-pressed={(selected.reps ?? "8-12") === reps}
                      className={`min-h-11 rounded-md border px-1 text-[10px] font-black ${
                        (selected.reps ?? "8-12") === reps
                          ? "border-accent-red bg-accent-red/10 text-accent-red"
                          : "border-white/10 bg-black/30 text-grit-dim"
                      }`}
                    >
                      {reps}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 max-w-[12rem]">
                <PlanInput
                  key={`day-reps-${selectedDay}-${selected.reps ?? "8-12"}`}
                  label="Custom rep target"
                  ariaLabel={`${DAY_NAMES[selectedDay]} custom rep target`}
                  defaultValue={selected.reps ?? "8-12"}
                  placeholder="e.g. 6-10"
                  onCommit={(value) => {
                    const reps = value.trim().slice(0, 12) || "8-12";
                    updateSelected((day) => ({ ...day, reps }));
                    return reps;
                  }}
                />
              </div>
            </div>

            <div className="mt-5">
              <p className="label-cap mb-2 text-[9px] text-grit-dim">Quick setup</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className="shrink-0 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-grit press"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={setRestDay}
                  className="shrink-0 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-grit-dim press"
                >
                  Rest day
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {!activeProgram && editingDay && (
        <section id="day-movements" className="deadset-section scroll-mt-4">
          <div className="deadset-section-title">
            <div>
              <p className="deadset-kicker">Workout order</p>
              <h2 className="display mt-2 text-2xl font-black uppercase text-grit">Movements</h2>
            </div>
            <button
              onClick={() => (showPicker ? closeExercisePicker() : openExercisePicker())}
              aria-expanded={showPicker}
              className="btn-ghost flex min-h-11 items-center gap-1.5 px-3 text-[10px]"
            >
              {showPicker ? <X size={14} /> : <Plus size={14} />}
              {showPicker ? "Close" : "Add"}
            </button>
          </div>

          {!selected.exerciseIds.length ? (
            <div className="deadset-panel-muted border-dashed px-5 py-8 text-center">
              <CalendarDays size={24} className="mx-auto text-grit-dim" />
              <h3 className="display mt-3 text-xl font-black uppercase text-grit">
                Nothing planned
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-grit-dim">
                Choose a quick setup above or add the exact exercises you want.
              </p>
              <button onClick={openExercisePicker} className="btn-grit mt-4 min-h-12 px-5">
                Add exercises
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selected.exerciseIds.map((exerciseId, index) => {
                const exercise = getExercise(exerciseId, state.savedExercises);
                if (!exercise) return null;
                const config = selected.exerciseConfig?.[exerciseId] ?? {};
                return (
                  <div key={`${selectedDay}-${exerciseId}`} className="deadset-panel-muted p-3">
                    <div className="flex items-center gap-3">
                      <span className="deadset-index">{index + 1}</span>
                      <div className="flex shrink-0 flex-col">
                        <button
                          onClick={() => moveExercise(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${exercise.name} up`}
                          className="p-1 text-grit-dim disabled:opacity-20"
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          onClick={() => moveExercise(index, 1)}
                          disabled={index === selected.exerciseIds.length - 1}
                          aria-label={`Move ${exercise.name} down`}
                          className="p-1 text-grit-dim disabled:opacity-20"
                        >
                          <ArrowDown size={15} />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-grit">{exercise.name}</p>
                        <p className="mt-0.5 text-[10px] uppercase text-grit-dim">
                          {exercise.muscleGroup} - {exercise.skill.toLowerCase()}
                        </p>
                      </div>
                      <button
                        onClick={() => openSmartSwap(exerciseId)}
                        aria-label={`Find a smart swap for ${exercise.name}`}
                        className="grid h-11 w-11 shrink-0 place-items-center text-grit-dim press"
                      >
                        {isPro ? <RefreshCw size={15} /> : <Lock size={13} />}
                      </button>
                      <button
                        onClick={() => toggleExercise(exercise)}
                        aria-label={`Remove ${exercise.name}`}
                        className="grid h-11 w-11 shrink-0 place-items-center text-grit-dim press"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <PlanInput
                        key={`sets-${selectedDay}-${exerciseId}`}
                        label="Sets"
                        ariaLabel={`${exercise.name} sets`}
                        defaultValue={String(config.sets ?? selected.sets ?? exercise.sets)}
                        inputMode="numeric"
                        onCommit={(value) => {
                          const sets = Math.max(1, Math.min(12, Number(value) || exercise.sets));
                          updateExercise(exerciseId, { sets });
                          return String(sets);
                        }}
                      />
                      <PlanInput
                        key={`reps-${selectedDay}-${exerciseId}`}
                        label="Reps"
                        ariaLabel={`${exercise.name} reps`}
                        defaultValue={config.reps ?? selected.reps ?? exercise.reps}
                        onCommit={(value) => {
                          const reps = value.trim().slice(0, 12) || exercise.reps;
                          updateExercise(exerciseId, { reps });
                          return reps;
                        }}
                      />
                      <PlanInput
                        key={`weight-${selectedDay}-${exerciseId}`}
                        label="Weight kg"
                        ariaLabel={`${exercise.name} working weight in kilograms`}
                        defaultValue={config.weightKg ? String(config.weightKg) : ""}
                        placeholder="Optional"
                        inputMode="decimal"
                        onCommit={(value) => {
                          const weightKg = Number(value.replace(/[^0-9.]/g, ""));
                          updateExercise(exerciseId, {
                            weightKg:
                              Number.isFinite(weightKg) && weightKg > 0 ? weightKg : undefined,
                          });
                          return Number.isFinite(weightKg) && weightKg > 0 ? String(weightKg) : "";
                        }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (!isPro) {
                          openPaywall("advanced-programming");
                          return;
                        }
                        setAdvancedExerciseId((current) =>
                          current === exerciseId ? null : exerciseId,
                        );
                      }}
                      aria-expanded={advancedExerciseId === exerciseId}
                      className="mt-3 flex min-h-11 w-full items-center justify-between rounded-md border border-white/10 bg-black/25 px-3 text-left"
                    >
                      <span className="flex items-center gap-2 text-[10px] font-black uppercase text-grit">
                        {isPro ? (
                          <Settings2 size={14} className="text-amber-300" />
                        ) : (
                          <Lock size={13} className="text-amber-300" />
                        )}
                        Advanced programming
                      </span>
                      <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-grit-dim">
                        <Timer size={12} />
                        {config.restSeconds ?? state.restTimerSeconds ?? 90}s
                      </span>
                    </button>

                    {isPro && advancedExerciseId === exerciseId && (
                      <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[9px] font-bold uppercase text-grit-dim">
                              Progression
                            </span>
                            <select
                              value={config.progression ?? "HOLD"}
                              onChange={(event) =>
                                updateExercise(exerciseId, {
                                  progression: event.target.value as ExercisePlan["progression"],
                                })
                              }
                              aria-label={`${exercise.name} progression method`}
                              className="input-grit min-h-11 px-2 text-xs"
                            >
                              <option value="DOUBLE">Double progression</option>
                              <option value="LINEAR">Linear load</option>
                              <option value="HOLD">Manual / hold</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[9px] font-bold uppercase text-grit-dim">
                              Rest timer
                            </span>
                            <select
                              value={config.restSeconds ?? state.restTimerSeconds ?? 90}
                              onChange={(event) =>
                                updateExercise(exerciseId, {
                                  restSeconds: Number(event.target.value),
                                })
                              }
                              aria-label={`${exercise.name} rest timer`}
                              className="input-grit min-h-11 px-2 text-xs"
                            >
                              {[30, 45, 60, 90, 120, 150, 180, 240, 300].map((seconds) => (
                                <option key={seconds} value={seconds}>
                                  {seconds < 60
                                    ? `${seconds} sec`
                                    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(
                                        2,
                                        "0",
                                      )}`}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[9px] font-bold uppercase text-grit-dim">
                              Target RIR
                            </span>
                            <select
                              value={config.targetRir ?? 2}
                              onChange={(event) =>
                                updateExercise(exerciseId, {
                                  targetRir: Number(event.target.value),
                                })
                              }
                              aria-label={`${exercise.name} target reps in reserve`}
                              className="input-grit min-h-11 px-2 text-xs"
                            >
                              {[0, 1, 2, 3, 4, 5].map((rir) => (
                                <option key={rir} value={rir}>
                                  {rir} RIR
                                </option>
                              ))}
                            </select>
                          </label>
                          <PlanInput
                            key={`tempo-${selectedDay}-${exerciseId}`}
                            label="Tempo"
                            ariaLabel={`${exercise.name} lifting tempo`}
                            defaultValue={config.tempo ?? ""}
                            placeholder="e.g. 3-1-1"
                            onCommit={(value) => {
                              const tempo = value.trim().slice(0, 12);
                              updateExercise(exerciseId, { tempo: tempo || undefined });
                              return tempo;
                            }}
                          />
                        </div>
                        <label className="mt-3 block">
                          <span className="mb-1 block text-[9px] font-bold uppercase text-grit-dim">
                            Private workout cue
                          </span>
                          <textarea
                            key={`note-${selectedDay}-${exerciseId}`}
                            defaultValue={config.note ?? ""}
                            onBlur={(event) =>
                              updateExercise(exerciseId, {
                                note: event.currentTarget.value.trim().slice(0, 240) || undefined,
                              })
                            }
                            maxLength={240}
                            rows={2}
                            placeholder="Technique cue, setup reminder, or coach note"
                            aria-label={`${exercise.name} private workout cue`}
                            className="input-grit min-h-20 resize-none px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={finishDayEdit}
            className="btn-grit mt-4 flex min-h-12 w-full items-center justify-center text-xs"
          >
            <Check size={15} className="mr-2" />
            Done editing {DAY_NAMES[selectedDay]}
          </button>
        </section>
      )}

      {!activeProgram && editingDay && showPicker && (
        <section id="exercise-picker" className="deadset-section scroll-mt-4">
          <div className="deadset-panel p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="deadset-kicker">Exercise catalog</p>
                <h2 className="display mt-2 text-2xl font-black uppercase text-grit">
                  {swapExerciseId ? "Choose a swap" : "Add movements"}
                </h2>
                <p className="mt-1 text-xs text-grit-dim">
                  {swapExerciseId
                    ? `Showing ${getExercise(swapExerciseId, state.savedExercises)?.muscleGroup.toLowerCase() ?? "matching"} alternatives that fit your equipment.`
                    : "Search the full catalog or create your own."}
                </p>
              </div>
              <button
                onClick={closeExercisePicker}
                aria-label="Close exercise catalog"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/10 text-grit-dim"
              >
                <X size={16} />
              </button>
            </div>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grit-dim"
              />
              <input
                defaultValue={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search exercise or muscle"
                className="input-grit pl-10"
                aria-label="Search exercises"
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {MUSCLE_FILTERS.map((muscle) => (
                <button
                  key={muscle}
                  onClick={() => setMuscleFilter(muscle)}
                  aria-pressed={muscleFilter === muscle}
                  className={`shrink-0 rounded-md border px-3 py-2 text-[10px] font-black uppercase ${
                    muscleFilter === muscle
                      ? "border-accent-red bg-accent-red/10 text-accent-red"
                      : "border-grit text-grit-dim"
                  }`}
                >
                  {muscle === "ALL" ? "All muscles" : muscle}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <select
                value={equipmentFilter}
                onChange={(event) => setEquipmentFilter(event.target.value)}
                aria-label="Filter exercises by equipment"
                className="input-grit min-h-11 text-xs uppercase"
              >
                <option value="ALL">All equipment</option>
                <option value="BARBELL">Barbell</option>
                <option value="DUMBBELL">Dumbbell</option>
                <option value="CABLE">Cable</option>
                <option value="MACHINE">Machine</option>
                <option value="KETTLEBELL">Kettlebell</option>
                <option value="BANDS">Bands</option>
                <option value="BODYWEIGHT">Bodyweight</option>
              </select>
              {!swapExerciseId && (
                <button
                  onClick={() => setShowCustom((current) => !current)}
                  className="btn-ghost min-h-11 px-3 text-[10px]"
                >
                  <Plus size={14} className="mr-1.5 inline" />
                  Custom
                </button>
              )}
            </div>

            {showCustom && !swapExerciseId && (
              <div className="mt-3 rounded-2xl border border-accent-red/40 bg-black/30 p-4">
                <p className="label-cap text-[10px] text-accent-red">Create an exercise</p>
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder="Exercise name"
                  aria-label="Custom exercise name"
                  className="input-grit mt-3"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    value={customMuscle}
                    onChange={(event) =>
                      setCustomMuscle(event.target.value as Exercise["muscleGroup"])
                    }
                    aria-label="Custom exercise muscle"
                    className="input-grit min-h-11 text-xs uppercase"
                  >
                    {MUSCLE_FILTERS.filter((muscle) => muscle !== "ALL").map((muscle) => (
                      <option key={muscle} value={muscle}>
                        {muscle}
                      </option>
                    ))}
                  </select>
                  <select
                    value={customEquipment}
                    onChange={(event) =>
                      setCustomEquipment(
                        event.target.value as "FULL_GYM" | "HOME_GYM" | "BODYWEIGHT",
                      )
                    }
                    aria-label="Custom exercise equipment"
                    className="input-grit min-h-11 text-xs uppercase"
                  >
                    <option value="FULL_GYM">Full gym</option>
                    <option value="HOME_GYM">Home gym</option>
                    <option value="BODYWEIGHT">Bodyweight</option>
                  </select>
                </div>
                <button onClick={createCustomExercise} className="btn-grit mt-3 min-h-11 w-full">
                  Create and add
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-grit-dim">
              <span>
                {libraryQuery.isLoading
                  ? "Loading full catalog..."
                  : `${exercisePool.length.toLocaleString()} exercises available`}
              </span>
              <Link to="/library" className="text-accent-red">
                Exercise guide
              </Link>
            </div>
            <div className="mt-3 max-h-[26rem] overflow-y-auto">
              {availableExercises.map((exercise) => {
                const added = selected.exerciseIds.includes(exercise.id);
                return (
                  <button
                    key={exercise.id}
                    onClick={() =>
                      swapExerciseId ? replaceExercise(exercise) : toggleExercise(exercise)
                    }
                    className="flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-1 py-3 text-left press"
                  >
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md border"
                      style={{
                        borderColor: added || swapExerciseId ? "#e63222" : "#2a2a2a",
                        color: added || swapExerciseId ? "#e63222" : "#8a8a8a",
                      }}
                    >
                      {swapExerciseId ? (
                        <RefreshCw size={15} />
                      ) : added ? (
                        <Check size={16} />
                      ) : (
                        <Dumbbell size={16} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-grit">{exercise.name}</p>
                      <p className="text-[10px] uppercase text-grit-dim">
                        {exercise.muscleGroup} -{" "}
                        {exercise.equipmentLabel || exercise.equipment[0].replace("_", " ")}
                        {exercise.isCustom ? " - custom" : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-grit-dim">
                      {swapExerciseId ? "Swap" : added ? "Added" : "Add"}
                    </span>
                  </button>
                );
              })}
              {!availableExercises.length && (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-grit">No exact match</p>
                  {!swapExerciseId && (
                    <button
                      onClick={() => {
                        setCustomName(search);
                        setShowCustom(true);
                      }}
                      className="mt-2 text-xs font-bold uppercase text-accent-red"
                    >
                      Create this exercise
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={closeExercisePicker}
              className="btn-grit mt-4 flex min-h-12 w-full items-center justify-center"
            >
              <Check size={15} className="mr-2" />
              {swapExerciseId ? "Keep current exercise" : "Done adding - set targets"}
            </button>
          </div>
        </section>
      )}

      {!activeProgram && (
        <PlanAudit
          schedule={displaySchedule}
          savedExercises={savedAndProgramExercises}
          isPro={isPro}
          loading={proLoading}
          onUnlock={() => openPaywall("plan-audit")}
          onRebalance={() => void rebalanceWeek()}
        />
      )}

      <section className="deadset-section">
        <Link
          to="/train"
          className="btn-grit flex min-h-14 w-full items-center justify-center text-sm"
        >
          Done - view today
          <ChevronRight size={18} className="ml-2" />
        </Link>
        <Link
          to="/programs"
          className="mt-2 flex min-h-11 items-center justify-center text-xs font-bold uppercase text-grit-dim"
        >
          Saved programs
        </Link>
      </section>
    </div>
  );
}

function WeekStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="deadset-metric">
      <p className="deadset-metric-label truncate">{label}</p>
      <p className="deadset-metric-value truncate">{value}</p>
    </div>
  );
}

function PlanInput({
  label,
  ariaLabel,
  defaultValue,
  placeholder,
  inputMode,
  onCommit,
}: {
  label: string;
  ariaLabel: string;
  defaultValue: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
  onCommit: (value: string) => string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[9px] font-bold uppercase text-grit-dim">{label}</span>
      <input
        defaultValue={defaultValue}
        aria-label={ariaLabel}
        placeholder={placeholder}
        inputMode={inputMode}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={(event) => {
          event.currentTarget.value = onCommit(event.currentTarget.value);
        }}
        className="input-grit min-w-0 px-2 py-2 text-sm"
      />
    </label>
  );
}

function PlanAudit({
  schedule,
  savedExercises,
  isPro,
  loading,
  onUnlock,
  onRebalance,
}: {
  schedule: Schedule;
  savedExercises: Exercise[];
  isPro: boolean;
  loading: boolean;
  onUnlock: () => void;
  onRebalance: () => void;
}) {
  const muscleSets = useMemo(() => {
    const totals = new Map<Exercise["muscleGroup"], number>();
    for (const dayKey of DAYS) {
      const day = schedule[dayKey];
      for (const id of day.exerciseIds) {
        const exercise = getExercise(id, savedExercises);
        if (!exercise) continue;
        const sets = day.exerciseConfig?.[id]?.sets ?? day.sets ?? exercise.sets;
        totals.set(exercise.muscleGroup, (totals.get(exercise.muscleGroup) ?? 0) + sets);
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [savedExercises, schedule]);
  const trainingDays = DAYS.filter((day) => schedule[day].exerciseIds.length > 0);
  const hasRestDay = trainingDays.length < 7;
  const muscleCoverage = muscleSets.length;
  const auditDetails = useMemo(() => {
    const dayMuscles = new Map<DayKey, Set<Exercise["muscleGroup"]>>();
    const overloadedDays: DayKey[] = [];
    for (const dayKey of DAYS) {
      const day = schedule[dayKey];
      const muscles = new Set<Exercise["muscleGroup"]>();
      let totalSets = 0;
      for (const id of day.exerciseIds) {
        const exercise = getExercise(id, savedExercises);
        if (!exercise) continue;
        muscles.add(exercise.muscleGroup);
        totalSets += day.exerciseConfig?.[id]?.sets ?? day.sets ?? exercise.sets;
      }
      dayMuscles.set(dayKey, muscles);
      if (totalSets > 24) overloadedDays.push(dayKey);
    }

    const recoveryConflicts: Array<{ from: DayKey; to: DayKey; muscles: string[] }> = [];
    DAYS.forEach((dayKey, index) => {
      const nextDay = DAYS[(index + 1) % DAYS.length];
      const current = dayMuscles.get(dayKey) ?? new Set();
      const next = dayMuscles.get(nextDay) ?? new Set();
      const overlap = [...current].filter((muscle) => next.has(muscle));
      if (overlap.length) recoveryConflicts.push({ from: dayKey, to: nextDay, muscles: overlap });
    });

    const covered = new Set(muscleSets.map(([muscle]) => muscle));
    const missingMuscles = MUSCLE_FILTERS.filter(
      (muscle): muscle is Exercise["muscleGroup"] => muscle !== "ALL" && !covered.has(muscle),
    );
    return { overloadedDays, recoveryConflicts, missingMuscles };
  }, [muscleSets, savedExercises, schedule]);
  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (Math.min(trainingDays.length, 5) / 5) * 30 +
          (Math.min(muscleCoverage, 6) / 6) * 45 +
          (hasRestDay ? 15 : 0) +
          (auditDetails.recoveryConflicts.length === 0 ? 10 : 0) -
          auditDetails.overloadedDays.length * 5,
      ),
    ),
  );

  return (
    <section className="deadset-section">
      <div
        className="relative overflow-hidden rounded-2xl border p-5 shadow-[0_18px_46px_rgba(0,0,0,.32)]"
        style={{
          borderColor: isPro ? "rgba(244,195,58,.45)" : "rgba(255,255,255,.12)",
          background: isPro
            ? "linear-gradient(135deg, rgba(244,195,58,.09), #151619 45%, #0c0d0f)"
            : "linear-gradient(180deg, #16171a, #0d0e10)",
        }}
      >
        <div
          className="absolute inset-y-0 left-0 w-[2px]"
          style={{ background: isPro ? "#f4c33a" : "#e63222" }}
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Crown size={15} className="text-amber-300" />
              <p className="label-cap text-[10px] text-amber-300">Plan intelligence</p>
            </div>
            <h2 className="display mt-2 text-2xl font-black uppercase text-grit">
              Weekly plan audit
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-grit-dim">
              Check muscle coverage, recovery spacing and weekly training volume before the week
              starts.
            </p>
          </div>
          {isPro && (
            <div className="shrink-0 text-right">
              <p className="display text-3xl font-black text-amber-300">{score}</p>
              <p className="text-[9px] font-bold uppercase text-grit-dim">Plan score</p>
            </div>
          )}
        </div>

        {isPro ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
              {MUSCLE_FILTERS.filter((muscle) => muscle !== "ALL").map((muscle) => {
                const sets = muscleSets.find(([entry]) => entry === muscle)?.[1] ?? 0;
                const pct = Math.min(100, Math.round((sets / 16) * 100));
                return (
                  <div key={muscle}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold uppercase text-grit">{muscle}</span>
                      <span className="text-grit-dim">{sets} sets</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black">
                      <div
                        className="h-full rounded-full bg-amber-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-3 border-y border-white/10 bg-black/20">
              <AuditMetric
                label="Coverage"
                value={`${muscleCoverage}/6`}
                warning={muscleCoverage < 6}
              />
              <AuditMetric
                label="Conflicts"
                value={`${auditDetails.recoveryConflicts.length}`}
                warning={auditDetails.recoveryConflicts.length > 0}
              />
              <AuditMetric
                label="Overloaded"
                value={`${auditDetails.overloadedDays.length}`}
                warning={auditDetails.overloadedDays.length > 0}
              />
            </div>
            {(auditDetails.missingMuscles.length > 0 ||
              auditDetails.recoveryConflicts.length > 0 ||
              auditDetails.overloadedDays.length > 0) && (
              <div className="mt-4 space-y-2">
                {auditDetails.missingMuscles.length > 0 && (
                  <AuditCallout
                    title="Coverage gap"
                    detail={`Add ${auditDetails.missingMuscles.join(", ").toLowerCase()} work to balance the week.`}
                  />
                )}
                {auditDetails.recoveryConflicts.slice(0, 2).map((conflict) => (
                  <AuditCallout
                    key={`${conflict.from}-${conflict.to}`}
                    title={`${conflict.from} → ${conflict.to} recovery`}
                    detail={`${conflict.muscles.join(", ").toLowerCase()} is trained on back-to-back days.`}
                  />
                ))}
                {auditDetails.overloadedDays.length > 0 && (
                  <AuditCallout
                    title="Session load"
                    detail={`${auditDetails.overloadedDays.join(", ")} exceeds 24 planned working sets.`}
                  />
                )}
              </div>
            )}
            <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4">
              {hasRestDay ? (
                <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />
              ) : (
                <RefreshCw size={15} className="mt-0.5 shrink-0 text-amber-300" />
              )}
              <p className="text-xs leading-relaxed text-grit-dim">
                {hasRestDay
                  ? `${7 - trainingDays.length} recovery day${7 - trainingDays.length === 1 ? "" : "s"} scheduled.`
                  : "No recovery day is scheduled. Rebalance the week to protect performance."}
              </p>
            </div>
            <button onClick={onRebalance} className="btn-ghost mt-4 min-h-11 w-full">
              <Sparkles size={14} className="mr-2 inline text-amber-300" />
              Rebalance from my profile
            </button>
          </>
        ) : (
          <button
            onClick={onUnlock}
            disabled={loading}
            className="btn-grit mt-5 flex min-h-12 w-full items-center justify-center disabled:opacity-50"
          >
            <Lock size={14} className="mr-2" />
            Unlock plan intelligence
          </button>
        )}
      </div>
    </section>
  );
}

function AuditMetric({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning: boolean;
}) {
  return (
    <div className="px-2 py-3 text-center">
      <p className={`display text-xl font-black ${warning ? "text-amber-300" : "text-grit"}`}>
        {value}
      </p>
      <p className="mt-1 text-[8px] font-black uppercase text-grit-dim">{label}</p>
    </div>
  );
}

function AuditCallout({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2.5">
      <p className="text-[10px] font-black uppercase text-amber-300">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-grit-dim">{detail}</p>
    </div>
  );
}
