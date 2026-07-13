import { Link } from "@tanstack/react-router";
import { Apple, CheckCircle2, ChevronRight, Droplets, Flame, Moon, Target } from "lucide-react";

import type { AppState, DayKey, Schedule } from "@/lib/types";
import { calculateStreak, isoDay, todayKey } from "@/lib/calc";

type ReadinessItem = {
  label: string;
  value: string;
  done: boolean;
  to: "/workout/live" | "/diet" | "/progress" | "/recovery";
  Icon: typeof Flame;
};

function pct(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

function proteinTarget(weightKg?: number) {
  return Math.max(90, Math.round((weightKg || 75) * 1.8));
}

function todayFoodTotals(state: AppState) {
  const day = isoDay();
  return state.foodLog
    .filter((item) => item.date === day)
    .reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
      }),
      { calories: 0, protein: 0 },
    );
}

function todayWaterMl(state: AppState) {
  const day = isoDay();
  return state.water
    .filter((entry) => entry.date === day)
    .reduce((total, entry) => total + entry.ml, 0);
}

function getTodayTraining(
  state: AppState,
  schedule: Schedule,
  dayKey: DayKey,
): { label: string; exerciseCount: number } {
  const activeProgram = state.programs.find((program) => program.id === state.activeProgramId);
  if (activeProgram) {
    const programDay = activeProgram.days[dayKey];
    return { label: programDay?.label || "REST", exerciseCount: programDay?.items.length || 0 };
  }
  const day = schedule[dayKey];
  return { label: day?.label || "REST", exerciseCount: day?.exerciseIds?.length || 0 };
}

export function TodayReadiness({ state, schedule }: { state: AppState; schedule: Schedule }) {
  const dayKey = todayKey();
  const training = getTodayTraining(state, schedule, dayKey);
  const completedToday = state.completedDates.includes(isoDay());
  const waterMl = todayWaterMl(state);
  const food = todayFoodTotals(state);
  const proteinGoal = proteinTarget(state.profile?.weightKg);
  const waterTarget = state.waterTargetMl || 3000;
  const hasRecentProgress =
    state.checkIns.length > 0 || state.weights.length > 0 || state.measurements.length > 0;

  const items: ReadinessItem[] = [
    {
      label: training.exerciseCount > 0 ? training.label.split(" — ")[0] : "Recovery day",
      value: completedToday
        ? "Logged"
        : training.exerciseCount > 0
          ? `${training.exerciseCount} lifts`
          : "No lifts",
      done: completedToday || training.exerciseCount === 0,
      to: training.exerciseCount > 0 ? "/workout/live" : "/recovery",
      Icon: training.exerciseCount > 0 ? Flame : Moon,
    },
    {
      label: "Protein",
      value: `${Math.round(food.protein)}/${proteinGoal}g`,
      done: food.protein >= proteinGoal,
      to: "/diet",
      Icon: Apple,
    },
    {
      label: "Water",
      value: `${Math.round(waterMl / 250)}/${Math.round(waterTarget / 250)} cups`,
      done: waterMl >= waterTarget,
      to: "/diet",
      Icon: Droplets,
    },
    {
      label: "Progress",
      value: hasRecentProgress
        ? `${calculateStreak(state.completedDates)}d streak`
        : "Set baseline",
      done: hasRecentProgress,
      to: "/progress",
      Icon: Target,
    },
  ];

  const doneCount = items.filter((item) => item.done).length;
  const progress = pct(doneCount, items.length);

  return (
    <section className="deadset-section">
      <div className="deadset-command-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-cap text-accent-red">Today readiness</p>
            <h2 className="display mt-1 text-2xl font-black uppercase leading-none text-grit">
              {doneCount}/{items.length} locked
            </h2>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <CheckCircle2
              size={22}
              style={{ color: doneCount === items.length ? "#22c55e" : "#e63222" }}
            />
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-accent-red transition-[width] duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {items.map(({ label, value, done, to, Icon }) => (
            <Link
              key={label}
              to={to}
              className="press rounded-2xl border border-white/10 bg-black/25 p-3"
              style={{ borderColor: done ? "rgba(34,197,94,.36)" : "rgba(255,255,255,.10)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon size={16} style={{ color: done ? "#22c55e" : "#e63222" }} />
                <ChevronRight size={14} className="text-grit-dim" />
              </div>
              <p className="mt-3 text-[11px] font-black uppercase text-grit">{label}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-grit-dim">
                {value}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
