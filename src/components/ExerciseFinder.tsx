import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Plus, Search, SlidersHorizontal, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { MuscleDiagram } from "./MuscleDiagram";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { listExercises } from "@/lib/library.functions";
import {
  buildExerciseFinderCatalogue,
  findExercises,
  plannedFinderIds,
  type FinderExercise,
  type FinderFilters,
} from "@/lib/exercise-finder";
import {
  addGrowthRecommendationToDay,
  growthExerciseIsOnDay,
  type GrowthPlanResult,
} from "@/lib/muscle-growth-plan";
import { hapticFailure, hapticPlanUpdated, hapticSelection } from "@/lib/haptics";
import { useAppState } from "@/lib/storage";
import type { DayKey } from "@/lib/types";

const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MUSCLES = ["ALL", "CHEST", "BACK", "SHOULDERS", "ARMS", "LEGS", "CORE"];
const EQUIPMENT = [
  "ALL",
  "BARBELL",
  "DUMBBELL",
  "CABLE",
  "MACHINE",
  "BODYWEIGHT",
  "BANDS",
  "KETTLEBELL",
  "OTHER",
];
const INITIAL: FinderFilters = {
  query: "",
  muscle: "ALL",
  equipment: "ALL",
  beginner: false,
  collection: "ALL",
};
const PAGE_SIZE = 40;

