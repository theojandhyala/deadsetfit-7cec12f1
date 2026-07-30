import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAppState } from "@/lib/storage";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import { askConfirm } from "@/lib/confirm";
import type { DayKey, Program, ProgramExerciseRef, SplitType } from "@/lib/types";
import { Plus, Check, Trash2, Lock, X } from "lucide-react";

export const Route = createFileRoute("/_tabs/programs")({
  head: () => ({ meta: [{ title: "DEADSET — Programs" }] }),
  component: ProgramsPage,
});

const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const SPLIT_TEMPLATES: { type: SplitType; name: string; days: Record<DayKey, string> }[] = [
  {
    type: "PPL",
    name: "PUSH / PULL / LEGS",
    days: {
      MON: "PUSH",
      TUE: "PULL",
      WED: "LEGS",
      THU: "PUSH",
      FRI: "PULL",
      SAT: "LEGS",
      SUN: "REST",
    },
  },
  {
    type: "UPPER_LOWER",
    name: "UPPER / LOWER",
    days: {
      MON: "UPPER",
      TUE: "LOWER",
      WED: "REST",
      THU: "UPPER",
      FRI: "LOWER",
      SAT: "REST",
      SUN: "REST",
    },
  },
  {
    type: "BRO",
    name: "BRO SPLIT",
    days: {
      MON: "CHEST",
      TUE: "BACK",
      WED: "LEGS",
      THU: "SHOULDERS",
      FRI: "ARMS",
      SAT: "REST",
      SUN: "REST",
    },
  },
  {
    type: "FULL_BODY",
    name: "FULL BODY 3x",
    days: {
      MON: "FULL BODY",
      TUE: "REST",
      WED: "FULL BODY",
      THU: "REST",
      FRI: "FULL BODY",
      SAT: "REST",
      SUN: "REST",
    },
  },
  {
    type: "CUSTOM",
    name: "CUSTOM (BLANK)",
    days: {
      MON: "REST",
      TUE: "REST",
      WED: "REST",
      THU: "REST",
      FRI: "REST",
      SAT: "REST",
      SUN: "REST",
    },
  },
];

type FeaturedExercise = {
  name: string;
  equipment: string;
  muscles: string[];
  sets: number;
  reps: string;
};

type FeaturedDay = { label: string; items: FeaturedExercise[] };

const fx = (
  name: string,
  equipment: string,
  muscles: string[],
  sets: number,
  reps: string,
): FeaturedExercise => ({ name, equipment, muscles, sets, reps });

const REST_DAY: FeaturedDay = { label: "REST", items: [] };

const SL_WORKOUT_A: FeaturedDay = {
  label: "WORKOUT A",
  items: [
    fx("Squat", "barbell", ["quads", "glutes"], 5, "5"),
    fx("Bench Press", "barbell", ["chest", "triceps"], 5, "5"),
    fx("Barbell Row", "barbell", ["lats", "upper back"], 5, "5"),
    fx("Dip", "bodyweight", ["chest", "triceps"], 3, "8-10"),
    fx("Plank", "bodyweight", ["abs"], 3, "60s"),
  ],
};

const SL_WORKOUT_B: FeaturedDay = {
  label: "WORKOUT B",
  items: [
    fx("Squat", "barbell", ["quads", "glutes"], 5, "5"),
    fx("Overhead Press", "barbell", ["shoulders", "triceps"], 5, "5"),
    fx("Deadlift", "barbell", ["hamstrings", "glutes", "lower back"], 1, "5"),
    fx("Chin-Up", "bodyweight", ["lats", "biceps"], 3, "8-10"),
    fx("Hanging Knee Raise", "bodyweight", ["abs"], 3, "10-15"),
  ],
};

