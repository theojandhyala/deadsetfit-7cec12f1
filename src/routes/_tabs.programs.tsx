import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppState } from "@/lib/storage";
import type { DayKey, Program, SplitType } from "@/lib/types";
import { Plus, Check, Trash2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_tabs/programs")({
  head: () => ({ meta: [{ title: "GRIT — Programs" }] }),
  component: ProgramsPage,
});

const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const SPLIT_TEMPLATES: { type: SplitType; name: string; days: Record<DayKey, string> }[] = [
  { type: "PPL", name: "PUSH / PULL / LEGS", days: { MON: "PUSH", TUE: "PULL", WED: "LEGS", THU: "PUSH", FRI: "PULL", SAT: "LEGS", SUN: "REST" } },
  { type: "UPPER_LOWER", name: "UPPER / LOWER", days: { MON: "UPPER", TUE: "LOWER", WED: "REST", THU: "UPPER", FRI: "LOWER", SAT: "REST", SUN: "REST" } },
  { type: "BRO", name: "BRO SPLIT", days: { MON: "CHEST", TUE: "BACK", WED: "LEGS", THU: "SHOULDERS", FRI: "ARMS", SAT: "REST", SUN: "REST" } },
  { type: "FULL_BODY", name: "FULL BODY 3x", days: { MON: "FULL BODY", TUE: "REST", WED: "FULL BODY", THU: "REST", FRI: "FULL BODY", SAT: "REST", SUN: "REST" } },
  { type: "CUSTOM", name: "CUSTOM (BLANK)", days: { MON: "REST", TUE: "REST", WED: "REST", THU: "REST", FRI: "REST", SAT: "REST", SUN: "REST" } },
];

function ProgramsPage() {
  const [state, set] = useAppState();

  function create(template: (typeof SPLIT_TEMPLATES)[number]) {
    const id = crypto.randomUUID();
    const program: Program = {
      id,
      name: template.name,
      splitType: template.type,
      createdAt: new Date().toISOString(),
      days: Object.fromEntries(
        DAYS.map((d) => [d, { label: template.days[d], items: [] }]),
      ) as Program["days"],
    };
    set((s) => ({ ...s, programs: [...s.programs, program], activeProgramId: s.activeProgramId ?? id }));
  }

  function activate(id: string) {
    set((s) => ({ ...s, activeProgramId: id }));
  }
  function remove(id: string) {
    if (!confirm("Delete this program?")) return;
    set((s) => ({
      ...s,
      programs: s.programs.filter((p) => p.id !== id),
      activeProgramId: s.activeProgramId === id ? null : s.activeProgramId,
    }));
  }

  return (
    <div className="px-5 pt-6 pb-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="display text-3xl font-extrabold uppercase text-grit">Programs</h1>
        <Link to="/train" className="label-cap text-grit-dim text-xs">DONE</Link>
      </div>
      <p className="label-cap text-grit-dim text-xs mb-5">Build your own splits</p>

      {state.programs.length === 0 && (
        <div className="bg-grit-card border border-grit p-6 text-center mb-5">
          <p className="label-cap text-grit-dim text-xs mb-1">No programs yet</p>
          <p className="text-sm text-grit">Create one below to start building.</p>
        </div>
      )}

      <ul className="space-y-2 mb-6">
        {state.programs.map((p) => {
          const filled = DAYS.reduce((a, d) => a + p.days[d].items.length, 0);
          const trainingDays = DAYS.filter((d) => p.days[d].label !== "REST").length;
          const isActive = p.id === state.activeProgramId;
          return (
            <li key={p.id} className="bg-grit-card border" style={{ borderColor: isActive ? "#e63222" : "#262626" }}>
              <div className="flex items-stretch">
                <Link
                  to="/programs/$programId"
                  params={{ programId: p.id }}
                  className="flex-1 p-4 min-w-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isActive && <span className="text-[9px] px-1.5 py-0.5 bg-accent-red text-white label-cap">ACTIVE</span>}
                    <span className="display text-lg font-extrabold uppercase text-grit truncate">{p.name}</span>
                  </div>
                  <p className="label-cap text-grit-dim text-[10px]">
                    {trainingDays} DAYS · {filled} EXERCISES
                  </p>
                </Link>
                <div className="flex flex-col border-l border-grit">
                  {!isActive && (
                    <button onClick={() => activate(p.id)} className="px-3 flex-1 flex items-center justify-center" title="Set active">
                      <Check size={18} className="text-grit-dim" />
                    </button>
                  )}
                  <button onClick={() => remove(p.id)} className="px-3 flex-1 flex items-center justify-center border-t border-grit" title="Delete">
                    <Trash2 size={16} className="text-grit-dim" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="label-cap text-grit-dim text-xs mb-2">+ New from template</p>
      <ul className="space-y-2">
        {SPLIT_TEMPLATES.map((t) => (
          <li key={t.type}>
            <button
              onClick={() => create(t)}
              className="w-full bg-grit-card border border-grit p-4 flex items-center justify-between text-left"
            >
              <div>
                <div className="display uppercase font-extrabold text-grit text-base">{t.name}</div>
                <div className="label-cap text-grit-dim text-[10px] mt-0.5">
                  {DAYS.filter((d) => t.days[d] !== "REST").length} training days
                </div>
              </div>
              <Plus size={18} className="text-accent-red" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