export function ExerciseFinder() {
  const [state, set] = useAppState();
  const [filters, setFilters] = useState<FinderFilters>(INITIAL);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<FinderExercise | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(filters.query);
  const catalogueQuery = useQuery({
    queryKey: ["exercise-finder-catalogue"],
    queryFn: () => listExercises({ data: { limit: 2000 } }),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const catalogue = useMemo(
    () => buildExerciseFinderCatalogue(state.savedExercises, catalogueQuery.data?.exercises ?? []),
    [state.savedExercises, catalogueQuery.data],
  );
  const plannedIds = useMemo(() => plannedFinderIds(state, catalogue), [catalogue, state]);
  const results = useMemo(
    () => findExercises(catalogue, { ...filters, query: deferredQuery }, plannedIds),
    [catalogue, filters, deferredQuery, plannedIds],
  );
  const active = state.programs.find((program) => program.id === state.activeProgramId);
  const hasPlan = !!active || !!state.schedule || !!state.profile;
  const filterCount =
    Number(filters.muscle !== "ALL") +
    Number(filters.equipment !== "ALL") +
    Number(filters.beginner);

  function update(patch: Partial<FinderFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setLimit(PAGE_SIZE);
  }
  function clear() {
    setFilters(INITIAL);
    setLimit(PAGE_SIZE);
    if (input.current) input.current.value = "";
    hapticSelection();
    input.current?.focus();
  }
  function addToDay(exercise: FinderExercise, day: DayKey) {
    let outcome: GrowthPlanResult | undefined;
    set((current) => {
      outcome = addGrowthRecommendationToDay(current, day, {
        exercise,
        sets: exercise.plannedSets,
        reps: exercise.plannedReps,
      });
      return outcome.state;
    });
    if (outcome?.status === "ADDED") {
      hapticPlanUpdated();
      toast.success(
        `${exercise.name} added to ${day}${outcome.destination === "PROGRAM" ? " in your active programme" : ""}`,
      );
    } else if (outcome?.status === "ALREADY_ADDED") {
      hapticSelection();
      toast.info(`Already on ${day}`);
    } else {
      hapticFailure();
      toast.error("Finish setting up your training week first.");
    }
  }

  return (
    <main className="min-w-0 px-4 pb-8 pt-6 text-grit">
      <header className="relative overflow-hidden rounded-3xl border border-accent-red/25 bg-[radial-gradient(ellipse_at_top_right,rgba(225,6,0,.18),transparent_70%)] p-5">
        <p className="label-cap text-[10px] text-accent-red">THE EXERCISE LIBRARY</p>
        <h1 className="display mt-1 text-3xl font-black uppercase">Find your next lift</h1>
        <p className="mt-2 text-xs leading-relaxed text-grit-dim">
          Search your way. Explore a muscle. Add the right movement straight to your week.
        </p>
        <p className="mt-3 text-[11px] text-grit-dim">
          {catalogue.length} available movements · Your saved exercises stay with you
        </p>
      </header>
      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-3.5 text-grit-dim"
          size={18}
          aria-hidden="true"
        />
        <input
          ref={input}
          aria-label="Search exercises"
          placeholder="Try db press, chest or cable flys"
          defaultValue=""
          maxLength={120}
          onChange={(event) => update({ query: event.target.value })}
          className="min-h-12 w-full min-w-0 rounded-xl border border-grit bg-grit-card pl-10 pr-12 text-base text-grit"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {filters.query && (
          <button
            className="press absolute right-0 top-0 grid min-h-12 min-w-12 place-items-center"
            aria-label="Clear search"
            onClick={() => {
              update({ query: "" });
              if (input.current) input.current.value = "";
              input.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Exercise collection">
        {(
          [
            ["ALL", "Explore"],
            ["PLANNED", "In my week"],
            ["SAVED", "Saved / custom"],
          ] as const
        ).map(([value, label]) => (
          <FilterButton
            key={value}
            active={filters.collection === value}
            onClick={() => update({ collection: value })}
          >
            {label}
          </FilterButton>
        ))}
      </div>
      <button
        className="press mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-grit px-3 text-xs font-bold"
        aria-expanded={filtersOpen}
        aria-controls="exercise-finder-filters"
        onClick={() => {
          setFiltersOpen(!filtersOpen);
          hapticSelection();
        }}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={16} /> Muscle & equipment
          {filterCount ? ` · ${filterCount} active` : ""}
        </span>
        <span>{filtersOpen ? "Hide" : "Choose"}</span>
      </button>
      {filtersOpen && (
        <section
          id="exercise-finder-filters"
          className="deadset-view-switch mt-2 rounded-2xl border border-grit bg-grit-card p-3"
        >
          <p className="label-cap mb-2 text-[10px] text-grit-dim">Primary muscle</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Primary muscle filter">
            {MUSCLES.map((muscle) => (
              <FilterButton
                key={muscle}
                active={filters.muscle === muscle}
                onClick={() => update({ muscle })}
              >
                {muscle === "ALL" ? "All muscles" : muscle}
              </FilterButton>
            ))}
          </div>
          <p className="label-cap mb-2 mt-4 text-[10px] text-grit-dim">Equipment</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Equipment filter">
            {EQUIPMENT.map((equipment) => (
              <FilterButton
                key={equipment}
                active={filters.equipment === equipment}
                onClick={() => update({ equipment })}
              >
                {equipment === "ALL" ? "All equipment" : equipment}
              </FilterButton>
            ))}
          </div>
          <div className="mt-3">
            <FilterButton
              active={filters.beginner}
              onClick={() => update({ beginner: !filters.beginner })}
            >
              Beginner-friendly only
            </FilterButton>
          </div>
        </section>
      )}
      {catalogueQuery.isError && (
        <div
          role="status"
          className="mt-3 rounded-xl border border-amber-400/25 p-3 text-xs text-grit-dim"
        >
          <p className="flex items-center gap-2">
            <WifiOff size={16} /> Full catalogue unavailable. Built-in and saved moves still work.
          </p>
          <button
            className="press mt-2 min-h-11 font-bold text-grit"
            onClick={() => void catalogueQuery.refetch()}
          >
            Retry catalogue
          </button>
        </div>
      )}
      {catalogueQuery.isFetching && !catalogueQuery.data && (
        <p className="mt-3 text-xs text-grit-dim" role="status">
          You can browse now. Loading the full catalogue…
        </p>
      )}
      <div className="my-4 flex min-w-0 items-center justify-between gap-2">
        <p className="text-xs text-grit-dim" role="status" aria-live="polite">
          {results.length} {results.length === 1 ? "match" : "matches"}
          {filters.query !== deferredQuery ? " · updating" : ""}
        </p>
        {(filterCount > 0 || filters.query || filters.collection !== "ALL") && (
          <button className="press min-h-11 text-xs font-bold text-grit" onClick={clear}>
            Reset all
          </button>
        )}
      </div>
      <ul className="space-y-2" aria-label="Exercise results">
        {results.slice(0, limit).map((exercise) => (
          <li key={exercise.id}>
            <button
              className="press flex min-h-20 w-full min-w-0 items-center gap-3 rounded-2xl border border-grit bg-grit-card p-4 text-left"
              onClick={() => {
                setSelected(exercise);
                hapticSelection();
              }}
            >
              <div className="min-w-0 flex-1">
                <h2 className="display break-words text-lg font-bold uppercase">{exercise.name}</h2>
                <p className="mt-1 break-words text-[11px] text-grit-dim">
                  {exercise.muscleGroup} · {exercise.equipment}
                </p>
                <p className="mt-1 text-[10px] text-grit-dim">
                  {exercise.difficulty <= 2
                    ? "Beginner-friendly"
                    : exercise.difficulty >= 5
                      ? "Advanced"
                      : "Intermediate"}
                  {plannedIds.has(exercise.id) ? " · In your week" : ""}
                  {exercise.source === "SAVED" ? " · Saved" : ""}
                </p>
              </div>
              <ChevronRight className="shrink-0 text-accent-red" size={18} />
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && (
        <div className="rounded-2xl border border-grit p-6 text-center">
          <h2 className="display text-xl font-bold uppercase">No matching movements</h2>
          <p className="mt-2 text-xs leading-relaxed text-grit-dim">
            Try the muscle or equipment name, or reset your filters. Saved custom exercises are
            included.
          </p>
          <button className="btn-grit press mt-4 w-full" onClick={clear}>
            Reset search & filters
          </button>
        </div>
      )}
      {results.length > limit && (
        <button
          className="press mt-4 min-h-12 w-full rounded-xl border border-grit text-xs font-bold"
          onClick={() => {
            setLimit((current) => current + PAGE_SIZE);
            hapticSelection();
          }}
        >
          Show more · {results.length - limit} remaining
        </button>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="muscle-lab-sheet mx-auto max-h-[92dvh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-t-3xl border-grit bg-[#0c0d0f] p-5 text-grit"
        >
          {selected && (
            <>
              <SheetHeader className="pr-8 text-left">
                <SheetTitle className="display break-words text-2xl font-black uppercase">
                  {selected.name}
                </SheetTitle>
                <SheetDescription>
                  {selected.muscleGroup} · {selected.equipment}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex justify-center">
                <MuscleDiagram
                  primary={selected.primary_muscles}
                  secondary={selected.secondary_muscles}
                  size={190}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-grit-dim">
                Primary: {selected.primary_muscles.join(", ") || selected.muscleGroup}
                {selected.secondary_muscles.length
                  ? ` · Supporting: ${selected.secondary_muscles.join(", ")}`
                  : ""}
              </p>
              <h3 className="label-cap mt-5 text-xs">The movement</h3>
              <p className="mt-2 text-sm leading-relaxed">{selected.instructions}</p>
              {selected.pro_tip && (
                <div className="mt-3 rounded-xl border border-accent-red/25 bg-accent-red/5 p-3">
                  <h3 className="label-cap text-[10px] text-accent-red">Technique cue</h3>
                  <p className="mt-1 text-sm leading-relaxed">{selected.pro_tip}</p>
                </div>
              )}
              {selected.warmup_note && (
                <p className="mt-3 text-xs leading-relaxed text-grit-dim">
                  Warm-up: {selected.warmup_note}
                </p>
              )}
              {selected.stretch_note && (
                <p className="mt-3 text-xs leading-relaxed text-grit-dim">
                  Mobility: {selected.stretch_note}
                </p>
              )}
              <a
                className="press mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-grit text-xs font-bold"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(selected.youtube_query)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={hapticSelection}
              >
                Find form demonstrations on YouTube ↗
              </a>
              <section className="mt-5 border-t border-grit pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
                <h3 className="display text-xl font-bold uppercase">Add to your week</h3>
                <p className="mt-1 break-words text-xs leading-relaxed text-grit-dim">
                  {active
                    ? `Editing ${active.name}, your active programme.`
                    : "Add to your training schedule."}{" "}
                  {selected.plannedSets} sets · {selected.plannedReps}. You can adjust these in
                  Plan.
                </p>
                {hasPlan ? (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {DAYS.map((day) => {
                      const added = growthExerciseIsOnDay(state, day, selected.id, selected.name);
                      return (
                        <button
                          key={day}
                          disabled={added}
                          aria-label={`${added ? "Already on" : "Add to"} ${day}`}
                          className="press flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl border border-grit text-[11px] font-bold disabled:text-emerald-400"
                          onClick={() => addToDay(selected, day)}
                        >
                          {added ? <Check size={12} /> : <Plus size={12} />}
                          {day}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-grit-dim">
                    Complete your plan setup first, then choose a day here.
                  </p>
                )}
              </section>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        hapticSelection();
        onClick();
      }}
      className={`press min-h-11 w-full min-w-0 break-words rounded-xl border px-2 py-2 text-[10px] font-bold uppercase ${active ? "border-accent-red bg-accent-red text-black" : "border-grit bg-grit-card text-grit"}`}
    >
      {children}
    </button>
  );
}
