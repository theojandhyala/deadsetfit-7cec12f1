import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Sparkles,
  Loader2,
  Search,
} from "lucide-react";
import { useAppState } from "@/lib/storage";
import { listExercises, type LibraryExercise } from "@/lib/library.functions";
import { smartSuggest } from "@/lib/programs.functions";
import type { DayKey, Program, ProgramExerciseRef } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_tabs/programs/$programId")({
  head: () => ({ meta: [{ title: "DEADSET — Builder" }] }),
  component: BuilderPage,
});

const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const SHORT: Record<DayKey, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function toRef(ex: LibraryExercise): ProgramExerciseRef {
  return {
    id: ex.id,
    name: ex.name,
    equipment: ex.equipment,
    primary_muscles: ex.primary_muscles,
    youtube_query: ex.youtube_query,
    sets: 3,
    reps: ex.is_compound ? "5-8" : "8-12",
  };
}

function BuilderPage() {
  const { programId } = Route.useParams();
  const navigate = useNavigate();
  const [state, set] = useAppState();
  const program = state.programs.find((p) => p.id === programId);

  const [day, setDay] = useState<DayKey>("MON");
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);

  const list = useServerFn(listExercises);
  const suggest = useServerFn(smartSuggest);

  const allQ = useQuery({
    queryKey: ["lib-all"],
    queryFn: () => list({ data: { limit: 400 } }),
  });
  const exercises = allQ.data?.exercises ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises.slice(0, 80);
    return exercises
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.primary_muscles.some((m) => m.includes(q)) ||
          e.equipment.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [exercises, search]);

  const suggestMut = useMutation({
    mutationFn: async () => {
      if (!program || !state.profile) throw new Error("No program");
      return suggest({
        data: {
          goal: state.profile.goal,
          experience: state.profile.experience,
          days: DAYS.map((d) => ({
            label: program.days[d].label,
            items: program.days[d].items.map((i) => ({
              name: i.name,
              primary_muscles: i.primary_muscles,
            })),
          })),
          candidates: exercises.slice(0, 200).map((e) => ({
            id: e.id,
            name: e.name,
            primary_muscles: e.primary_muscles,
          })),
        },
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Suggest failed"),
    onSuccess: () => setSuggestOpen(true),
  });

  if (!program) {
    return (
      <div className="px-5 pt-10 text-center">
        <p className="label-cap text-grit-dim">Program not found</p>
        <Link to="/programs" className="btn-grit mt-4 inline-block">
          Back
        </Link>
      </div>
    );
  }

  function update(fn: (p: Program) => Program) {
    set((s) => ({
      ...s,
      programs: s.programs.map((p) => (p.id === programId ? fn(p) : p)),
    }));
  }

  function setLabel(label: string) {
    update((p) => ({
      ...p,
      days: { ...p.days, [day]: { ...p.days[day], label: label.toUpperCase() } },
    }));
  }
  function rename(name: string) {
    update((p) => ({ ...p, name: name.toUpperCase().slice(0, 40) }));
  }
  function addExercise(ex: LibraryExercise) {
    update((p) => {
      if (p.days[day].items.some((i) => i.id === ex.id)) return p;
      return {
        ...p,
        days: { ...p.days, [day]: { ...p.days[day], items: [...p.days[day].items, toRef(ex)] } },
      };
    });
  }
  function addCustomExercise(name: string) {
    const clean = name.trim().slice(0, 60);
    if (clean.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    const ref: ProgramExerciseRef = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: clean,
      equipment: "CUSTOM",
      primary_muscles: [],
      youtube_query: clean,
      sets: 3,
      reps: "8-12",
    };
    update((p) => ({
      ...p,
      days: { ...p.days, [day]: { ...p.days[day], items: [...p.days[day].items, ref] } },
    }));
    toast.success(`Added "${clean}"`);
    setSearch("");
  }
  function removeItem(id: string) {
    update((p) => ({
      ...p,
      days: {
        ...p.days,
        [day]: { ...p.days[day], items: p.days[day].items.filter((i) => i.id !== id) },
      },
    }));
  }
  function move(id: string, dir: -1 | 1) {
    update((p) => {
      const items = [...p.days[day].items];
      const i = items.findIndex((x) => x.id === id);
      if (i < 0) return p;
      const j = i + dir;
      if (j < 0 || j >= items.length) return p;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...p, days: { ...p.days, [day]: { ...p.days[day], items } } };
    });
  }
  function setSetsReps(id: string, sets: number, reps: string) {
    update((p) => ({
      ...p,
      days: {
        ...p.days,
        [day]: {
          ...p.days[day],
          items: p.days[day].items.map((i) => (i.id === id ? { ...i, sets, reps } : i)),
        },
      },
    }));
  }
  function applySuggestion(suggestedIds: string[]) {
    const refs = suggestedIds
      .map((id) => exercises.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => toRef(e as LibraryExercise));
    update((p) => ({
      ...p,
      days: {
        ...p.days,
        [day]: {
          ...p.days[day],
          items: [
            ...p.days[day].items,
            ...refs.filter((r) => !p.days[day].items.some((i) => i.id === r.id)),
          ],
        },
      },
    }));
    toast.success(`Added ${refs.length} to ${day}`);
  }
  function activateAndTrain() {
    set((s) => ({ ...s, activeProgramId: programId }));
    navigate({ to: "/train" });
  }

  const d = program.days[day];

  return (
    <div className="pb-8" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-3 flex items-center gap-3">
        <Link to="/programs" className="-ml-1 p-1">
          <ArrowLeft size={20} className="text-grit" />
        </Link>
        <input
          value={program.name}
          onChange={(e) => rename(e.target.value)}
          className="flex-1 bg-transparent display text-xl font-extrabold uppercase text-grit outline-none"
        />
      </header>

      {/* Day strip */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {DAYS.map((k) => {
            const active = k === day;
            const lbl = program.days[k].label.split(" — ")[0];
            return (
              <button
                key={k}
                onClick={() => setDay(k)}
                className="flex-shrink-0 min-w-[64px] p-2 border text-center"
                style={{
                  borderColor: active ? "#E10600" : "#262626",
                  background: active ? "#1a1a1a" : "transparent",
                }}
              >
                <div className="label-cap text-[10px]">{SHORT[k]}</div>
                <div className="text-[10px] font-bold uppercase mt-1 text-grit truncate">{lbl}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day label input */}
      <div className="px-5 mb-4">
        <label className="label-cap text-grit-dim text-[10px] block mb-1">Day Label</label>
        <input value={d.label} onChange={(e) => setLabel(e.target.value)} className="input-grit" />
      </div>

      {/* Actions */}
      <div className="px-5 flex gap-2 mb-4">
        <button onClick={() => setPicker(true)} className="btn-grit flex-1">
          <Plus size={16} className="mr-1 inline -mt-0.5" /> Add Exercise
        </button>
        <button
          onClick={() => suggestMut.mutate()}
          disabled={suggestMut.isPending}
          className="px-4 border border-accent-red text-accent-red label-cap text-xs flex items-center"
        >
          {suggestMut.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
        </button>
      </div>

      {/* Items */}
      <div className="px-5 space-y-2">
        {d.items.length === 0 && (
          <div className="bg-grit-card border border-grit p-6 text-center">
            <p className="label-cap text-grit-dim text-xs">No exercises for {SHORT[day]}</p>
          </div>
        )}
        {d.items.map((it, idx) => (
          <div key={it.id} className="bg-grit-card border border-grit p-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col">
                <button
                  onClick={() => move(it.id, -1)}
                  disabled={idx === 0}
                  className="p-1 disabled:opacity-30"
                >
                  <ChevronUp size={14} className="text-grit-dim" />
                </button>
                <button
                  onClick={() => move(it.id, 1)}
                  disabled={idx === d.items.length - 1}
                  className="p-1 disabled:opacity-30"
                >
                  <ChevronDown size={14} className="text-grit-dim" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="display uppercase font-extrabold text-grit text-sm truncate">
                  {it.name}
                </div>
                <div className="text-[10px] label-cap text-grit-dim mt-0.5">
                  {it.equipment} · {it.primary_muscles.slice(0, 3).join(" · ")}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    inputMode="numeric"
                    value={it.sets}
                    onChange={(e) => setSetsReps(it.id, Number(e.target.value) || 0, it.reps)}
                    className="w-14 px-2 py-1 text-xs"
                    style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#f5f5f0" }}
                  />
                  <span className="label-cap text-grit-dim text-[10px] self-center">SETS ×</span>
                  <input
                    value={it.reps}
                    onChange={(e) => setSetsReps(it.id, it.sets, e.target.value)}
                    className="flex-1 px-2 py-1 text-xs"
                    style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#f5f5f0" }}
                  />
                  <span className="label-cap text-grit-dim text-[10px] self-center">REPS</span>
                </div>
              </div>
              <button onClick={() => removeItem(it.id)} className="p-1">
                <X size={16} className="text-grit-dim" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 mt-6">
        <button onClick={activateAndTrain} className="btn-grit w-full">
          Set Active & Train
        </button>
      </div>

      {/* Picker modal */}
      {picker && (
        <div
          className="fixed inset-0 z-[100] flex items-end"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setPicker(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto bg-grit-card border-t border-accent-red p-4 max-h-[85vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-3">
              <p className="display uppercase text-grit font-extrabold text-lg">
                Add to {SHORT[day]}
              </p>
              <button onClick={() => setPicker(false)} className="label-cap text-grit-dim text-xs">
                CLOSE
              </button>
            </div>
            <div className="relative mb-3">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-grit-dim"
              />
              <input
                autoFocus
                placeholder="SEARCH NAME OR MUSCLE"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs uppercase tracking-wider"
                style={{ background: "#0a0a0a", color: "#f5f5f0", border: "1px solid #2a2a2a" }}
              />
            </div>
            <div className="overflow-y-auto flex-1 -mx-1 px-1">
              {search.trim().length >= 2 && (
                <button
                  onClick={() => addCustomExercise(search)}
                  className="w-full text-left px-3 py-2 mb-2 flex items-center justify-between gap-2 border-2 border-dashed"
                  style={{ background: "#0a0a0a", borderColor: "#E10600" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="label-cap text-xs text-accent-red truncate">
                      + CREATE "{search.trim()}"
                    </div>
                    <div className="text-[9px] label-cap text-grit-dim mt-0.5">
                      Type your own exercise
                    </div>
                  </div>
                  <Plus size={14} className="text-accent-red" />
                </button>
              )}
              {allQ.isLoading && (
                <p className="label-cap text-grit-dim text-xs py-4 text-center">Loading library…</p>
              )}
              <ul className="space-y-1.5">
                {filtered.map((ex) => {
                  const added = d.items.some((i) => i.id === ex.id);
                  return (
                    <li key={ex.id}>
                      <button
                        onClick={() => {
                          addExercise(ex);
                        }}
                        disabled={added}
                        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2"
                        style={{
                          background: "#0a0a0a",
                          border: `1px solid ${added ? "#E10600" : "#2a2a2a"}`,
                          opacity: added ? 0.6 : 1,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="label-cap text-xs text-grit truncate">{ex.name}</div>
                          <div className="text-[9px] label-cap text-grit-dim mt-0.5">
                            {ex.primary_muscles.slice(0, 3).join(" · ")} · {ex.equipment}
                          </div>
                        </div>
                        {added ? (
                          <span className="text-[9px] label-cap text-accent-red">ADDED</span>
                        ) : (
                          <Plus size={14} className="text-accent-red" />
                        )}
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && !allQ.isLoading && search.trim().length < 2 && (
                  <li className="label-cap text-grit-dim text-xs text-center py-6">
                    Type to search or create
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Smart Suggest results */}
      {suggestOpen && suggestMut.data && (
        <div
          className="fixed inset-0 z-[100] flex items-end"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setSuggestOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto bg-grit-card border-t border-accent-red p-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-3">
              <p className="display uppercase text-grit font-extrabold text-lg">
                <Sparkles size={16} className="inline -mt-1 mr-1 text-accent-red" /> Smart Suggest
              </p>
              <button
                onClick={() => setSuggestOpen(false)}
                className="label-cap text-grit-dim text-xs"
              >
                CLOSE
              </button>
            </div>
            {suggestMut.data.gaps.length === 0 ? (
              <p className="text-sm text-grit-dim label-cap">
                No major gaps detected. Solid program.
              </p>
            ) : (
              <ul className="space-y-3">
                {suggestMut.data.gaps.map((g, i) => {
                  const refs = g.suggested_ids
                    .map((id) => exercises.find((e) => e.id === id))
                    .filter(Boolean) as LibraryExercise[];
                  return (
                    <li
                      key={i}
                      className="border border-grit p-3"
                      style={{ background: "#0a0a0a" }}
                    >
                      <div className="label-cap text-[10px] text-accent-red mb-1">
                        {g.day} · {g.muscle}
                      </div>
                      <p className="text-sm text-grit mb-2">{g.reason}</p>
                      <div className="space-y-1.5">
                        {refs.map((ex) => (
                          <div key={ex.id} className="text-xs text-grit-dim">
                            + {ex.name}
                          </div>
                        ))}
                      </div>
                      {refs.length > 0 && (
                        <button
                          onClick={() => applySuggestion(g.suggested_ids)}
                          className="mt-2 w-full py-2 label-cap text-xs"
                          style={{ background: "#E10600", color: "#0a0a0a" }}
                        >
                          ADD TO {day}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
