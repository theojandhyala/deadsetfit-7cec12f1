import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Dumbbell,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import { successFeedback } from "@/lib/haptics";
import { getExercise } from "@/lib/exercises";
import { askConfirm } from "@/lib/confirm";
import { suggestNextWeight } from "@/lib/progression";
import {
  addStrengthExerciseToSchedule,
  buildStrengthMap,
  strengthMapColor,
  strengthRecommendations,
  type StrengthRegion,
} from "@/lib/strength-map";
import type { AppState } from "@/lib/types";
import { MuscleDiagram } from "./MuscleDiagram";
import { SocialShareButton } from "./SocialShareButton";

const SHAPES: Record<StrengthRegion, string[]> = {
  chest: ["chest", "upper-chest"],
  back: ["back", "lats", "mid-back", "upper-back"],
  shoulders: ["shoulders", "front-delts", "side-delts", "rear-delts", "traps"],
  arms: ["biceps", "triceps", "forearms", "brachialis"],
  core: ["core", "obliques"],
  quads: ["quads", "hip-flexors"],
  hamstrings: ["hamstrings"],
  glutes: ["glutes"],
  calves: ["calves"],
};

function tier(score: number) {
  if (score <= 0) return "NO DATA";
  if (score < 55) return "FOUNDATION";
  if (score < 65) return "BUILDING";
  if (score < 75) return "STRONG";
  if (score < 85) return "ADVANCED";
  if (score < 95) return "ELITE";
  return "PEAK";
}

type Props = {
  state: AppState;
  setState: (update: (current: AppState) => AppState) => void;
};

