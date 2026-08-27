import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronLeft, Lock, Info, TrendingUp } from "lucide-react";

import { useAppState } from "@/lib/storage";
import { allExercises } from "@/lib/exercises";
import { usePro } from "@/hooks/usePro";
import { useCountUp } from "@/hooks/useCountUp";
import { openPaywall } from "@/lib/paywall-events";
import { formatWeight, unitOf } from "@/lib/units";
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
    () => allExercises(state.savedExercises).map((e) => ({ id: e.id, name: e.name })),
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
  const displayScore = useCountUp(report.score, 900);
  const locked = !proLoading && !isPro;

  const needsBodyweight = !state.profile?.weightKg;

  return (
    <div className="deadset-page min-h-screen pb-28">
      <header className="px-5 pt-6 pb-3 flex items-center gap-2">
        <Link to="/progress" className="text-grit-dim" aria-label="Back to progress">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0">
          <p className="label-cap text-grit-dim">YOUR STRENGTH</p>
          <h1 className="display text-2xl font-extrabold uppercase text-grit">
            How strong are you?
          </h1>
        </div>
      </header>

      {needsBodyweight ? (
        <MissingBodyweight />
      ) : report.gradedCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          <OverallCard tier={report.tier} score={report.score} displayScore={displayScore} />

          <StrengthBodyComparison baseline={baseline} current={report} />

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

function reportColors(report: StrengthReport | null) {
  return Object.fromEntries(
    (report?.muscles ?? []).map((grade) => [grade.muscle, TIER_COLOR[grade.tier]]),
  );
}

function StrengthBodyComparison({
  baseline,
  current,
}: {
  baseline: StrengthReport | null;
  current: StrengthReport;
}) {
  const hasBaseline = Boolean(baseline?.gradedCount);
  return (
    <section className="px-5 mt-5">
      <div className="rounded-2xl border border-grit bg-grit-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="label-cap text-[10px] text-accent-red">STRENGTH MAP</p>
          <p className="label-cap text-[9px] text-grit-dim">FRONT + BACK</p>
        </div>
        <div className={`mt-3 grid ${hasBaseline ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
          {hasBaseline && (
            <div className="text-center">
              <p className="label-cap text-[9px] text-grit-dim">FIRST 90 DAYS</p>
              <MuscleDiagram gradeColors={reportColors(baseline)} size={150} />
              <p className="display text-lg font-extrabold text-grit">{baseline!.score}</p>
            </div>
          )}
          <div className="text-center">
            <p className="label-cap text-[9px] text-grit-dim">NOW</p>
            <MuscleDiagram gradeColors={reportColors(current)} size={150} />
            <p className="display text-lg font-extrabold text-grit">{current.score}</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-grit-dim">
          Colour shows the real grade of each muscle—not training volume or a body transformation.
        </p>
      </div>
    </section>
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
            {step.slice(0, 4)}
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

function EmptyState() {
  return (
    <section className="px-5">
      <div className="rounded-2xl border border-grit bg-grit-card p-5">
        <p className="display text-lg font-extrabold uppercase text-grit">Nothing to grade yet</p>
        <p className="mt-1.5 text-xs leading-relaxed text-grit-dim">
          Log a few working sets and every muscle group gets a grade here — from Beginner to Elite,
          measured against real strength standards.
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
        <Link to="/train" className="btn-grit mt-4 w-full">
          Start a workout
        </Link>
      </div>
    </section>
  );
}
