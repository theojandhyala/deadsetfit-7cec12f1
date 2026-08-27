import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight, Lock, Info, TrendingUp } from "lucide-react";

import { useAppState } from "@/lib/storage";
import { allExercises } from "@/lib/exercises";
import { usePro } from "@/hooks/usePro";
import { useCountUp } from "@/hooks/useCountUp";
import { openPaywall } from "@/lib/paywall-events";
import { formatWeight, unitOf } from "@/lib/units";
import { hapticSelection } from "@/lib/haptics";
import { MuscleDiagram } from "@/components/MuscleDiagram";
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
  const { isPro, loading: proLoading } = usePro();
  const unit = unitOf(state);

  const library = useMemo(
    () =>
      allExercises(state.savedExercises).map((e) => ({
        id: e.id,
        name: e.name,
        muscleGroup: e.muscleGroup,
      })),
    [state.savedExercises],
  );
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
    for (const day of Object.values(state.schedule ?? {})) {
      for (const exerciseId of day.exerciseIds) {
        const muscle = definitions.find((exercise) => exercise.id === exerciseId)?.muscleGroup;
        if (muscle) covered.add(muscle);
      }
    }
    const active = state.programs.find((program) => program.id === state.activeProgramId);
    for (const day of Object.values(active?.days ?? {})) {
      for (const exercise of day.items) {
        exercise.primary_muscles.forEach((muscle) => covered.add(muscle.toUpperCase()));
      }
    }
    return covered;
  }, [state.schedule, state.programs, state.activeProgramId, state.savedExercises]);
  const displayScore = useCountUp(report.score, 900);
  const locked = !proLoading && !isPro;

  const needsBodyweight = !state.profile?.weightKg;

  return (
    <div className="deadset-page min-h-screen pb-28">
      <header className="px-5 pt-6 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-cap text-grit-dim">YOUR STRENGTH</p>
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

      {needsBodyweight ? (
        <MissingBodyweight />
      ) : (
        <>
          <StrengthBodyComparison
            baseline={baseline}
            current={report}
            plannedMuscles={plannedMuscles}
          />

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
}: {
  baseline: StrengthReport | null;
  current: StrengthReport;
  plannedMuscles: Set<string>;
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
              <div key={muscle} className="rounded-xl border border-grit bg-black/30 px-3 py-2">
                <p className="label-cap text-[9px] text-grit">{muscle}</p>
                <p
                  className="mt-0.5 text-[9px] leading-tight"
                  style={{ color: grade ? TIER_COLOR[grade.tier] : "#777" }}
                >
                  {grade
                    ? `${grade.tier} · ${grade.exercises.length} lift${grade.exercises.length === 1 ? "" : "s"}`
                    : planned
                      ? "Exercises set · log weighted sets"
                      : "No exercises set for that"}
                </p>
              </div>
            );
          })}
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

function MissingBodyweight() {
  return (
    <section className="px-5">
      <div className="rounded-2xl border border-grit bg-grit-card p-5">
        <Info size={22} className="text-accent-red" />
        <p className="display mt-3 text-lg font-extrabold uppercase text-grit">
          Add your bodyweight
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-grit-dim">
          Strength is graded relative to what you weigh — a 100 kg bench means something very
          different at 60 kg than at 110. Without it we'd be guessing, so we won't grade you at all.
        </p>
        <Link to="/profile" className="btn-grit mt-4 w-full">
          Set bodyweight
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