const ARNOLD_CHEST_BACK: FeaturedDay = {
  label: "CHEST/BACK",
  items: [
    fx("Bench Press", "barbell", ["chest", "triceps"], 4, "8-12"),
    fx("Incline Bench Press", "barbell", ["chest", "shoulders"], 4, "8-12"),
    fx("Dumbbell Flye", "dumbbell", ["chest"], 3, "10-12"),
    fx("Wide-Grip Pull-Up", "bodyweight", ["lats", "upper back"], 4, "8-12"),
    fx("Barbell Row", "barbell", ["lats", "upper back"], 4, "8-12"),
    fx("Dumbbell Pullover", "dumbbell", ["chest", "lats"], 3, "10-12"),
  ],
};

const ARNOLD_SHOULDERS_ARMS: FeaturedDay = {
  label: "SHOULDERS/ARMS",
  items: [
    fx("Seated Dumbbell Press", "dumbbell", ["shoulders"], 4, "8-12"),
    fx("Dumbbell Lateral Raise", "dumbbell", ["shoulders"], 4, "10-12"),
    fx("Rear Delt Flye", "dumbbell", ["rear delts"], 3, "10-12"),
    fx("Barbell Curl", "barbell", ["biceps"], 4, "8-12"),
    fx("Incline Dumbbell Curl", "dumbbell", ["biceps"], 3, "10-12"),
    fx("Close-Grip Bench Press", "barbell", ["triceps", "chest"], 4, "8-12"),
    fx("Triceps Pushdown", "cable", ["triceps"], 3, "10-12"),
  ],
};

const ARNOLD_LEGS: FeaturedDay = {
  label: "LEGS",
  items: [
    fx("Squat", "barbell", ["quads", "glutes"], 4, "8-12"),
    fx("Leg Press", "machine", ["quads", "glutes"], 4, "10-12"),
    fx("Romanian Deadlift", "barbell", ["hamstrings", "glutes"], 4, "8-12"),
    fx("Barbell Lunge", "barbell", ["quads", "glutes"], 3, "10-12"),
    fx("Lying Leg Curl", "machine", ["hamstrings"], 4, "10-12"),
    fx("Standing Calf Raise", "machine", ["calves"], 5, "12-15"),
  ],
};

/** nSuns tier-1 wave: 5,3,1+ then back-off triples and fives (last set AMRAP). */
const NSUNS_T1 = "5,3,1+,3x3,3x5+";
/** nSuns tier-2 volume wave. */
const NSUNS_T2 = "5,5,3,5,7,4,6,8";

