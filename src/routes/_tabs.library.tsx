import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { listExercises, type LibraryExercise } from "@/lib/library.functions";
import { libraryExerciseToExercise } from "@/lib/exercise-library";
import { defaultSchedule } from "@/lib/calc";
import { useAppState } from "@/lib/storage";
import type { DayKey } from "@/lib/types";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { VideoModal } from "@/components/VideoModal";

export const Route = createFileRoute("/_tabs/library")({
  head: () => ({ meta: [{ title: "DEADSET — Library" }] }),
  component: LibraryPage,
});

const CATEGORIES = ["ALL", "PUSH", "PULL", "LEGS", "CORE"] as const;
const EQUIPMENT = [
  "ALL",
  "BARBELL",
  "DUMBBELL",
  "CABLE",
  "MACHINE",
  "BODYWEIGHT",
  "BANDS",
  "KETTLEBELL",
] as const;
const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function LibraryPage() {
  const [state, set] = useAppState();
  const list = listExercises;

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("ALL");
  const [equipment, setEquipment] = useState<(typeof EQUIPMENT)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<LibraryExercise | null>(null);
  const [video, setVideo] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exercises", category, equipment, search],
    queryFn: () =>
      list({
        data: {
          category: category === "ALL" ? undefined : category,
          equipment: equipment === "ALL" ? undefined : equipment,
          search: search || undefined,
          limit: 2000,
        },
      }),
  });

  const exercises = useMemo(() => {
    const unique = new Map<string, LibraryExercise>();
    for (const exercise of data?.exercises ?? []) {
      const key = `${exercise.name.trim().toLocaleLowerCase()}::${exercise.equipment
        .trim()
        .toLocaleLowerCase()}`;
      if (!unique.has(key)) unique.set(key, exercise);
    }
    return [...unique.values()];
  }, [data?.exercises]);

  function addToDay(exercise: LibraryExercise, dayKey: DayKey) {
    const saved = libraryExerciseToExercise(exercise);
    set((current) => {
      const schedule =
        current.schedule ?? (current.profile ? defaultSchedule(current.profile) : null);
      if (!schedule) return current;
      const day = schedule[dayKey];
      if (day.exerciseIds.includes(saved.id)) return current;
      return {
        ...current,
        savedExercises: current.savedExercises.some((item) => item.id === saved.id)
          ? current.savedExercises
          : [...current.savedExercises, saved],
        schedule: {
          ...schedule,
          [dayKey]: {
            ...day,
            label: day.label === "REST" ? saved.muscleGroup : day.label,
            exerciseIds: [...day.exerciseIds, saved.id],
          },
        },
      };
    });
    toast.success(`${exercise.name} added to ${dayKey}`);
  }

  return (
    <div className="deadset-page px-4 pt-6">
      <div className="flex items-end justify-between mb-1">
        <h1 className="label-cap text-grit text-2xl">Library</h1>
        <span className="label-cap text-grit-dim text-xs">
          {isLoading ? "—" : exercises.length} moves
        </span>
      </div>
      <p className="text-grit-dim text-xs label-cap mb-4">Tap to view details</p>

      <input
        placeholder="SEARCH"
        defaultValue={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 mb-3 text-sm uppercase tracking-wider"
        style={{ background: "#1a1a1a", color: "#f5f5f0", border: "1px solid #2a2a2a" }}
      />

      <div className="flex gap-2 overflow-x-auto mb-2 -mx-4 px-4 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="px-3 py-1.5 text-[11px] label-cap whitespace-nowrap"
            style={{
              background: category === c ? "#e63222" : "#1a1a1a",
              color: category === c ? "#0a0a0a" : "#f5f5f0",
              border: "1px solid #2a2a2a",
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto mb-4 -mx-4 px-4 pb-1">
        {EQUIPMENT.map((e) => (
          <button
            key={e}
            onClick={() => setEquipment(e)}
            className="px-3 py-1.5 text-[11px] label-cap whitespace-nowrap"
            style={{
              background: equipment === e ? "#e63222" : "#0a0a0a",
              color: equipment === e ? "#0a0a0a" : "#f5f5f0",
              border: "1px solid #2a2a2a",
            }}
          >
            {e}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-grit-dim text-sm label-cap">Loading…</p>
      ) : (
        <ul className="stagger space-y-2 pb-6">
          {exercises.map((ex) => (
            <li key={ex.id}>
              <button
                onClick={() => setOpen(ex)}
                className="w-full text-left px-3 py-3 flex items-center justify-between gap-3"
                style={{ background: "#1a1a1a", border: "1px solid #222" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="label-cap text-sm text-grit truncate">{ex.name}</div>
                  <div className="text-[10px] label-cap text-grit-dim mt-0.5">
                    {ex.primary_muscles.slice(0, 3).join(" · ")} · {ex.equipment}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 4,
                        height: 16,
                        background: d <= ex.difficulty ? "#e63222" : "#2a2a2a",
                      }}
                    />
                  ))}
                </div>
              </button>
            </li>
          ))}
          {exercises.length === 0 && (
            <li className="text-grit-dim text-sm label-cap text-center py-8">No matches.</li>
          )}
        </ul>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setOpen(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-5 max-h-[88vh] overflow-y-auto"
            style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="label-cap text-grit text-lg pr-3">{open.name}</h2>
              <button onClick={() => setOpen(null)} className="label-cap text-grit-dim text-sm">
                CLOSE
              </button>
            </div>
            <div className="text-[10px] label-cap text-grit-dim mb-3">
              {open.category} · {open.equipment} · DIFFICULTY {open.difficulty}/5
            </div>

            <MuscleDiagram
              primary={open.primary_muscles}
              secondary={open.secondary_muscles}
              size={220}
            />

            <div className="mt-4">
              <div className="label-cap text-xs text-grit-dim mb-1">PRIMARY</div>
              <div className="text-sm text-grit mb-2">{open.primary_muscles.join(", ")}</div>
              {open.secondary_muscles.length > 0 && (
                <>
                  <div className="label-cap text-xs text-grit-dim mb-1">SECONDARY</div>
                  <div className="text-sm text-grit mb-2">{open.secondary_muscles.join(", ")}</div>
                </>
              )}
              <div className="label-cap text-xs text-grit-dim mt-3 mb-1">FORM</div>
              <p className="text-sm text-grit leading-relaxed">{open.instructions}</p>
              <div
                className="mt-3 p-3"
                style={{ background: "#1a1a1a", borderLeft: "3px solid #e63222" }}
              >
                <div className="label-cap text-[10px] text-grit-dim mb-1">PRO TIP</div>
                <p className="text-sm text-grit">{open.pro_tip}</p>
              </div>
              {open.warmup_note && (
                <p className="text-xs text-grit-dim mt-3">
                  <span className="label-cap text-grit">WARM-UP:</span> {open.warmup_note}
                </p>
              )}
              {open.stretch_note && (
                <p className="text-xs text-grit-dim mt-1">
                  <span className="label-cap text-grit">STRETCH:</span> {open.stretch_note}
                </p>
              )}

              <button
                onClick={() => setVideo(open.youtube_query)}
                className="w-full mt-5 py-3 label-cap text-sm"
                style={{ background: "#e63222", color: "#0a0a0a" }}
              >
                Watch Form Video
              </button>

              {state.profile && (
                <div className="mt-5 border-t border-grit pt-4">
                  <div className="label-cap text-xs text-grit-dim mb-2">ADD TO YOUR WEEK</div>
                  <div className="grid grid-cols-4 gap-2">
                    {DAYS.map((dayKey) => {
                      const added = state.schedule?.[dayKey]?.exerciseIds.includes(open.id);
                      return (
                        <button
                          key={dayKey}
                          onClick={() => addToDay(open, dayKey)}
                          disabled={added}
                          className="flex min-h-11 items-center justify-center gap-1 border border-grit text-[10px] font-black uppercase text-grit disabled:text-emerald-400"
                        >
                          {added ? <Check size={12} /> : <Plus size={12} />}
                          {dayKey}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {video && <VideoModal query={video} onClose={() => setVideo(null)} />}
    </div>
  );
}
