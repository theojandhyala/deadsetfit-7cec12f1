import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Repeat, Search, Trash2, X } from "lucide-react";

import { allExercises } from "@/lib/exercises";
import { trackingModeFor } from "@/lib/set-tracking";
import type { Exercise, WorkoutSessionExercise } from "@/lib/types";

type Mode = "manage" | "add" | "replace";

/**
 * Mid-workout control over what you are actually doing: add a movement the
 * plan didn't have, swap one whose rack is taken, drop one, or reorder the
 * session to match the gym floor. Without this the plan wins every argument
 * with reality, and people log the workout they planned instead of the one
 * they did.
 */
export function SessionExerciseSheet({
  exercises,
  activeIndex,
  saved,
  onAdd,
  onReplace,
  onRemove,
  onMove,
  onSelect,
  onClose,
}: {
  exercises: WorkoutSessionExercise[];
  activeIndex: number;
  saved: Exercise[];
  onAdd: (exercise: Exercise) => void;
  onReplace: (exercise: Exercise) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("manage");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const catalogue = useMemo(() => allExercises(saved), [saved]);
  const inSession = useMemo(
    () => new Set(exercises.map((exercise) => exercise.exerciseId)),
    [exercises],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle
      ? catalogue.filter(
          (exercise) =>
            exercise.name.toLowerCase().includes(needle) ||
            exercise.muscleGroup.toLowerCase().includes(needle),
        )
      : catalogue;
    // Movements already in the session sink to the bottom rather than vanish:
    // tapping one is a legitimate way to jump to it.
    return [...pool]
      .sort((a, b) => Number(inSession.has(a.id)) - Number(inSession.has(b.id)))
      .slice(0, 60);
  }, [catalogue, query, inSession]);

  function pick(exercise: Exercise) {
    if (mode === "replace") onReplace(exercise);
    else onAdd(exercise);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="Session exercises"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-2xl border-t border-grit bg-grit-card"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-grit px-5 py-4">
          <p className="label-cap text-[10px] text-accent-red">
            {mode === "manage"
              ? "THIS SESSION"
              : mode === "replace"
                ? `SWAP ${exercises[activeIndex]?.name.toUpperCase() ?? ""}`
                : "ADD A MOVEMENT"}
          </p>
          <button onClick={onClose} className="icon-btn text-grit-dim" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {mode === "manage" ? (
          <>
            <div className="flex-1 overflow-auto px-5 py-3">
              <ul className="space-y-1.5">
                {exercises.map((exercise, index) => {
                  const active = index === activeIndex;
                  return (
                    <li
                      key={`${exercise.exerciseId}:${index}`}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                      style={{ borderColor: active ? "#e63222" : "#262626" }}
                    >
                      <button
                        onClick={() => {
                          onSelect(index);
                          onClose();
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-bold text-grit">{exercise.name}</p>
                        <p className="label-cap text-[9px] text-grit-dim">
                          {exercise.sets.length}/{exercise.targetSets} sets
                          {exercise.addedLive ? " · added live" : ""}
                        </p>
                      </button>
                      <button
                        onClick={() => onMove(index, -1)}
                        disabled={index === 0}
                        className="icon-btn text-grit-dim disabled:opacity-30"
                        aria-label={`Move ${exercise.name} earlier`}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => onMove(index, 1)}
                        disabled={index === exercises.length - 1}
                        className="icon-btn text-grit-dim disabled:opacity-30"
                        aria-label={`Move ${exercise.name} later`}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        onClick={() => onRemove(index)}
                        disabled={exercises.length <= 1}
                        className="icon-btn text-accent-red disabled:opacity-30"
                        aria-label={`Remove ${exercise.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-grit px-5 pt-3">
              <button
                onClick={() => {
                  setMode("replace");
                  requestAnimationFrame(() => searchRef.current?.focus());
                }}
                className="btn-ghost"
              >
                <Repeat size={15} className="mr-2" />
                Swap current
              </button>
              <button
                onClick={() => {
                  setMode("add");
                  requestAnimationFrame(() => searchRef.current?.focus());
                }}
                className="btn-grit"
              >
                Add exercise
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-grit px-5 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-grit px-3">
                <Search size={15} className="text-grit-dim" />
                <input
                  ref={searchRef}
                  defaultValue=""
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search movements"
                  className="w-full bg-transparent py-2.5 text-sm text-grit outline-none"
                  aria-label="Search movements"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto px-5 py-2">
              {results.length === 0 ? (
                <p className="py-8 text-center text-sm text-grit-dim">Nothing matches “{query}”.</p>
              ) : (
                <ul className="space-y-1">
                  {results.map((exercise) => {
                    const already = inSession.has(exercise.id);
                    const tracking = trackingModeFor(exercise, exercise.reps);
                    return (
                      <li key={exercise.id}>
                        <button
                          onClick={() => pick(exercise)}
                          className="flex w-full items-center gap-2 rounded-xl border border-grit px-3 py-2.5 text-left press"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-grit">
                              {exercise.name}
                            </span>
                            <span className="label-cap text-[9px] text-grit-dim">
                              {exercise.muscleGroup} · {exercise.sets} × {exercise.reps}
                              {tracking === "DURATION"
                                ? " · timed"
                                : tracking === "DISTANCE"
                                  ? " · distance"
                                  : ""}
                            </span>
                          </span>
                          {already && <Check size={15} className="shrink-0 text-[#22c55e]" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-grit px-5 pt-3">
              <button onClick={() => setMode("manage")} className="btn-ghost w-full">
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