const FEATURED_PROGRAMS: {
  name: string;
  tagline: string;
  level: string;
  days: Record<DayKey, FeaturedDay>;
}[] = [
  {
    name: "5/3/1 BBB",
    tagline: "Wendler's classic strength builder",
    level: "INTERMEDIATE",
    days: {
      MON: {
        label: "OHP DAY",
        items: [
          fx("Overhead Press", "barbell", ["shoulders", "triceps"], 3, "5,3,1+"),
          fx("Overhead Press (BBB)", "barbell", ["shoulders", "triceps"], 5, "10"),
          fx("Chin-Up", "bodyweight", ["lats", "biceps"], 5, "10"),
          fx("Face Pull", "cable", ["rear delts", "upper back"], 3, "15-20"),
          fx("Dumbbell Lateral Raise", "dumbbell", ["shoulders"], 3, "12-15"),
        ],
      },
      TUE: {
        label: "DEADLIFT DAY",
        items: [
          fx("Deadlift", "barbell", ["hamstrings", "glutes", "lower back"], 3, "5,3,1+"),
          fx("Deadlift (BBB)", "barbell", ["hamstrings", "glutes", "lower back"], 5, "10"),
          fx("Barbell Row", "barbell", ["lats", "upper back"], 4, "8-10"),
          fx("Hanging Leg Raise", "bodyweight", ["abs"], 5, "10-15"),
          fx("Back Extension", "bodyweight", ["lower back", "glutes"], 3, "12-15"),
        ],
      },
      WED: REST_DAY,
      THU: {
        label: "BENCH DAY",
        items: [
          fx("Bench Press", "barbell", ["chest", "triceps"], 3, "5,3,1+"),
          fx("Bench Press (BBB)", "barbell", ["chest", "triceps"], 5, "10"),
          fx("Dumbbell Row", "dumbbell", ["lats", "upper back"], 5, "10"),
          fx("Incline Dumbbell Press", "dumbbell", ["chest", "shoulders"], 3, "10-12"),
          fx("Triceps Pushdown", "cable", ["triceps"], 3, "12-15"),
        ],
      },
      FRI: {
        label: "SQUAT DAY",
        items: [
          fx("Squat", "barbell", ["quads", "glutes"], 3, "5,3,1+"),
          fx("Squat (BBB)", "barbell", ["quads", "glutes"], 5, "10"),
          fx("Leg Curl", "machine", ["hamstrings"], 3, "10-12"),
          fx("Ab Wheel Rollout", "bodyweight", ["abs"], 3, "10-15"),
          fx("Standing Calf Raise", "machine", ["calves"], 4, "12-15"),
        ],
      },
      SAT: REST_DAY,
      SUN: REST_DAY,
    },
  },
  {
    name: "STRONGLIFTS 5x5",
    tagline: "Linear progression for beginners",
    level: "BEGINNER",
    days: {
      MON: SL_WORKOUT_A,
      TUE: REST_DAY,
      WED: SL_WORKOUT_B,
      THU: REST_DAY,
      FRI: SL_WORKOUT_A,
      SAT: REST_DAY,
      SUN: REST_DAY,
    },
  },
  {
    name: "PHUL",
    tagline: "Power Hypertrophy Upper Lower",
    level: "INTERMEDIATE",
    days: {
      MON: {
        label: "UPPER POWER",
        items: [
          fx("Bench Press", "barbell", ["chest", "triceps"], 4, "3-5"),
          fx("Barbell Row", "barbell", ["lats", "upper back"], 4, "3-5"),
          fx("Incline Dumbbell Press", "dumbbell", ["chest", "shoulders"], 3, "6-10"),
          fx("Lat Pulldown", "cable", ["lats"], 3, "6-10"),
          fx("Overhead Press", "barbell", ["shoulders", "triceps"], 3, "5-8"),
          fx("Barbell Curl", "barbell", ["biceps"], 3, "6-10"),
          fx("Skullcrusher", "barbell", ["triceps"], 3, "6-10"),
        ],
      },
      TUE: {
        label: "LOWER POWER",
        items: [
          fx("Squat", "barbell", ["quads", "glutes"], 4, "3-5"),
          fx("Deadlift", "barbell", ["hamstrings", "glutes", "lower back"], 3, "3-5"),
          fx("Leg Press", "machine", ["quads", "glutes"], 4, "10-15"),
          fx("Leg Curl", "machine", ["hamstrings"], 4, "6-10"),
          fx("Standing Calf Raise", "machine", ["calves"], 4, "6-10"),
        ],
      },
      WED: REST_DAY,
      THU: {
        label: "UPPER HYPER",
        items: [
          fx("Incline Bench Press", "barbell", ["chest", "shoulders"], 4, "8-12"),
          fx("Dumbbell Flye", "dumbbell", ["chest"], 3, "8-12"),
          fx("Seated Cable Row", "cable", ["lats", "upper back"], 4, "8-12"),
          fx("One-Arm Dumbbell Row", "dumbbell", ["lats", "upper back"], 3, "8-12"),
          fx("Dumbbell Lateral Raise", "dumbbell", ["shoulders"], 3, "8-12"),
          fx("Incline Dumbbell Curl", "dumbbell", ["biceps"], 3, "8-12"),
          fx("Cable Triceps Extension", "cable", ["triceps"], 3, "8-12"),
        ],
      },
      FRI: {
        label: "LOWER HYPER",
        items: [
          fx("Front Squat", "barbell", ["quads"], 4, "8-12"),
          fx("Barbell Lunge", "barbell", ["quads", "glutes"], 3, "8-12"),
          fx("Leg Extension", "machine", ["quads"], 4, "10-15"),
          fx("Lying Leg Curl", "machine", ["hamstrings"], 4, "10-15"),
          fx("Seated Calf Raise", "machine", ["calves"], 4, "8-12"),
          fx("Standing Calf Raise", "machine", ["calves"], 3, "8-12"),
        ],
      },
      SAT: REST_DAY,
      SUN: REST_DAY,
    },
  },
  {
    name: "ARNOLD SPLIT",
    tagline: "6-day high volume bodybuilding",
    level: "ADVANCED",
    days: {
      MON: ARNOLD_CHEST_BACK,
      TUE: ARNOLD_SHOULDERS_ARMS,
      WED: ARNOLD_LEGS,
      THU: ARNOLD_CHEST_BACK,
      FRI: ARNOLD_SHOULDERS_ARMS,
      SAT: ARNOLD_LEGS,
      SUN: REST_DAY,
    },
  },
  {
    name: "nSUNS 5/3/1",
    tagline: "High-frequency strength variant",
    level: "ADVANCED",
    days: {
      MON: {
        label: "BENCH/OHP",
        items: [
          fx("Bench Press", "barbell", ["chest", "triceps"], 9, NSUNS_T1),
          fx("Overhead Press", "barbell", ["shoulders", "triceps"], 8, NSUNS_T2),
          fx("Dumbbell Row", "dumbbell", ["lats", "upper back"], 4, "8-12"),
          fx("Dumbbell Lateral Raise", "dumbbell", ["shoulders"], 3, "12-15"),
          fx("Triceps Pushdown", "cable", ["triceps"], 3, "10-12"),
        ],
      },
      TUE: {
        label: "SQUAT/SUMO DL",
        items: [
          fx("Squat", "barbell", ["quads", "glutes"], 9, NSUNS_T1),
          fx("Sumo Deadlift", "barbell", ["hamstrings", "glutes"], 8, NSUNS_T2),
          fx("Leg Curl", "machine", ["hamstrings"], 3, "10-12"),
          fx("Hanging Leg Raise", "bodyweight", ["abs"], 3, "10-15"),
        ],
      },
      WED: {
        label: "OHP/INCLINE",
        items: [
          fx("Overhead Press", "barbell", ["shoulders", "triceps"], 9, NSUNS_T1),
          fx("Incline Bench Press", "barbell", ["chest", "shoulders"], 8, NSUNS_T2),
          fx("Chin-Up", "bodyweight", ["lats", "biceps"], 3, "8-12"),
          fx("Face Pull", "cable", ["rear delts", "upper back"], 3, "15-20"),
        ],
      },
      THU: REST_DAY,
      FRI: {
        label: "BENCH/CLOSE GRIP",
        items: [
          fx("Bench Press", "barbell", ["chest", "triceps"], 9, NSUNS_T1),
          fx("Close-Grip Bench Press", "barbell", ["triceps", "chest"], 8, NSUNS_T2),
          fx("Barbell Row", "barbell", ["lats", "upper back"], 4, "8-10"),
          fx("Dumbbell Flye", "dumbbell", ["chest"], 3, "12-15"),
        ],
      },
      SAT: {
        label: "DEADLIFT/FRONT SQUAT",
        items: [
          fx("Deadlift", "barbell", ["hamstrings", "glutes", "lower back"], 9, NSUNS_T1),
          fx("Front Squat", "barbell", ["quads"], 8, NSUNS_T2),
          fx("Back Extension", "bodyweight", ["lower back", "glutes"], 3, "10-12"),
          fx("Ab Wheel Rollout", "bodyweight", ["abs"], 3, "10-15"),
        ],
      },
      SUN: REST_DAY,
    },
  },
];

