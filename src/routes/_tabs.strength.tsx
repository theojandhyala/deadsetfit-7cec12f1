import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Lock, Info, RefreshCw, Share2, TrendingUp } from "lucide-react";

import { useAppState } from "@/lib/storage";
import { allExercises } from "@/lib/exercises";
import { defaultSchedule } from "@/lib/calc";
import { usePro } from "@/hooks/usePro";
import { useCountUp } from "@/hooks/useCountUp";
import { openPaywall } from "@/lib/paywall-events";
import { formatWeight, unitOf } from "@/lib/units";
import { hapticSelection } from "@/lib/haptics";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { MuscleGrowthCoach } from "@/components/MuscleGrowthCoach";
import { StrengthMapShareCard } from "@/components/StrengthMapShareCard";
import { WeeklySetGrid } from "@/components/WeeklySetGrid";
import { openStrengthCheckIn } from "@/lib/strength-check-in-events";
import type { GrowthTarget } from "@/lib/muscle-growth-recommendations";
import { toMuscleGroup } from "@/lib/recovery";
import {
  GRADED_MUSCLES,
  TIER_BLURB,
  TIER_COLOR,
  TIERS,
  pointsToNextTier,
  strengthReport,
  strengthReportAsOf,
  type ExerciseGrade,
  type MuscleGrade,
  type StrengthReport,
  type StrengthTier,
} from "@/lib/strength-grades";

export const Route = createFileRoute("/_tabs/strength")({
  head: () => ({ meta: [{ title: "DEADSET — Your Strength" }] }),
  component: StrengthPage,
});

