import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Check, ChevronRight, Dumbbell, Plus, ShieldCheck, Target } from "lucide-react";
import { toast } from "sonner";

import { MuscleDiagram } from "@/components/MuscleDiagram";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { defaultSchedule } from "@/lib/calc";
import { libraryExerciseToExercise } from "@/lib/exercise-library";
import { allExercises, getExercise } from "@/lib/exercises";
import { hapticFailure, hapticPlanUpdated, hapticSelection } from "@/lib/haptics";
import { listExercises, type LibraryExercise } from "@/lib/library.functions";
import {
  GROWTH_GOAL_OPTIONS,
  GROWTH_TARGET_OPTIONS,
  buildMuscleGrowthGuide,
  growthTargetOption,
  growthTargetsFor,
  type BroadGrowthTarget,
  type GrowthGoal,
  type GrowthTarget,
} from "@/lib/muscle-growth-recommendations";
import {
  addGrowthRecommendationToDay,
  growthExerciseIsOnDay,
  type GrowthPlanResult,
} from "@/lib/muscle-growth-plan";
import { weeklyVolume, volumeZoneMeta } from "@/lib/pro-intelligence";
import { muscleRecovery, recoveryLabel, toMuscleGroup } from "@/lib/recovery";
import { useAppState } from "@/lib/storage";
import type { AppState, DayKey, Exercise } from "@/lib/types";

const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_LABEL: Record<DayKey, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

const BROAD_TARGET_OPTIONS = GROWTH_TARGET_OPTIONS.filter((option) => option.kind === "BROAD");

const TARGET_DIAGRAM_MUSCLES: Record<GrowthTarget, string[]> = {
  CHEST: ["chest"],
  BACK: ["back"],
  SHOULDERS: ["shoulders"],
  ARMS: ["arms"],
  LEGS: ["legs"],
  CORE: ["core"],
  UPPER_CHEST: ["upper-chest"],
  MID_CHEST: ["chest"],
  LOWER_CHEST: ["chest"],
  BACK_WIDTH: ["lats"],
  BACK_THICKNESS: ["mid-back", "rhomboids"],
  LOWER_BACK: ["lower-back"],
  TRAPS: ["traps"],
  FRONT_DELTS: ["front-delts"],
  SIDE_DELTS: ["side-delts"],
  REAR_DELTS: ["rear-delts"],
  BICEPS: ["biceps"],
  TRICEPS: ["triceps"],
  FOREARMS: ["forearms"],
  QUADS: ["quads"],
  HAMSTRINGS: ["hamstrings"],
  GLUTES: ["glutes"],
  CALVES: ["calves"],
  ADDUCTORS: ["adductors"],
  ABDUCTORS: ["abductors"],
  HIP_FLEXORS: ["hip-flexors"],
  ABS: ["abs"],
  OBLIQUES: ["obliques"],
};

const BACK_VIEW_TARGETS = new Set<GrowthTarget>([
  "BACK",
  "BACK_WIDTH",
  "BACK_THICKNESS",
  "LOWER_BACK",
  "TRAPS",
  "REAR_DELTS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
]);

