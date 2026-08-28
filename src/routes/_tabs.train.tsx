import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Apple,
  Flame,
  Trophy,
  Heart,
  Pencil,
  Shield,
  Lock,
  Users,
  ChevronRight,
  Info,
} from "lucide-react";

import { GritSheet } from "@/components/GritSheet";
import { TrainWorkoutBrief } from "@/components/TrainWorkoutBrief";
import { Reminders } from "@/components/Reminders";
import { DailyQuests } from "@/components/DailyQuests";
import { Big3Card } from "@/components/Big3Card";
import { FirstWinsCard } from "@/components/FirstWinsCard";
import { WeeklyRecap } from "@/components/WeeklyRecap";
import { RankedArena } from "@/components/RankedArena";
import { TodayReadiness } from "@/components/TodayReadiness";
import { TrainingInsight } from "@/components/TrainingInsight";
import { WeeklyMission } from "@/components/WeeklyMission";
import { useAppState } from "@/lib/storage";
import { calculateGritScore, calculateStreak, defaultSchedule, isoDay, todayKey } from "@/lib/calc";
import { hapticSelection, hapticWorkoutStart } from "@/lib/haptics";
import { ProBanner } from "@/components/ProBanner";
import { usePro } from "@/hooks/usePro";
import { useCountUp } from "@/hooks/useCountUp";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";
import { WhatsNewCard } from "@/components/WhatsNewCard";
import { WeekPaceCard } from "@/components/WeekPaceCard";
import { StreakChaseCard } from "@/components/StreakChaseCard";
import { TrainingAutopilot } from "@/components/TrainingAutopilot";
import { openPaywall } from "@/lib/paywall-events";
import type { DayKey, Schedule, Program } from "@/lib/types";

const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_SHORT: Record<DayKey, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};
const DAY_FULL: Record<DayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

function dayHype(
  dayKey: DayKey,
  label: string,
  isToday: boolean,
): { eyebrow: string; line: string } {
  const focus = (label || "REST").split(" — ")[0];
  const isRest = focus === "REST" || !focus;
  const dayName = DAY_FULL[dayKey].toUpperCase();
  if (isRest) {
    return {
      eyebrow: isToday ? `${dayName} · TODAY` : `${dayName} · SELECTED`,
      line: "Scheduled recovery day.",
    };
  }
  const hype: Record<string, string> = {
    CHEST: "Chest-focused strength and hypertrophy.",
    BACK: "Back-focused strength and hypertrophy.",
    LEGS: "Quads, hamstrings, glutes, and calves.",
    SHOULDERS: "Shoulder strength and hypertrophy.",
    ARMS: "Biceps, triceps, and forearms.",
    CORE: "Core strength and stability.",
    PUSH: "Chest, shoulders, and triceps.",
    PULL: "Back and biceps.",
    UPPER: "Chest, back, shoulders, and arms.",
    LOWER: "Quads, hamstrings, glutes, and calves.",
    FULL: "Full-body strength and conditioning.",
  };
  const line = hype[focus] ?? "Your scheduled training session.";
  return {
    eyebrow: isToday ? `${dayName} · TODAY` : `${dayName} · SELECTED`,
    line,
  };
}

export const Route = createFileRoute("/_tabs/train")({
  head: () => ({ meta: [{ title: "DEADSET — Train" }] }),
  component: TrainPage,
});