function StrengthPage() {
  const [state] = useAppState();
  const [growthTarget, setGrowthTarget] = useState<GrowthTarget>("BACK");
  const [growthOpen, setGrowthOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { isPro, loading: proLoading } = usePro();
  const unit = unitOf(state);

  const library = useMemo(() => {
    const byId = new Map(
      allExercises(state.savedExercises).map((exercise) => [
        exercise.id,
        { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup },
      ]),
    );
    const active = state.programs.find((program) => program.id === state.activeProgramId);
    for (const day of Object.values(active?.days ?? {})) {
      for (const item of day.items) {
        const muscleGroup = item.primary_muscles
          .map(toMuscleGroup)
          .find((muscle): muscle is NonNullable<typeof muscle> => Boolean(muscle));
        if (muscleGroup && !byId.has(item.id)) {
          byId.set(item.id, { id: item.id, name: item.name, muscleGroup });
        }
      }
    }
    return [...byId.values()];
  }, [state.savedExercises, state.programs, state.activeProgramId]);
  const report = useMemo(() => strengthReport(state, library), [state, library]);
  const firstDay = useMemo(
    () =>
      state.sessions
        .filter((s) => s.endedAt)
        .map((s) => s.date.slice(0, 10))
        .sort()[0] ?? null,
    [state.sessions],
  );
  const baselineDay = useMemo(() => {
    if (!firstDay) return null;
    const date = new Date(`${firstDay}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() + 89);
    return date.toISOString().slice(0, 10);
  }, [firstDay]);
  const baseline = useMemo(
    () => (baselineDay ? strengthReportAsOf(state, library, baselineDay) : null),
    [state, library, baselineDay],
  );
  const plannedMuscles = useMemo(() => {
    const covered = new Set<string>();
    const definitions = allExercises(state.savedExercises);
    const active = state.programs.find((program) => program.id === state.activeProgramId);
    if (active) {
      for (const day of Object.values(active.days)) {
        for (const exercise of day.items) {
          exercise.primary_muscles.forEach((muscle) => {
            const group = toMuscleGroup(muscle);
            if (group) covered.add(group);
          });
        }
      }
    } else {
      const schedule = state.schedule ?? (state.profile ? defaultSchedule(state.profile) : null);
      for (const day of Object.values(schedule ?? {})) {
        for (const exerciseId of day.exerciseIds) {
          const muscle = definitions.find((exercise) => exercise.id === exerciseId)?.muscleGroup;
          if (muscle) covered.add(muscle);
        }
      }
    }
    return covered;
  }, [state.schedule, state.programs, state.activeProgramId, state.savedExercises, state.profile]);
  const displayScore = useCountUp(report.score, 900);
  const locked = proLoading || !isPro;

  const needsBodyweight = (state.profile?.weightKg ?? 0) <= 0;
  const needsStrengthReference = state.profile?.gender === "OTHER";
  const needsStrengthProfile = needsBodyweight || needsStrengthReference;

  function openGrowthPlan(target: GrowthTarget) {
    setGrowthTarget(target);
    setGrowthOpen(true);
    hapticSelection();
  }

  function openStrengthShare() {
    hapticSelection();
    setShareOpen(true);
  }

  return (
    <div className="deadset-page min-h-screen pb-28">
      <header className="px-5 pt-6 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-cap text-grit-dim">YOUR STRENGTH MAP</p>
          <h1 className="display text-2xl font-extrabold uppercase text-grit">
            How strong are you?
          </h1>
        </div>
        <Link
          to="/progress"
          onClick={hapticSelection}
          className="label-cap flex min-h-11 shrink-0 items-center rounded-xl border border-grit bg-grit-card px-3 py-2 text-[9px] text-grit-dim press"
        >
          All progress
        </Link>
      </header>

      <StrengthBodyComparison
        baseline={needsStrengthProfile ? null : baseline}
        current={report}
        plannedMuscles={plannedMuscles}
        onSelectMuscle={openGrowthPlan}
        onShare={openStrengthShare}
      />

      <section className="px-5 mt-3">
        <button
          type="button"
          onClick={() => {
            hapticSelection();
            openStrengthCheckIn();
          }}
          className="press flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-accent-red/45 bg-[linear-gradient(110deg,rgba(230,50,34,.22),rgba(230,50,34,.06))] px-4 text-left"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-red text-white">
              <RefreshCw size={18} strokeWidth={2.6} />
            </span>
            <span>
              <span className="display block text-lg font-black uppercase leading-none text-white">
                Update lifts & map
              </span>
              <span className="mt-1 block text-[10px] leading-relaxed text-grit-dim">
                {state.strengthCheckIn?.lastCompletedAt
                  ? `Last synced ${new Date(state.strengthCheckIn.lastCompletedAt).toLocaleDateString()}`
                  : "Confirm every exercise once, then DEADSET checks in weekly"}
              </span>
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-accent-red" />
        </button>
      </section>

      <section className="px-5 mt-5">
        <WeeklySetGrid state={state} onSelectMuscle={openGrowthPlan} />
      </section>

      {needsStrengthProfile && (
        <MissingStrengthProfile
          needsBodyweight={needsBodyweight}
          needsStrengthReference={needsStrengthReference}
        />
      )}

      <MuscleGrowthCoach
        selectedTarget={growthTarget}
        onTargetChange={setGrowthTarget}
        open={growthOpen}
        onOpenChange={setGrowthOpen}
      />

      {shareOpen && (
        <StrengthMapShareCard
          current={report}
          baseline={baseline}
          gradeColors={reportColors(report, plannedMuscles)}
          displayName={state.profile?.displayName}
          username={state.profile?.username}
          onClose={() => setShareOpen(false)}
        />
      )}

      {!needsStrengthProfile && (
        <>
          {report.gradedCount > 0 ? (
            <>
              <div className="mt-5">
                <OverallCard tier={report.tier} score={report.score} displayScore={displayScore} />
              </div>

              <section className="px-5 mt-5">
                <p className="label-cap text-[10px] text-grit-dim mb-2">BY MUSCLE GROUP</p>
                <div className="stagger space-y-2">
                  {report.muscles.map((muscle) => (
                    <MuscleCard
                      key={muscle.muscle}
                      grade={muscle}
                      unit={unit}
                      locked={locked}
                      onUnlock={() => openPaywall("strength")}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <EmptyState hasPlannedExercises={plannedMuscles.size > 0} />
          )}

          {report.ungraded.length > 0 && (
            <section className="px-5 mt-5">
              <div className="rounded-2xl border border-dashed border-grit px-4 py-3">
                <p className="label-cap text-[9px] text-grit-dim">NOT GRADED YET</p>
                <p className="mt-1 text-xs leading-relaxed text-grit-dim">
                  Train {report.ungraded.map((m) => m.toLowerCase()).join(", ")} and they'll be
                  graded here. Every movement in the library has a standard.
                </p>
              </div>
            </section>
          )}

          <p className="px-5 mt-5 text-[10px] leading-relaxed text-grit-dim">
            Grades compare your best estimated one-rep max against typical standards for your
            bodyweight and sex. A muscle's grade is the average of its movements — one strong lift
            doesn't carry the rest.
          </p>
        </>
      )}
    </div>
  );
}

function reportColors(report: StrengthReport | null, plannedMuscles?: Set<string>) {
  const colors: Record<string, string> = Object.fromEntries(
    (report?.muscles ?? []).map((grade) => [grade.muscle, TIER_COLOR[grade.tier]]),
  );
  for (const muscle of GRADED_MUSCLES) {
    if (plannedMuscles?.has(muscle) && !colors[muscle]) colors[muscle] = "#62656d";
  }
  return colors;
}

function StrengthBodyComparison({
  baseline,
  current,
  plannedMuscles,
  onSelectMuscle,
  onShare,
}: {
  baseline: StrengthReport | null;
  current: StrengthReport;
  plannedMuscles: Set<string>;
  onSelectMuscle: (muscle: GrowthTarget) => void;
  onShare: () => void;
}) {
  const hasBaseline = Boolean(baseline?.gradedCount);
  const baselineColors = reportColors(hasBaseline ? baseline : null);
  const currentColors = reportColors(current, plannedMuscles);

  return (
    <section className="px-5 mt-5">
      <div className="overflow-hidden rounded-2xl border border-grit bg-grit-card">
        <div className="flex items-baseline justify-between gap-3 px-4 pb-3 pt-4">
          <div>
            <p className="label-cap text-[9px] text-grit-dim">YOUR STRENGTH</p>
            <p className="display text-base font-extrabold uppercase text-grit">
              Strength progress
            </p>
          </div>
          <p className="label-cap text-right text-[8px] text-accent-red">
            {hasBaseline ? "START → NOW" : "BASELINE BUILDING"}
          </p>
        </div>

        <div className="border-y border-grit bg-[#17181b] px-3 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-5 px-1">
            <div className="text-center">
              <p className="display text-lg font-extrabold uppercase text-grit">
                {hasBaseline ? "Start" : "No start yet"}
              </p>
              <p className="label-cap mt-0.5 text-[7px] text-grit-dim">
                {hasBaseline ? "FIRST 90 DAYS" : "LOG YOUR FIRST WORKOUTS"}
              </p>
              <p className="display mt-1 text-sm font-extrabold tabular-nums text-grit">
                {hasBaseline ? baseline!.score : "—"}
                <span className="label-cap ml-1 text-[6px] text-grit-dim">SCORE</span>
              </p>
            </div>
            <div className="text-center">
              <p className="display text-lg font-extrabold uppercase text-grit">Now</p>
              <p className="label-cap mt-0.5 text-[7px] text-grit-dim">YOUR LATEST BESTS</p>
              <p className="display mt-1 text-sm font-extrabold tabular-nums text-grit">
                {current.gradedCount > 0 ? current.score : "—"}
                <span className="label-cap ml-1 text-[6px] text-grit-dim">SCORE</span>
              </p>
            </div>
          </div>

          <ComparisonRow
            view="front"
            label="FRONT"
            baselineColors={baselineColors}
            currentColors={currentColors}
          />

          <StrengthTierLegend />

          <ComparisonRow
            view="back"
            label="BACK"
            baselineColors={baselineColors}
            currentColors={currentColors}
          />

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <MapKey color="#303238" label="No exercise set" />
            <MapKey color="#62656d" label="Set · needs a logged result" />
          </div>
        </div>

        <p className="px-4 pt-3 text-center text-[10px] leading-relaxed text-grit-dim">
          Every colour is earned from your actual lifts, adjusted for bodyweight. Grey areas are
          missing data—not a made-up score.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-grit p-4">
          {GRADED_MUSCLES.map((muscle) => {
            const grade = current.muscles.find((item) => item.muscle === muscle);
            const planned = plannedMuscles.has(muscle);
            return (
              <button
                key={muscle}
                type="button"
                onClick={() => onSelectMuscle(muscle)}
                aria-label={`Open ${muscle.toLowerCase()} growth game plan`}
                className="flex min-h-14 items-center justify-between rounded-xl border border-grit bg-black/30 px-3 py-2 text-left press"
              >
                <span>
                  <span className="label-cap block text-[9px] text-grit">{muscle}</span>
                  <span
                    className="mt-0.5 block text-[9px] leading-tight"
                    style={{ color: grade ? TIER_COLOR[grade.tier] : "#777" }}
                  >
                    {grade
                      ? `${grade.tier} · ${grade.exercises.length} lift${grade.exercises.length === 1 ? "" : "s"}`
                      : planned
                        ? "Exercises set · log weighted sets"
                        : "No exercises set for that"}
                  </span>
                  <span className="label-cap mt-1 block text-[6px] text-accent-red">
                    BUILD THIS AREA
                  </span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-accent-red" />
              </button>
            );
          })}
        </div>
        <div className="border-t border-grit p-4 pt-3">
          <button
            type="button"
            onClick={onShare}
            className="press flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-accent-red/45 bg-[linear-gradient(110deg,rgba(230,50,34,.24),rgba(230,50,34,.07))] px-4 text-left"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-red text-white shadow-[0_8px_22px_rgba(230,50,34,.3)]">
                <Share2 size={17} strokeWidth={2.5} />
              </span>
              <span className="min-w-0">
                <span className="display block truncate text-base font-black uppercase text-grit">
                  Share my Strength Map
                </span>
                <span className="block text-[9px] font-semibold text-grit-dim">
                  9:16 card built from your real lifts
                </span>
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-accent-red" />
          </button>
        </div>
      </div>
    </section>
  );
}

function ComparisonRow({
  view,
  label,
  baselineColors,
  currentColors,
}: {
  view: "front" | "back";
  label: string;
  baselineColors: Record<string, string>;
  currentColors: Record<string, string>;
}) {
  return (
    <div className="relative mt-2">
      <p className="label-cap absolute left-1 top-2 z-10 text-[6px] tracking-[0.24em] text-grit-dim">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-5">
        <MuscleDiagram view={view} gradeColors={baselineColors} size={232} />
        <MuscleDiagram view={view} gradeColors={currentColors} size={232} />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#474a50] bg-[#202226] text-grit">
        <ChevronRight size={17} strokeWidth={2.4} />
      </div>
    </div>
  );
}

function StrengthTierLegend() {
  return (
    <div className="my-1 grid grid-cols-6 gap-0.5" aria-label="Strength grade colours">
      {TIERS.map((tier) => (
        <div
          key={tier}
          className="flex min-h-5 min-w-0 items-center justify-center overflow-hidden rounded-[3px] px-px text-center"
          style={{ background: TIER_COLOR[tier] }}
        >
          <span
            className="block max-w-full font-black uppercase leading-[1.05] text-white"
            style={{ fontSize: tier === "WORLD_CLASS" ? 5 : 5.5, letterSpacing: 0 }}
          >
            {tier.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

function MapKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[8px] text-grit-dim">
      <span className="h-2 w-2 rounded-sm border border-white/10" style={{ background: color }} />
      {label}
    </span>
  );
}

function OverallCard({
  tier,
  score,
  displayScore,
}: {
  tier: StrengthTier;
  score: number;
  displayScore: number;
}) {
  const color = TIER_COLOR[tier];
  const next = pointsToNextTier(score);

  return (
    <section className="px-5">
      <div
        className="tier-sheen rounded-2xl border p-5"
        style={{
          borderColor: `${color}55`,
          background: `linear-gradient(160deg, ${color}14, transparent 70%)`,
        }}
      >
        <p className="label-cap text-[10px] text-grit-dim">OVERALL</p>
        <p
          className="display figure-pop mt-1 text-4xl font-extrabold uppercase leading-none"
          style={{ color }}
        >
          {tier}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-grit-dim">{TIER_BLURB[tier]}</p>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="display text-3xl font-extrabold tabular-nums text-grit">
            {displayScore}
          </span>
          <span className="label-cap text-[10px] text-grit-dim">/ 100 STRENGTH SCORE</span>
        </div>

        <TierLadder tier={tier} score={score} />

        {next && (
          <p className="mt-3 text-xs font-bold" style={{ color }}>
            {next.points} points to {next.tier}
          </p>
        )}
      </div>
    </section>
  );
}

/** The whole ladder, so the grade sits in context instead of floating alone. */
function TierLadder({ tier, score }: { tier: StrengthTier; score: number }) {
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-[#1a1a1a]">
        <div
          className="meter-fill h-full rounded-full"
          style={{
            width: `${Math.max(2, Math.min(100, score))}%`,
            background: `linear-gradient(90deg, ${TIER_COLOR.NOVICE}, ${TIER_COLOR[tier]})`,
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between">
        {TIERS.map((step) => (
          <span
            key={step}
            className="label-cap text-[7px]"
            style={{ color: step === tier ? TIER_COLOR[step] : "#5a5a5a" }}
          >
            {step === "WORLD_CLASS" ? "WORLD" : step.slice(0, 4)}
          </span>
        ))}
      </div>
    </div>
  );
}

function MuscleCard({
  grade,
  unit,
  locked,
  onUnlock,
}: {
  grade: MuscleGrade;
  unit: "kg" | "lb";
  locked: boolean;
  onUnlock: () => void;
}) {
  const color = TIER_COLOR[grade.tier];

  return (
    <div className="rounded-2xl border border-grit bg-grit-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="display text-lg font-extrabold uppercase text-grit">{grade.muscle}</p>
        <p className="display text-sm font-extrabold uppercase" style={{ color }}>
          {grade.tier}
        </p>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1a1a1a]">
        <div
          className="meter-fill h-full rounded-full"
          style={{ width: `${Math.max(2, grade.score)}%`, background: color }}
        />
      </div>

      {locked ? (
        <button
          onClick={onUnlock}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-accent-red/40 bg-accent-red/10 px-3 py-2.5 text-left press"
        >
          <span>
            <span className="label-cap block text-[9px] text-accent-red">
              PRO — LIFT-BY-LIFT BREAKDOWN
            </span>
            <span className="text-xs font-bold text-grit">
              See every {grade.muscle.toLowerCase()} lift graded, and what's holding you back
            </span>
          </span>
          <Lock size={14} className="ml-2 shrink-0 text-accent-red" />
        </button>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5">
            {grade.exercises.map((exercise) => (
              <ExerciseRow key={exercise.exerciseId} grade={exercise} unit={unit} />
            ))}
          </ul>
          {grade.weakest && grade.exercises.length > 1 && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-grit-dim">
              <TrendingUp size={12} className="mt-0.5 shrink-0 text-accent-red" />
              <span>
                <span className="font-bold text-grit">{grade.weakest.name}</span> is holding this
                grade back. Push it and {grade.muscle.toLowerCase()} moves fastest.
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ExerciseRow({ grade, unit }: { grade: ExerciseGrade; unit: "kg" | "lb" }) {
  const color = TIER_COLOR[grade.tier];
  const measured =
    grade.kind === "RATIO"
      ? formatWeight(grade.value, unit)
      : grade.kind === "SECONDS"
        ? `${grade.value}s`
        : `${grade.value} reps`;
  const target =
    grade.nextAt === null
      ? null
      : grade.kind === "RATIO"
        ? formatWeight(grade.nextAt, unit)
        : grade.kind === "SECONDS"
          ? `${grade.nextAt}s`
          : `${grade.nextAt} reps`;

  return (
    <li>
      <Link
        to="/lift/$exerciseId"
        params={{ exerciseId: grade.exerciseId }}
        className="flex items-center justify-between gap-2 rounded-xl border border-grit px-3 py-2 press"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-grit">{grade.name}</span>
          <span className="label-cap text-[9px]" style={{ color }}>
            {grade.tier}
            {target && (
              <span className="text-grit-dim">
                {" "}
                · {target} for {grade.nextTier}
              </span>
            )}
          </span>
        </span>
        <span className="display shrink-0 text-sm font-extrabold text-grit">{measured}</span>
      </Link>
    </li>
  );
}

function MissingStrengthProfile({
  needsBodyweight,
  needsStrengthReference,
}: {
  needsBodyweight: boolean;
  needsStrengthReference: boolean;
}) {
  const both = needsBodyweight && needsStrengthReference;
  return (
    <section className="mt-5 px-5">
      <div className="rounded-2xl border border-grit bg-grit-card p-5">
        <Info size={22} className="text-accent-red" />
        <p className="display mt-3 text-lg font-extrabold uppercase text-grit">
          {both
            ? "Finish strength setup"
            : needsBodyweight
              ? "Add your bodyweight"
              : "Choose a strength reference"}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-grit-dim">
          {needsBodyweight
            ? "Strength is graded relative to what you weigh — a 100 kg bench means something very different at 60 kg than at 110."
            : "Male and female strength tables use different reference points. Choose the table you want DEADSET to use; we will not silently guess."}{" "}
          {both
            ? "Add both details in Profile and the map will switch on."
            : "Until then, the map stays grey."}
        </p>
        <Link to="/profile" className="btn-grit mt-4 w-full">
          Open strength setup
        </Link>
      </div>
    </section>
  );
}

function EmptyState({ hasPlannedExercises }: { hasPlannedExercises: boolean }) {
  return (
    <section className="px-5">
      <div className="rounded-2xl border border-grit bg-grit-card p-5">
        <p className="display text-lg font-extrabold uppercase text-grit">Nothing to grade yet</p>
        <p className="mt-1.5 text-xs leading-relaxed text-grit-dim">
          {hasPlannedExercises
            ? "Your exercises are set. Log their working sets and each covered muscle will move from grey to a real strength grade."
            : "Build your schedule first. Muscles without an exercise stay grey and say exactly what is missing—DEADSET never invents a score."}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {GRADED_MUSCLES.map((muscle) => (
            <span
              key={muscle}
              className="label-cap rounded-full border border-grit px-2.5 py-1 text-[9px] text-grit-dim"
            >
              {muscle}
            </span>
          ))}
        </div>
        <Link to={hasPlannedExercises ? "/train" : "/plan"} className="btn-grit mt-4 w-full">
          {hasPlannedExercises ? "Start a workout" : "Set up exercises"}
        </Link>
      </div>
    </section>
  );
}