interface Props {
  selectedTarget: GrowthTarget;
  onTargetChange: (target: GrowthTarget) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function exerciseAsLibrary(exercise: Exercise): LibraryExercise {
  const difficulty = exercise.skill === "BEGINNER" ? 2 : exercise.skill === "ADVANCED" ? 5 : 3;
  const equipment = exercise.equipmentLabel ?? inferredEquipmentLabel(exercise);
  const primaryMuscles = exercise.primaryMuscles ?? [];
  return {
    id: exercise.id,
    slug: exercise.id,
    name: exercise.name,
    category: exercise.muscleGroup,
    primary_muscles:
      primaryMuscles.length > 0 ? primaryMuscles : [exercise.muscleGroup.toLowerCase()],
    secondary_muscles: exercise.secondaryMuscles ?? [],
    equipment,
    difficulty,
    instructions: exercise.instruction,
    pro_tip: exercise.proTip ?? "Progress with controlled, repeatable reps.",
    youtube_query: exercise.youtubeQuery || `${exercise.name} exercise form`,
    warmup_note: "",
    stretch_note: "",
    is_compound: exercise.isCompound ?? false,
  };
}

function inferredEquipmentLabel(exercise: Exercise) {
  const text = `${exercise.name} ${exercise.instruction}`.toLowerCase();
  if (exercise.equipment.includes("BODYWEIGHT")) return "BODYWEIGHT";
  if (/\b(dumbbell|db)\b/.test(text)) return "DUMBBELL";
  if (/\bkettlebell\b/.test(text)) return "KETTLEBELL";
  if (/\b(cable|rope|pulldown|face pull)\b/.test(text)) return "CABLE";
  if (/\b(machine|leg press|leg extension|leg curl|pec deck)\b/.test(text)) return "MACHINE";
  if (/\b(barbell|bench press|deadlift|back squat|front squat|good morning)\b/.test(text)) {
    return "BARBELL";
  }
  if (/\bband(?:ed)?\b/.test(text)) return "RESISTANCE BAND";
  if (exercise.equipment.includes("HOME_GYM")) return "HOME GYM";
  return "FULL GYM";
}

function targetView(target: GrowthTarget): "front" | "back" {
  return BACK_VIEW_TARGETS.has(target) ? "back" : "front";
}

function effectiveSchedule(state: AppState) {
  return state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
}

function recommendedDay(
  state: AppState,
  muscle: BroadGrowthTarget,
  exerciseIndex: Map<string, Exercise>,
  exerciseId: string,
  exerciseName: string,
): DayKey | null {
  const active = state.programs.find((program) => program.id === state.activeProgramId);
  const schedule = active ? null : effectiveSchedule(state);
  const preferred = new Set(state.profile?.trainingDays ?? []);
  const sessionLimit = state.profile?.exercisesPerSession ?? 6;

  const candidates = DAYS.filter(
    (dayKey) => !growthExerciseIsOnDay(state, dayKey, exerciseId, exerciseName),
  ).map((dayKey, order) => {
    let count = 0;
    let hitsTarget = false;
    let label = "REST";
    if (active) {
      const day = active.days[dayKey] ?? { label: "REST", items: [] };
      label = day.label;
      count = day.items.length;
      hitsTarget = day.items.some((item) =>
        item.primary_muscles.some((raw) => toMuscleGroup(raw) === muscle),
      );
    } else if (schedule) {
      const day = schedule[dayKey] ?? { label: "REST", exerciseIds: [] };
      label = day.label;
      count = day.exerciseIds.length;
      hitsTarget = day.exerciseIds.some((id) => {
        const exercise = exerciseIndex.get(id) ?? getExercise(id, state.savedExercises);
        return exercise?.muscleGroup === muscle;
      });
    }
    const labelledForTarget = toMuscleGroup(label) === muscle;
    const score =
      (hitsTarget || labelledForTarget ? 100 : 0) +
      (preferred.has(dayKey) ? 20 : 0) +
      (label !== "REST" ? 10 : 0) +
      Math.max(0, sessionLimit - count) * 3 -
      order / 10;
    return { dayKey, score, hasRoom: count < sessionLimit };
  });
  const daysWithRoom = candidates.filter((candidate) => candidate.hasRoom);
  return (
    (daysWithRoom.length > 0 ? daysWithRoom : candidates).sort((a, b) => b.score - a.score)[0]
      ?.dayKey ?? null
  );
}

export function MuscleGrowthCoach({ selectedTarget, onTargetChange, open, onOpenChange }: Props) {
  const [state, set] = useAppState();
  const [goal, setGoal] = useState<GrowthGoal>("SIZE");
  const [pendingRecommendationId, setPendingRecommendationId] = useState<string | null>(null);

  const libraryQuery = useQuery({
    queryKey: ["plan-exercise-library"],
    queryFn: () => listExercises({ data: { limit: 2000 } }),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const rawById = useMemo(() => {
    const exercises = new Map<string, LibraryExercise>();
    for (const exercise of allExercises(state.savedExercises)) {
      exercises.set(exercise.id, exerciseAsLibrary(exercise));
    }
    for (const exercise of libraryQuery.data?.exercises ?? []) exercises.set(exercise.id, exercise);
    return exercises;
  }, [libraryQuery.data?.exercises, state.savedExercises]);

  const exerciseIndex = useMemo(() => {
    const exercises = new Map(
      allExercises(state.savedExercises).map((exercise) => [exercise.id, exercise]),
    );
    for (const raw of libraryQuery.data?.exercises ?? []) {
      if (!exercises.has(raw.id)) exercises.set(raw.id, libraryExerciseToExercise(raw));
    }
    return exercises;
  }, [libraryQuery.data?.exercises, state.savedExercises]);

  const selectedOption = growthTargetOption(selectedTarget);
  const selectedMuscle = selectedOption.muscleGroup;
  const activeProgram = state.programs.find((program) => program.id === state.activeProgramId);
  const scheduleForGuide = useMemo(
    () => state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null),
    [state.profile, state.schedule],
  );
  const guide = useMemo(
    () =>
      buildMuscleGrowthGuide({
        target: selectedTarget,
        goal,
        exercises: [...exerciseIndex.values()],
        profile: state.profile,
        schedule: scheduleForGuide,
        activeProgram,
        limit: 3,
      }),
    [activeProgram, exerciseIndex, goal, scheduleForGuide, selectedTarget, state.profile],
  );
  const volume = useMemo(
    () => weeklyVolume(state).find((item) => item.muscle === selectedMuscle)!,
    [selectedMuscle, state],
  );
  const recovery = useMemo(
    () => muscleRecovery(state).find((item) => item.muscle === selectedMuscle)!,
    [selectedMuscle, state],
  );
  const volumeMeta = volumeZoneMeta(volume.zone);
  const recoveryMeta = recoveryLabel(recovery.pct);
  const subTargets = growthTargetsFor(selectedMuscle);

  function chooseTarget(target: GrowthTarget) {
    if (target === selectedTarget) return;
    setPendingRecommendationId(null);
    onTargetChange(target);
    hapticSelection();
  }

  function chooseGoal(nextGoal: GrowthGoal) {
    if (nextGoal === goal) return;
    setPendingRecommendationId(null);
    setGoal(nextGoal);
    hapticSelection();
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) setPendingRecommendationId(null);
    onOpenChange(nextOpen);
  }

  function addRecommendation(recommendationId: string, dayKey: DayKey) {
    const recommendation = guide.recommendations.find((item) => item.id === recommendationId);
    const exercise = recommendation ? rawById.get(recommendation.exerciseId) : undefined;
    if (!recommendation || !exercise) {
      hapticFailure();
      toast.error("That exercise is unavailable right now. Try another option.");
      return;
    }

    let outcome: GrowthPlanResult | undefined;
    set((current) => {
      outcome = addGrowthRecommendationToDay(current, dayKey, {
        exercise,
        sets: recommendation.prescription.sets,
        reps: recommendation.prescription.reps,
        restSeconds: recommendation.prescription.restSeconds,
      });
      return outcome.state;
    });

    if (outcome?.status === "ADDED") {
      hapticPlanUpdated();
      toast.success(
        `${exercise.name} added to ${DAY_LABEL[dayKey]}${outcome.destination === "PROGRAM" ? " in your active programme" : ""}`,
      );
      setPendingRecommendationId(null);
      changeOpen(false);
      return;
    }
    if (outcome?.status === "ALREADY_ADDED") {
      hapticSelection();
      toast.info(`${exercise.name} is already on ${DAY_LABEL[dayKey]}`);
      return;
    }
    hapticFailure();
    toast.error("Finish your profile before adding exercises to a week.");
  }

  return (
    <section id="muscle-growth-coach" className="mt-5 px-5 scroll-mt-20">
      <div className="relative overflow-hidden rounded-3xl border border-accent-red/40 bg-[#121316] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-accent-red/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-cap text-[9px] text-accent-red">MUSCLE LAB</p>
              <h2 className="display text-xl font-extrabold uppercase text-grit">
                Build what you want
              </h2>
            </div>
            <span className="label-cap rounded-full border border-grit bg-black/30 px-2.5 py-1 text-[7px] text-grit-dim">
              BUTTONS · NOT A BOT
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-grit-dim">
            Pick a body part and DEADSET turns your real programme into clear exercise options.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-1.5" aria-label="Choose a muscle group">
            {BROAD_TARGET_OPTIONS.map((option) => {
              const active = selectedMuscle === option.muscleGroup;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseTarget(option.id)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-xl border px-2 py-2 text-[9px] font-black uppercase tracking-[0.08em] press ${
                    active
                      ? "border-accent-red bg-accent-red text-black"
                      : "border-grit bg-black/30 text-grit"
                  }`}
                >
                  {option.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Choose a training goal">
            {GROWTH_GOAL_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseGoal(option.id)}
                aria-pressed={goal === option.id}
                className={`min-h-11 rounded-xl border px-1.5 py-2 text-[8px] font-black uppercase tracking-[0.06em] press ${
                  goal === option.id
                    ? "border-white/50 bg-white/10 text-grit"
                    : "border-grit bg-black/20 text-grit-dim"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_108px] items-center gap-3 rounded-2xl border border-grit bg-black/30 p-3">
            <div className="min-w-0">
              <p className="display text-lg font-extrabold uppercase leading-tight text-grit">
                {guide.question}
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-grit-dim">
                {guide.coverage.guidance}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <MetricPill color={volumeMeta.color} label={`${volume.sets} sets this week`} />
                <MetricPill color={recoveryMeta.color} label={recoveryMeta.label} />
              </div>
            </div>
            <MuscleDiagram
              view={targetView(selectedTarget)}
              primary={TARGET_DIAGRAM_MUSCLES[selectedTarget]}
              size={158}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              hapticSelection();
              changeOpen(true);
            }}
            className="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl bg-accent-red px-4 text-left text-black press"
          >
            <span>
              <span className="label-cap block text-[8px] text-black/70">
                {libraryQuery.isError ? "OFFLINE LIBRARY" : "PERSONALISED FROM YOUR PLAN"}
              </span>
              <span className="display block text-sm font-extrabold uppercase">
                Open {selectedOption.shortLabel} game plan
              </span>
            </span>
            <ChevronRight size={20} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={changeOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-grit bg-[#0c0d0f] p-0 text-grit"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        >
          <SheetHeader className="border-b border-grit px-5 pb-4 pt-5 pr-12 text-left">
            <p className="label-cap text-[9px] text-accent-red">MUSCLE LAB · NO CHATBOT</p>
            <SheetTitle className="display text-2xl font-extrabold uppercase leading-tight text-grit">
              {guide.question}
            </SheetTitle>
            <SheetDescription className="text-xs leading-relaxed text-grit-dim">
              Choose the exact area, then add a ranked movement straight to your real week.
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pt-4">
            <p className="label-cap mb-2 text-[9px] text-grit-dim">1 · PICK THE AREA</p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
              {subTargets.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseTarget(option.id)}
                  aria-pressed={selectedTarget === option.id}
                  className={`min-h-11 shrink-0 rounded-full border px-3 text-[9px] font-black uppercase tracking-[0.06em] press ${
                    selectedTarget === option.id
                      ? "border-accent-red bg-accent-red text-black"
                      : "border-grit bg-grit-card text-grit"
                  }`}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>

            <p className="label-cap mb-2 mt-3 text-[9px] text-grit-dim">2 · PICK THE OUTCOME</p>
            <div className="grid grid-cols-3 gap-1.5">
              {GROWTH_GOAL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseGoal(option.id)}
                  aria-pressed={goal === option.id}
                  className={`min-h-12 rounded-xl border px-2 text-[8px] font-black uppercase leading-tight press ${
                    goal === option.id
                      ? "border-white/40 bg-white/10 text-grit"
                      : "border-grit bg-black/30 text-grit-dim"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-grit bg-grit-card p-3">
              <MuscleDiagram
                view={targetView(selectedTarget)}
                primary={TARGET_DIAGRAM_MUSCLES[selectedTarget]}
                size={142}
              />
              <div className="min-w-0">
                <p className="label-cap text-[8px] text-grit-dim">YOUR COVERAGE</p>
                <p className="display mt-0.5 text-base font-extrabold uppercase text-grit">
                  {guide.coverage.headline}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-grit-dim">
                  {guide.coverage.guidance}
                </p>
                <p className="label-cap mt-2 text-[8px] text-accent-red">
                  {guide.coverage.weeklyExposureCount} current exposure
                  {guide.coverage.weeklyExposureCount === 1 ? "" : "s"} ·{" "}
                  {guide.coverage.suggestedWeeklyExposure}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between gap-3">
              <div>
                <p className="label-cap text-[9px] text-grit-dim">3 · CHOOSE A MOVEMENT</p>
                <p className="display text-lg font-extrabold uppercase text-grit">
                  Ranked for your setup
                </p>
              </div>
              <span className="label-cap text-[7px] text-grit-dim">
                {libraryQuery.isLoading ? "LOADING MORE…" : `${exerciseIndex.size} CHECKED`}
              </span>
            </div>

            {guide.recommendations.length > 0 ? (
              <div className="mt-3 space-y-3">
                {guide.recommendations.map((recommendation, index) => {
                  const raw = rawById.get(recommendation.exerciseId);
                  const choosingDay = pendingRecommendationId === recommendation.id;
                  const usedDays = DAYS.filter((dayKey) =>
                    growthExerciseIsOnDay(
                      state,
                      dayKey,
                      recommendation.exerciseId,
                      recommendation.name,
                    ),
                  );
                  const maxMovementDays = Math.min(3, Math.max(1, state.profile?.daysPerWeek ?? 3));
                  const atExposureLimit = usedDays.length >= maxMovementDays;
                  const bestDay = atExposureLimit
                    ? null
                    : recommendedDay(
                        state,
                        selectedMuscle,
                        exerciseIndex,
                        recommendation.exerciseId,
                        recommendation.name,
                      );
                  return (
                    <article
                      key={recommendation.id}
                      className="overflow-hidden rounded-2xl border border-grit bg-grit-card"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="label-cap text-[8px] text-accent-red">
                              #{index + 1} · {recommendation.match} MATCH
                            </p>
                            <h3 className="display mt-0.5 truncate text-lg font-extrabold uppercase text-grit">
                              {recommendation.name}
                            </h3>
                            <p className="mt-1 text-[10px] text-grit-dim">
                              {raw?.equipment ?? "Your equipment"} ·{" "}
                              {recommendation.areaLabels.join(" · ") || selectedOption.label}
                            </p>
                          </div>
                          {recommendation.alreadyPlanned ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[7px] font-black uppercase text-emerald-400">
                              <Check size={10} /> In week
                            </span>
                          ) : (
                            <Target size={20} className="shrink-0 text-accent-red" />
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          <PrescriptionStat
                            icon={<Dumbbell size={12} />}
                            label="SETS"
                            value={String(recommendation.prescription.sets)}
                          />
                          <PrescriptionStat
                            icon={<Activity size={12} />}
                            label="TARGET"
                            value={recommendation.prescription.reps}
                          />
                          <PrescriptionStat
                            icon={<ShieldCheck size={12} />}
                            label="REST"
                            value={`${recommendation.prescription.restSeconds}s`}
                          />
                        </div>

                        <p className="mt-3 text-xs leading-relaxed text-grit">
                          {recommendation.reason}
                        </p>
                        {recommendation.caution && (
                          <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2 text-[9px] leading-relaxed text-amber-200">
                            {recommendation.caution}
                          </p>
                        )}

                        <details className="mt-3 border-t border-grit pt-2">
                          <summary className="flex min-h-11 cursor-pointer items-center text-[9px] font-black uppercase tracking-[0.08em] text-grit-dim">
                            Form focus & why it fits
                          </summary>
                          <p className="pb-1 text-[10px] leading-relaxed text-grit-dim">
                            {raw?.pro_tip || raw?.instructions || guide.safetyNote}
                          </p>
                        </details>

                        <button
                          type="button"
                          disabled={atExposureLimit}
                          aria-expanded={choosingDay}
                          aria-controls={`day-picker-${recommendation.id}`}
                          onClick={() => {
                            hapticSelection();
                            setPendingRecommendationId(choosingDay ? null : recommendation.id);
                          }}
                          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent-red/50 bg-accent-red/10 text-[10px] font-black uppercase tracking-[0.08em] text-accent-red press disabled:opacity-40"
                        >
                          {atExposureLimit ? (
                            `Already on ${usedDays.length} day${usedDays.length === 1 ? "" : "s"}`
                          ) : (
                            <>
                              <Plus size={14} />
                              {recommendation.alreadyPlanned ? "Add another day" : "Add to my week"}
                            </>
                          )}
                        </button>
                      </div>

                      {choosingDay && (
                        <div
                          id={`day-picker-${recommendation.id}`}
                          className="border-t border-grit bg-black/35 p-3"
                        >
                          <p className="label-cap text-[8px] text-grit-dim">
                            {bestDay
                              ? `TAP A DAY · ${DAY_LABEL[bestDay].toUpperCase()} FITS BEST`
                              : "TAP AN AVAILABLE DAY"}
                          </p>
                          <div className="mt-2 grid grid-cols-4 gap-1.5">
                            {DAYS.map((dayKey) => {
                              const added = growthExerciseIsOnDay(
                                state,
                                dayKey,
                                recommendation.exerciseId,
                                recommendation.name,
                              );
                              return (
                                <button
                                  key={dayKey}
                                  type="button"
                                  disabled={added}
                                  aria-label={`${added ? recommendation.name + " is already on" : "Add " + recommendation.name + " to"} ${DAY_LABEL[dayKey]}`}
                                  onClick={() => addRecommendation(recommendation.id, dayKey)}
                                  className={`relative min-h-12 rounded-xl border text-[9px] font-black uppercase press disabled:opacity-50 ${
                                    bestDay === dayKey
                                      ? "border-accent-red bg-accent-red text-black"
                                      : "border-grit bg-grit-card text-grit"
                                  }`}
                                >
                                  {added ? (
                                    <Check size={13} className="mx-auto" />
                                  ) : (
                                    DAY_LABEL[dayKey]
                                  )}
                                  {bestDay === dayKey && !added && (
                                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded bg-black px-1 text-[5px] text-white">
                                      BEST
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-grit p-4 text-xs leading-relaxed text-grit-dim">
                {guide.emptyReason}
              </div>
            )}

            <p className="mt-4 text-[9px] leading-relaxed text-grit-dim">
              {guide.safetyNote} These options use fixed rules from your equipment, experience and
              current programme—nothing is generated by a chatbot.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function MetricPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[7px] font-black uppercase text-grit">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function PrescriptionStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-grit bg-black/25 px-2 py-2 text-center">
      <span className="flex items-center justify-center text-accent-red">{icon}</span>
      <span className="label-cap mt-1 block text-[6px] text-grit-dim">{label}</span>
      <span className="display mt-0.5 block truncate text-xs font-extrabold uppercase text-grit">
        {value}
      </span>
    </div>
  );
}