function TrainPage() {
  const [state] = useAppState();
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey());
  const [gritOpen, setGritOpen] = useState(false);
  const [homeView, setHomeView] = useState<"TODAY" | "INSIGHTS">("TODAY");

  const activeProgram: Program | undefined = state.programs.find(
    (p) => p.id === state.activeProgramId,
  );
  const schedule: Schedule =
    state.schedule ?? (state.profile ? defaultSchedule(state.profile) : ({} as Schedule));
  const day = schedule[selectedDay];
  const programDay = activeProgram?.days[selectedDay];
  // "Build Your Own" onboarding lands here with an all-REST week.
  const scheduleIsEmpty =
    !activeProgram &&
    !!state.schedule &&
    DAY_KEYS.every((k) => !(state.schedule?.[k]?.exerciseIds?.length ?? 0));
  const score = calculateGritScore(state);
  const streak = calculateStreak(state.completedDates);
  const gritDisplay = useCountUp(score.total);

  const { isPro, loading: proLoading } = usePro();
  const armorLocked = proLoading || !isPro;
  const armorShields = Math.max(0, Math.min(3, state.streakArmor?.shields ?? 0));
  const armorSavedDate = (() => {
    const used = state.streakArmor?.usedDates;
    if (!used || used.length === 0) return null;
    for (const daysAgo of [1, 2]) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      if (used.includes(isoDay(d))) return d;
    }
    return null;
  })();

  const selectedLabel = (activeProgram ? programDay?.label : day?.label) || "REST";
  const [selectedTitle, ...selectedDetails] = selectedLabel.split(" — ");
  const selectedDetail = selectedDetails.join(" — ");
  const selectedHype = dayHype(selectedDay, selectedLabel, selectedDay === todayKey());
  const todayFood = state.foodLog.filter((item) => item.date === isoDay());
  const todayNutrition = todayFood.reduce(
    (total, item) => ({
      calories: total.calories + (item.calories ?? 0),
      protein: total.protein + (item.protein ?? 0),
    }),
    { calories: 0, protein: 0 },
  );

  return (
    <div className="deadset-page">
      <header className="deadset-section">
        <div className="deadset-hero-card p-5">
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div key={selectedDay} className="deadset-day-switch min-w-0">
                <p className="label-cap text-accent-red">{selectedHype.eyebrow}</p>
                <h1 className="display mt-2 text-4xl font-black uppercase leading-[0.92] text-grit">
                  {selectedTitle}
                </h1>
                {selectedDetail && (
                  <p className="mt-2 text-[11px] font-bold uppercase text-accent-red">
                    {selectedDetail.replaceAll("/", " · ")}
                  </p>
                )}
                <p className="mt-3 max-w-[28rem] text-sm leading-relaxed text-grit-dim">
                  {selectedHype.line}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {/* Opens the explainer rather than the profile: the question
                    this tile provokes is "what is this number", and the avatar
                    already routes to the profile. */}
                <button
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    setGritOpen(true);
                  }}
                  aria-label="What is grit?"
                  className="deadset-glass-strip rounded-2xl px-3 py-2 text-right"
                >
                  <p className="label-cap flex items-center justify-end gap-1 text-[8px]">
                    GRIT <Info size={9} className="text-grit-dim" />
                  </p>
                  <p className="display text-2xl font-black text-grit leading-none">
                    {gritDisplay}
                  </p>
                  <p className="text-[10px] text-grit-dim mt-1">{streak}d streak</p>
                </button>
                {/* The label sits under the shields rather than beside them:
                    everyone needs to know what they are, but a wide cluster
                    steals width from the exercise names on the left. */}
                {armorLocked ? (
                  <button
                    onClick={() => openPaywall("streak-armor")}
                    className="press tap-44 relative flex flex-col items-end gap-0.5"
                    aria-label="Unlock Streak Armor"
                  >
                    <span className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <Shield key={i} size={14} className="text-grit-dim" />
                      ))}
                      <Lock size={10} className="absolute -top-1 -right-0.5 text-grit-dim" />
                    </span>
                    <span className="label-cap text-[8px] text-grit-dim">ARMOR</span>
                  </button>
                ) : (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <Shield
                          key={i}
                          size={14}
                          className={
                            i < armorShields ? "text-accent-red fill-current" : "text-grit-dim"
                          }
                        />
                      ))}
                    </span>
                    <span className="label-cap text-[8px] text-grit-dim">ARMOR</span>
                  </div>
                )}
                {armorSavedDate && (
                  <p className="text-[10px] text-grit-dim text-right leading-snug max-w-[10rem]">
                    Streak Armor saved your{" "}
                    {armorSavedDate.toLocaleDateString(undefined, { weekday: "short" })} —{" "}
                    {armorShields} left this month
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              {(() => {
                const programItems = activeProgram?.days[selectedDay]?.items.length || 0;
                const scheduleItems = schedule[selectedDay]?.exerciseIds?.length || 0;
                // The active programme is the workout source of truth. Falling
                // back to schedule counts on a programme rest day advertised a
                // Start button that could not actually build a session.
                const selectedItems = activeProgram ? programItems : scheduleItems;
                const hasSchedule = !!state.schedule || !!activeProgram;
                const canStart = selectedItems > 0;
                if (canStart) {
                  return (
                    <Link
                      to="/workout/live"
                      search={{
                        day: selectedDay,
                        source: activeProgram ? "program" : "schedule",
                      }}
                      onClick={hapticWorkoutStart}
                      className="btn-grit deadset-primary-action flex-1 min-h-[54px] text-sm flex items-center justify-center rounded-2xl"
                    >
                      <Flame size={18} className="mr-2" />
                      Start {selectedDay === todayKey() ? "Workout" : DAY_SHORT[selectedDay]}
                    </Link>
                  );
                }
                if (!hasSchedule || scheduleIsEmpty) {
                  return (
                    <Link
                      to="/plan"
                      className="btn-grit deadset-primary-action flex-1 min-h-[54px] text-sm flex items-center justify-center rounded-2xl"
                    >
                      <Pencil size={18} className="mr-2" />
                      Build My Split
                    </Link>
                  );
                }
                return (
                  <Link
                    to="/workout/live"
                    search={{}}
                    onClick={hapticSelection}
                    className="btn-ghost flex-1 min-h-[54px] text-sm flex items-center justify-center rounded-2xl"
                  >
                    Choose a workout
                  </Link>
                );
              })()}
              <Link
                to="/plan"
                className="btn-ghost min-h-[54px] px-4 rounded-2xl flex items-center justify-center"
              >
                <Pencil size={17} className="mr-1.5" />
                Plan
              </Link>
            </div>

            {(!state.schedule || scheduleIsEmpty) && (
              <Link
                to="/plan"
                className="btn-ghost w-full mt-2 min-h-[48px] rounded-2xl text-xs flex items-center justify-center"
              >
                <Pencil size={14} className="mr-2" />
                Start From Scratch — map every day yourself
              </Link>
            )}

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {DAY_KEYS.map((k) => {
                const active = k === selectedDay;
                const isToday = k === todayKey();
                const lbl =
                  (activeProgram ? activeProgram.days[k]?.label : schedule[k]?.label)?.split(
                    " — ",
                  )[0] || "REST";
                return (
                  <button
                    key={k}
                    onClick={() => {
                      if (k === selectedDay) return;
                      hapticSelection();
                      setSelectedDay(k);
                    }}
                    aria-pressed={active}
                    className={`deadset-day-chip flex-shrink-0 min-w-[74px] rounded-2xl px-3 py-2.5 border text-center press ${
                      active ? "deadset-day-chip-active" : ""
                    }`}
                    style={{
                      borderColor: active ? "#e63222" : "rgba(255,255,255,.10)",
                      background: active ? "rgba(230,50,34,.16)" : "rgba(0,0,0,.30)",
                    }}
                  >
                    <div
                      className="label-cap text-[9px]"
                      style={{ color: isToday ? "#e63222" : "#8a8a8a" }}
                    >
                      {DAY_SHORT[k]}
                    </div>
                    <div className="text-[11px] font-black uppercase mt-1 text-grit truncate">
                      {lbl}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-col">
        <TrainWorkoutBrief
          key={selectedDay}
          state={state}
          selectedDay={selectedDay}
          schedule={schedule}
          activeProgram={activeProgram}
        />
        <section className="deadset-section" aria-labelledby="daily-hub-title">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 id="daily-hub-title" className="label-cap text-[10px] text-grit-dim">
              DAILY HUB
            </h2>
            <span className="text-[10px] font-semibold text-grit-dim">Everything in reach</span>
          </div>
          <Link
            to="/diet"
            className="press group flex min-h-[74px] items-center gap-3 rounded-2xl border border-accent-red/35 bg-[linear-gradient(115deg,rgba(230,50,34,.18),rgba(255,255,255,.035))] px-4 py-3"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-red text-white shadow-[0_8px_22px_rgba(230,50,34,.28)]">
              <Apple size={20} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="display block text-lg font-black uppercase leading-none text-grit">
                Food & Nutrition
              </span>
              <span className="mt-1 block truncate text-[11px] font-semibold text-grit-dim">
                {todayFood.length
                  ? `${todayNutrition.calories} kcal · ${Math.round(todayNutrition.protein)}g protein today`
                  : "Track meals, macros and water"}
              </span>
            </span>
            <ChevronRight
              size={19}
              className="shrink-0 text-accent-red transition-transform group-active:translate-x-0.5"
            />
          </Link>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Link
              to="/challenges"
              className="btn-ghost flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px]"
            >
              <Trophy size={16} /> Arena
            </Link>
            <Link
              to="/recovery"
              className="btn-ghost flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px]"
            >
              <Heart size={16} /> Recovery
            </Link>
            <Link
              to="/friends"
              className="btn-ghost flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px]"
            >
              <Users size={16} /> Friends
            </Link>
          </div>
        </section>
        <section className="deadset-section" aria-label="Train screen view">
          <div
            className="grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1"
            role="tablist"
            aria-label="Choose what to see"
          >
            {(["TODAY", "INSIGHTS"] as const).map((view) => {
              const active = homeView === view;
              return (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`train-${view.toLowerCase()}-panel`}
                  onClick={() => {
                    if (view === homeView) return;
                    hapticSelection();
                    setHomeView(view);
                  }}
                  className={`min-h-11 rounded-xl text-[11px] font-black uppercase transition-colors ${
                    active
                      ? "bg-accent-red text-white shadow-[0_8px_22px_rgba(230,50,34,.22)]"
                      : "text-grit-dim"
                  }`}
                >
                  {view === "TODAY" ? "Today" : "Insights"}
                </button>
              );
            })}
          </div>
        </section>

        {homeView === "TODAY" ? (
          <div
            id="train-today-panel"
            key="today"
            role="tabpanel"
            className="deadset-view-switch flex flex-col"
          >
            <TodayReadiness state={state} schedule={schedule} />
            <TrainingAutopilot compact />
            <DailyQuests />
            <FirstWinsCard />
            <Reminders />
            <WhatsNewCard />
          </div>
        ) : (
          <div
            id="train-insights-panel"
            key="insights"
            role="tabpanel"
            className="deadset-view-switch flex flex-col"
          >
            <div className="px-5">
              <TrainingInsight />
              <WeekPaceCard state={state} />
              <StreakChaseCard state={state} />
              <WeeklyMission state={state} />
            </div>
            <WeeklyReportCard />
            <ProBanner />
            <section className="deadset-section">
              <RankedArena state={state} compact />
            </section>
            <div className="deadset-section">
              <Big3Card state={state} />
            </div>
            <div className="deadset-section">
              <WeeklyRecap state={state} />
            </div>
          </div>
        )}
      </div>

      {gritOpen && <GritSheet state={state} onClose={() => setGritOpen(false)} />}
    </div>
  );
}