const FEATURED_NAMES = new Set(FEATURED_PROGRAMS.map((p) => p.name.toUpperCase()));

function featuredRef(exercise: FeaturedExercise): ProgramExerciseRef {
  const slug = exercise.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    id: `custom-${slug}`,
    name: exercise.name,
    equipment: exercise.equipment,
    primary_muscles: [...exercise.muscles],
    youtube_query: `${exercise.name} form`,
    sets: exercise.sets,
    reps: exercise.reps,
  };
}

function ProgramsPage() {
  const [state, set] = useAppState();
  const nav = useNavigate();
  const { isPro, loading } = usePro();
  const locked = loading || !isPro;
  const [preview, setPreview] = useState<string | null>(null);

  const customProgramCount = state.programs.filter(
    (p) => !FEATURED_NAMES.has(p.name.trim().toUpperCase()),
  ).length;

  function create(template: (typeof SPLIT_TEMPLATES)[number]) {
    if (locked && customProgramCount >= 1) {
      openPaywall("custom-programs");
      return;
    }
    const id = crypto.randomUUID();
    const program: Program = {
      id,
      name: template.name,
      splitType: template.type,
      createdAt: new Date().toISOString(),
      days: Object.fromEntries(
        DAYS.map((d) => [d, { label: template.days[d], items: [] }]),
      ) as unknown as Program["days"],
    };
    // Deliberately not activated here. An active program overrides the whole
    // weekly schedule, so merely opening a template must not replace the week
    // the lifter already built — the builder's "Set Active & Train" does that.
    set((s) => ({ ...s, programs: [...s.programs, program] }));
    nav({ to: "/programs/$programId", params: { programId: id } });
  }

  function createFeatured(p: (typeof FEATURED_PROGRAMS)[number]) {
    if (locked) {
      openPaywall("featured-programs");
      return;
    }
    const id = crypto.randomUUID();
    const program: Program = {
      id,
      name: p.name,
      splitType: "CUSTOM",
      createdAt: new Date().toISOString(),
      days: Object.fromEntries(
        DAYS.map((d) => [d, { label: p.days[d].label, items: p.days[d].items.map(featuredRef) }]),
      ) as unknown as Program["days"],
    };
    // Deliberately not activated here. An active program overrides the whole
    // weekly schedule, so merely opening a template must not replace the week
    // the lifter already built — the builder's "Set Active & Train" does that.
    set((s) => ({ ...s, programs: [...s.programs, program] }));
    nav({ to: "/programs/$programId", params: { programId: id } });
  }

  function activate(id: string) {
    set((s) => ({ ...s, activeProgramId: id }));
  }
  /** Hands the week back to the lifter's own schedule on the Train tab. */
  function deactivate() {
    set((s) => ({ ...s, activeProgramId: null }));
  }
  async function remove(id: string) {
    const ok = await askConfirm({
      title: "Delete this program?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    set((s) => ({
      ...s,
      programs: s.programs.filter((p) => p.id !== id),
      activeProgramId: s.activeProgramId === id ? null : s.activeProgramId,
    }));
  }

  return (
    <div className="px-5 pt-4 pb-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="display text-3xl font-extrabold uppercase text-grit">Programs</h1>
        <Link to="/train" className="label-cap text-grit-dim text-xs">
          DONE
        </Link>
      </div>
      <p className="text-xs text-grit-dim mb-5 leading-relaxed">
        A program is a ready-made week you can swap in. Making one won't change
        anything — it only takes over your training week once you set it active,
        and you can switch back to your own schedule any time.
      </p>

      {state.programs.length === 0 && (
        <div className="bg-grit-card border border-grit p-6 text-center mb-5 animate-pop-in">
          <p className="display text-xl font-extrabold uppercase text-grit">
            Build your first split
          </p>
          <p className="text-sm text-grit-dim mt-1">
            Start from an expert template below, or build your own day by day.
          </p>
        </div>
      )}

      <ul className="space-y-2 mb-6">
        {state.programs.map((p) => {
          const filled = DAYS.reduce((a, d) => a + p.days[d].items.length, 0);
          const trainingDays = DAYS.filter((d) => p.days[d].label !== "REST").length;
          const isActive = p.id === state.activeProgramId;
          return (
            <li
              key={p.id}
              className="bg-grit-card border"
              style={{ borderColor: isActive ? "#e63222" : "#262626" }}
            >
              <div className="flex items-stretch">
                <Link
                  to="/programs/$programId"
                  params={{ programId: p.id }}
                  className="flex-1 p-4 min-w-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isActive && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-accent-red text-white label-cap">
                        ACTIVE
                      </span>
                    )}
                    <span className="display text-lg font-extrabold uppercase text-grit truncate">
                      {p.name}
                    </span>
                  </div>
                  <p className="label-cap text-grit-dim text-[10px]">
                    {trainingDays} DAYS · {filled} EXERCISES
                  </p>
                </Link>
                {/* Text labels, not bare icons: a `title` tooltip never appears
                    on a touch screen, so these read as unmarked squares there. */}
                <div className="flex flex-col border-l border-grit">
                  <button
                    onClick={() => (isActive ? deactivate() : activate(p.id))}
                    className="px-3 py-2 flex-1 flex items-center gap-1.5 justify-center"
                  >
                    {isActive ? (
                      <>
                        <X size={14} className="text-grit-dim" />
                        <span className="label-cap text-[9px] text-grit-dim">Stop</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} className="text-accent-red" />
                        <span className="label-cap text-[9px] text-grit">Use</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="px-3 py-2 flex-1 flex items-center gap-1.5 justify-center border-t border-grit"
                  >
                    <Trash2 size={14} className="text-grit-dim" />
                    <span className="label-cap text-[9px] text-grit-dim">Delete</span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="label-cap text-grit-dim text-xs mb-2">★ Featured programs</p>
      <ul className="space-y-2 mb-6">
        {FEATURED_PROGRAMS.map((p) => {
          const open = preview === p.name;
          const trainingDays = DAYS.filter((d) => p.days[d].label !== "REST");
          return (
            <li key={p.name} className="bg-grit-card border border-grit">
              <button
                onClick={() => createFeatured(p)}
                className="w-full p-4 flex items-center justify-between text-left press"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="display uppercase font-extrabold text-grit text-base truncate">
                      {p.name}
                    </span>
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 border border-grit text-grit-dim label-cap">
                      {p.level}
                    </span>
                    <span className="shrink-0 text-[9px] py-0.5 label-cap text-accent-red border border-accent-red/40 rounded px-1.5">
                      PRO
                    </span>
                  </div>
                  <div className="text-xs text-grit-dim truncate">{p.tagline}</div>
                </div>
                {locked ? (
                  <Lock size={16} className="text-grit-dim shrink-0" />
                ) : (
                  <Plus size={18} className="text-accent-red shrink-0" />
                )}
              </button>
              <div className="px-4 pb-3">
                <button
                  onClick={() => setPreview(open ? null : p.name)}
                  className="btn-ghost px-3 py-1 text-[10px] press"
                >
                  {open ? "Hide preview" : "Preview"}
                </button>
                {open && (
                  <div className="mt-3 space-y-2.5">
                    {trainingDays.map((d) => (
                      <div key={d}>
                        <p className="label-cap text-grit-dim text-[10px] mb-0.5">
                          {d} · {p.days[d].label}
                        </p>
                        <p className="text-xs text-grit leading-relaxed">
                          {p.days[d].items.map((it) => it.name).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="label-cap text-grit-dim text-xs mb-2">+ New from template</p>
      {locked && customProgramCount >= 1 && (
        <p className="text-[10px] text-grit-dim mb-2">
          Free includes 1 custom program — <span className="text-accent-red">Pro</span> unlocks
          unlimited.
        </p>
      )}
      <ul className="space-y-2">
        {SPLIT_TEMPLATES.map((t) => (
          <li key={t.type}>
            <button
              onClick={() => create(t)}
              className="w-full bg-grit-card border border-grit p-4 flex items-center justify-between text-left press"
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