export function StrengthMapCard({ state, setState }: Props) {
  const map = useMemo(() => buildStrengthMap(state), [state]);
  const [selectedId, setSelectedId] = useState<StrengthRegion>("chest");
  const [addedMessage, setAddedMessage] = useState("");
  const selected = map.regions.find((region) => region.id === selectedId) ?? map.regions[0];
  const recommendations = useMemo(
    () => strengthRecommendations(state, selected.id, 4),
    [selected.id, state],
  );
  const intensity = useMemo(() => {
    const result: Record<string, number> = {};
    for (const region of map.regions) {
      for (const shape of SHAPES[region.id]) result[shape] = region.score;
    }
    return result;
  }, [map.regions]);
  const gaps = map.regions.filter((region) => region.status === "unplanned");
  const waiting = map.regions.filter((region) => region.status === "unlogged");
  const lead = selected.exercises[0];
  const leadDefinition = lead ? getExercise(lead.exerciseId, state.savedExercises) : undefined;
  const leadPlan = state.schedule
    ? Object.values(state.schedule)
        .map((day) => day.exerciseConfig?.[lead?.exerciseId ?? ""])
        .find(Boolean)
    : undefined;
  const progressionTarget = lead
    ? suggestNextWeight(
        state,
        lead.exerciseId,
        leadPlan?.reps ?? leadDefinition?.reps ?? "8-12",
        leadPlan?.progression ?? "DOUBLE",
      )
    : null;

  function selectRegion(region: StrengthRegion) {
    setSelectedId(region);
    setAddedMessage("");
  }

  function addExercise(exerciseId: string, name: string) {
    const outcome = addStrengthExerciseToSchedule(state, exerciseId, selected.id);
    setState((current) => {
      const latest = addStrengthExerciseToSchedule(current, exerciseId, selected.id);
      return latest?.added ? { ...current, schedule: latest.schedule } : current;
    });
    if (outcome?.added) {
      void successFeedback();
      setAddedMessage(`${name} added to ${outcome.day}.`);
    } else {
      setAddedMessage(outcome ? `${name} is already in ${outcome.day}.` : "Set up a plan first.");
    }
  }

  async function coverGaps() {
    const previews: string[] = [];
    let previewState = state;
    for (const gap of buildStrengthMap(previewState).regions.filter(
      (region) => region.status === "unplanned",
    )) {
      const pick = strengthRecommendations(previewState, gap.id, 10).find(
        (item) => !item.alreadyPlanned,
      );
      if (!pick) continue;
      const result = addStrengthExerciseToSchedule(previewState, pick.exercise.id, gap.id);
      if (!result?.added) continue;
      previews.push(`${gap.label}: ${pick.exercise.name} → ${result.day}`);
      previewState = { ...previewState, schedule: result.schedule };
    }
    if (!previews.length) {
      setAddedMessage("Every compatible area is already covered.");
      return;
    }
    const confirmed = await askConfirm({
      title: `Add ${previews.length} coverage moves?`,
      message: previews.join("\n"),
      confirmLabel: "Add to plan",
    });
    if (!confirmed) return;
    let count = 0;
    setState((current) => {
      let next = current;
      for (const gap of buildStrengthMap(next).regions.filter(
        (region) => region.status === "unplanned",
      )) {
        const pick = strengthRecommendations(next, gap.id, 10).find((item) => !item.alreadyPlanned);
        if (!pick) continue;
        const result = addStrengthExerciseToSchedule(next, pick.exercise.id, gap.id);
        if (result?.added) {
          next = { ...next, schedule: result.schedule };
          count += 1;
        }
      }
      return next;
    });
    if (count > 0) void successFeedback();
    setAddedMessage(
      count > 0
        ? `${count} coverage ${count === 1 ? "move" : "moves"} added.`
        : "Every area is already covered.",
    );
  }

  const nextTarget = lead
    ? progressionTarget
      ? `${progressionTarget.weightKg} kg × ${progressionTarget.targetReps ?? lead.latestReps}`
      : lead.latestWeight > 0
        ? `${lead.latestWeight} kg × ${lead.latestReps}`
        : `${lead.latestReps + 1} controlled reps`
    : "Log your first working set";

  return (
    <section className="mb-6 px-5 animate-slide-up">
      <div
        className="deadset-3d-panel overflow-hidden rounded-[26px] border p-4"
        style={{
          borderColor: "rgba(230,50,34,.42)",
          background:
            "radial-gradient(circle at 50% 20%, rgba(230,50,34,.14), transparent 42%), linear-gradient(145deg,#171717,#080808)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-cap text-[9px] text-accent-red">Your signature</p>
            <h2 className="display mt-1 text-2xl font-extrabold uppercase leading-none text-white">
              Strength Map
            </h2>
            <p className="mt-2 max-w-[235px] text-[11px] leading-relaxed text-grit-dim">
              Tap a muscle. See the lifts building it, your next target and what to add next.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="display text-3xl font-black leading-none text-white">
              {map.overall || "—"}
            </p>
            <p
              className="label-cap mt-1 text-[8px]"
              style={{ color: strengthMapColor(map.overall) }}
            >
              {tier(map.overall)}
            </p>
          </div>
        </div>

        <div className="relative my-3 rounded-2xl border border-white/5 bg-black/35 py-3">
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-full bg-accent-red/10 blur-3xl" />
          <MuscleDiagram
            intensity={intensity}
            size={250}
            accessibilityLabel={`Strength Map. ${map.trackedCount} of ${map.plannedCount} planned areas have logged strength evidence. Use the muscle buttons below to inspect each region.`}
          />
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/75 px-2.5 py-1.5 backdrop-blur">
            <Zap size={11} className="text-accent-red" />
            <span className="label-cap text-[8px] text-grit">
              {map.trackedCount}/{map.plannedCount || 0} areas live
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {map.regions.map((region) => {
            const active = selected.id === region.id;
            return (
              <button
                type="button"
                key={region.id}
                onClick={() => selectRegion(region.id)}
                aria-pressed={active}
                className={`min-w-0 rounded-xl border px-2 py-2 text-left transition duration-200 active:scale-[.97] ${
                  active
                    ? "border-accent-red/70 bg-accent-red/10"
                    : "border-white/5 bg-white/[0.025]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="truncate text-[9px] font-black uppercase text-grit">
                    {region.label}
                  </span>
                  <span
                    className="display text-[11px] font-black"
                    style={{ color: strengthMapColor(region.score) }}
                  >
                    {region.score || "—"}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
                    style={{
                      width: `${region.score}%`,
                      background: strengthMapColor(region.score),
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <div className="flex items-center justify-between border-b border-white/8 p-3">
            <div>
              <p className="label-cap text-[8px] text-grit-dim">Selected area</p>
              <p className="display mt-0.5 text-lg font-black uppercase text-white">
                {selected.label}
              </p>
            </div>
            <span
              className="rounded-full border px-2.5 py-1 text-[8px] font-black uppercase"
              style={{
                color: strengthMapColor(selected.score),
                borderColor: strengthMapColor(selected.score),
              }}
            >
              {selected.status === "unplanned" ? "Not covered" : tier(selected.score)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-px bg-white/8">
            <div className="min-w-0 bg-[#0b0b0b] p-3">
              <div className="flex items-center gap-1.5 text-grit-dim">
                <TrendingUp size={12} />
                <span className="label-cap text-[8px]">Best proof</span>
              </div>
              <p className="mt-1 truncate text-[12px] font-bold text-white">
                {lead ? `${lead.name} · ${lead.bestEstimate} e1RM` : "No working sets yet"}
              </p>
            </div>
            <div className="min-w-0 bg-[#0b0b0b] p-3">
              <div className="flex items-center gap-1.5 text-grit-dim">
                <Target size={12} />
                <span className="label-cap text-[8px]">Next target</span>
              </div>
              <p className="mt-1 truncate text-[12px] font-bold text-white">{nextTarget}</p>
            </div>
          </div>

          <div className="border-t border-white/8 bg-[#0b0b0b] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label-cap text-[8px] text-grit-dim">This week</p>
                <p className="display mt-1 text-xl font-black text-white">
                  {selected.weeklySets} sets
                </p>
              </div>
              <div className="text-right">
                <p className="label-cap text-[8px] text-grit-dim">Planning range</p>
                <p className="mt-1 text-[11px] font-bold text-grit">
                  {selected.weeklyTarget.min}–{selected.weeklyTarget.max} working sets
                </p>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-accent-red transition-[width] duration-700 motion-reduce:transition-none"
                style={{
                  width: `${Math.min(100, (selected.weeklySets / selected.weeklyTarget.max) * 100)}%`,
                }}
              />
            </div>
            {progressionTarget && (
              <p className="mt-2 text-[9px] leading-relaxed text-grit-dim">
                <span className="font-bold text-grit">Why this target:</span>{" "}
                {progressionTarget.reason}.
              </p>
            )}
          </div>

          {selected.exercises.length > 0 && (
            <div className="space-y-1.5 p-3">
              {selected.exercises.slice(0, 3).map((exercise) => (
                <div
                  key={exercise.exerciseId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-grit">{exercise.name}</p>
                    <p className="text-[8px] uppercase tracking-wide text-grit-dim">
                      {exercise.sessions} sessions · latest {exercise.latestEstimate} e1RM
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-black ${
                      exercise.changePercent > 0 ? "text-green-400" : "text-grit-dim"
                    }`}
                  >
                    {exercise.changePercent > 0 ? `+${exercise.changePercent}%` : "BASE"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-accent-red" />
              <p className="label-cap text-[9px] text-grit">Build {selected.label}</p>
            </div>
            <p className="text-[8px] text-grit-dim">Equipment + injury notes checked</p>
          </div>
          <div className="space-y-1.5">
            {recommendations.map(({ exercise, alreadyPlanned, reason }) => (
              <button
                type="button"
                key={exercise.id}
                onClick={() => addExercise(exercise.id, exercise.name)}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-left transition active:scale-[.985]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-white">{exercise.name}</p>
                  <p className="truncate text-[8px] text-grit-dim">
                    {reason} · {exercise.sets} × {exercise.reps}
                  </p>
                </div>
                {alreadyPlanned ? (
                  <Check size={15} className="shrink-0 text-green-400" />
                ) : (
                  <Plus size={15} className="shrink-0 text-accent-red" />
                )}
              </button>
            ))}
          </div>
          {addedMessage && (
            <p role="status" className="mt-2 text-center text-[9px] font-bold text-green-400">
              {addedMessage}
            </p>
          )}
        </div>

        {(gaps.length > 0 || waiting.length > 0) && (
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/30 p-3">
            {gaps.length > 0 && (
              <p className="text-[10px] leading-relaxed text-grit-dim">
                <span className="font-bold text-grit">No exercises set for:</span>{" "}
                {gaps.map((region) => region.label).join(", ")}.
              </p>
            )}
            {waiting.length > 0 && (
              <p className="mt-1 text-[10px] leading-relaxed text-grit-dim">
                <span className="font-bold text-grit">Awaiting a working set:</span>{" "}
                {waiting.map((region) => region.label).join(", ")}.
              </p>
            )}
            {gaps.length > 0 && (
              <button
                type="button"
                onClick={coverGaps}
                className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-accent-red/30 bg-accent-red/10 text-[9px] font-black uppercase text-accent-red"
              >
                <Sparkles size={13} /> Auto-cover every gap
              </button>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <SocialShareButton
            text={`My DEADSET ${selected.label} score is ${selected.score || "ready to build"}. ${
              lead
                ? `${lead.name} is up ${Math.max(0, lead.changePercent)}%.`
                : "Next step: log a working set."
            }`}
            className="btn-ghost flex min-h-11 items-center justify-center gap-2 text-[10px]"
          />
          <Link
            to="/workout/live"
            search={{}}
            className="btn-grit flex min-h-11 items-center justify-center gap-2 text-[10px]"
          >
            Log & update <ArrowUpRight size={14} />
          </Link>
        </div>
        <Link
          to="/plan"
          className="mt-2 flex min-h-10 items-center justify-center gap-2 text-[9px] font-bold uppercase text-grit-dim"
        >
          <Dumbbell size={13} /> Open full plan <ChevronRight size={13} />
        </Link>

        <p className="mt-2 text-center text-[8px] leading-relaxed text-grit-dim/75">
          Personal score from working-load progress and repeated logged sessions. Not a medical
          assessment or comparison with other athletes.
        </p>
      </div>
    </section>
  );
}
