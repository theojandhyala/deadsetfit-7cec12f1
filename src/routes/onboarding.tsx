import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  BellRing,
  ChevronLeft,
  Dumbbell,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Zap,
} from "lucide-react";
import { GritLogo } from "@/components/GritLogo";
import { SetupLivePreview } from "@/components/SetupLivePreview";
import { WheelPicker } from "@/components/WheelPicker";
import { StrengthEngineTutorial } from "@/components/StrengthEngineTutorial";
import { getState, setLocalStateOwner, setState, waitForRemoteState } from "@/lib/storage";
import { defaultSchedule, focusExerciseRecommendation, isoDay, WEEK } from "@/lib/calc";
import { EXERCISES, getExercise } from "@/lib/exercises";
import { getMyProfile, saveProfile } from "@/lib/profile.functions";
import { saveUserState } from "@/lib/user-state.functions";
import { profileFromAccount, profileQuestionsComplete, withTimeout } from "@/lib/account-restore";
import type {
  DayKey,
  Equipment,
  Experience,
  FocusMuscle,
  Gender,
  Goal,
  Profile,
  Schedule,
  Weakness,
} from "@/lib/types";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { daysPerWeekFor, describeDays, MIN_TRAINING_DAYS } from "@/lib/training-days";
import { buildPublicStats } from "@/lib/fifa-stats";
import { currencyForCountry, detectCountry, type SupportedCurrency } from "@/lib/currency";
import { toDisplay, toKg, trimNumber, type WeightUnit } from "@/lib/units";
import {
  ONBOARDING_CHAPTERS,
  onboardingOrder,
  onboardingStageLabel,
  type OnboardingActiveStep,
  type OnboardingMode,
} from "@/lib/onboarding-flow";
import { hapticFailure, hapticSaved, hapticSelection } from "@/lib/haptics";
import { deriveLiveSetupBlueprint } from "@/lib/setup-blueprint";
import { normaliseDecimalInput } from "@/lib/programme-weight-setup";
import { finishAppBoot } from "@/lib/app-boot";
import { requestWorkoutNotificationPermission } from "@/lib/device-reminders";
import { isNativeIos } from "@/lib/platform";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "DEADSET — Onboarding" }] }),
  component: Onboarding,
});

// The walk is defined once, in the flow module. Aliasing it here keeps the
// screen switch below exhaustive against the real order rather than against a
// second list that can quietly drift out of step with it.
type Step = OnboardingActiveStep;

type Mode = OnboardingMode;

const REP_TARGETS = [
  "1-3",
  "3-5",
  "5-8",
  "6-8",
  "6-10",
  "8-10",
  "8-12",
  "10-12",
  "10-15",
  "10/leg",
  "12-15",
  "12-20",
  "15-20",
  "45-60s",
  "AMRAP",
] as const;

/** How long a session runs, given how many exercises are in it. */
function sessionMinutesFor(exercises: number): NonNullable<Profile["sessionMinutes"]> {
  if (exercises <= 3) return 30;
  if (exercises <= 4) return 45;
  if (exercises <= 5) return 60;
  return 90;
}

/** The name the athlete is addressed by on later screens. */
function firstNameOf(draft: Partial<Profile>): string {
  const raw = (draft.displayName ?? "").trim();
  if (!raw) return "";
  return raw.split(/\s+/)[0].slice(0, 18);
}

function scheduleInputsFingerprint(profile: Partial<Profile>): string {
  return JSON.stringify({
    goal: profile.goal ?? null,
    experience: profile.experience ?? null,
    trainingDays: profile.trainingDays ?? null,
    daysPerWeek: profile.daysPerWeek ?? null,
    equipment: profile.equipment ?? null,
    focusMuscles: profile.focusMuscles ?? null,
    exercisesPerSession: profile.exercisesPerSession ?? null,
    sessionMinutes: profile.sessionMinutes ?? null,
  });
}

function isDevelopmentSetupPreview(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1"
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [mode, setMode] = useState<Mode | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  // Not part of Profile — it lives on app state — but it has to be chosen here,
  // before the weight question, or "80" could mean either thing.
  const [units, setUnits] = useState<WeightUnit>("kg");
  const [draftSchedule, setDraftSchedule] = useState<Schedule | null>(null);
  const savingRef = useRef(false);
  const save = saveProfile;
  const saveFullState = saveUserState;
  const getProfile = getMyProfile;
  const ORDER = useMemo(() => onboardingOrder(mode) as Step[], [mode]);
  const step = ORDER[idx];

  useEffect(() => {
    if (userId) finishAppBoot();
  }, [userId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isDevelopmentSetupPreview()) {
          setUserId("local-preview");
          return;
        }
        const { supabase } = await import("@/integrations/supabase/client");
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), { data: { session: null }, error: null });
        if (cancelled) return;
        if (!session) {
          navigate({ to: "/auth", replace: true });
          return;
        }
        setUserId(session.user.id);
        await withTimeout(waitForRemoteState(session.user.id), undefined);
        if (cancelled) return;
        const row = await withTimeout(
          getProfile().catch(() => null),
          null,
        );
        const accountProfile = profileQuestionsComplete(row) ? profileFromAccount(row) : null;
        if (accountProfile) {
          setState((current) => ({
            ...current,
            profile: accountProfile,
            schedule: current.schedule ?? defaultSchedule(accountProfile),
          }));
          navigate({ to: "/upgrade", replace: true });
        }
      } catch {
        // Auth hiccup: stay on onboarding — the final save re-checks the session.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getProfile, navigate]);

  function next(patch: Partial<Profile>) {
    const upcoming = ORDER[idx + 1];
    const merged = { ...draft, ...patch };
    // Keep the live read-back and the visibly selected defaults identical from
    // the first frame of each screen, even before the athlete taps a control.
    if (upcoming === "days" && !merged.trainingDays?.length) {
      merged.trainingDays = ["MON", "WED", "FRI"];
      merged.daysPerWeek = 3;
    }
    if (upcoming === "focus") merged.focusMuscles ??= [];
    // Session length is never asked directly — it follows from how many
    // exercises the athlete wants, so it has to be recomputed here rather than
    // left at whatever a previous answer implied.
    if (patch.exercisesPerSession != null) {
      merged.sessionMinutes = sessionMinutesFor(patch.exercisesPerSession);
    }
    setDirection("forward");
    hapticSelection();
    setDraft(merged);
    if (draftSchedule && scheduleInputsFingerprint(draft) !== scheduleInputsFingerprint(merged)) {
      setDraftSchedule(null);
    }
    if (idx === ORDER.length - 1) {
      // Guard against a double-tap on the final CTA firing two saves. The
      // userId check must come first — locking savingRef before it would
      // permanently swallow every retry once the session-loading toast shows.
      if (savingRef.current) return;
      if (!userId) {
        toast.error("Your session is still loading. Try again.");
        return;
      }
      savingRef.current = true;
      // The first workout should not be blocked by body-stat questions. Keep
      // durable defaults here; the profile screen can refine calorie and
      // strength-standard calculations whenever the athlete is ready.
      const p: Profile = {
        goal: merged.goal ?? "MAINTAIN",
        experience: merged.experience ?? "BEGINNER",
        // These are required in the active flow. Zero is a defensive fallback
        // that keeps Strength explicitly ungraded if a future route bypasses
        // the screen; never invent a 75 kg athlete.
        age: merged.age ?? 0,
        weightKg: merged.weightKg ?? 0,
        heightCm: merged.heightCm ?? 0,
        gender: merged.gender ?? "OTHER",
        daysPerWeek: merged.daysPerWeek ?? 3,
        trainingDays: merged.trainingDays ?? ["MON", "WED", "FRI"],
        equipment: merged.equipment ?? "FULL_GYM",
        exercisesPerSession: merged.exercisesPerSession ?? 4,
        sessionMinutes: merged.sessionMinutes ?? 45,
        focusMuscles: merged.focusMuscles ?? [],
        motivation: merged.motivation ?? "DISCIPLINE",
        sleepQuality: merged.sleepQuality ?? "OK",
        weakness: merged.weakness ?? "CONSISTENCY",
        displayName: merged.displayName ?? merged.username,
        injuries: merged.injuries ?? "",
        startingWeightKg: merged.startingWeightKg ?? merged.weightKg ?? 0,
        username: merged.username,
        avatarDataUrl: merged.avatarDataUrl,
        targetWeightKg: merged.targetWeightKg,
        dreamOutcome: merged.dreamOutcome,
        commitmentDate: merged.commitmentDate,
        committed: merged.committed,
      };
      // BUILD starts in edit mode, but it must still finish with a usable first
      // week. Saving an empty schedule strands the athlete on Train.
      const sched = draftSchedule ?? defaultSchedule(p);
      const publicStats = buildPublicStats({ ...getState(), profile: p, schedule: sched });
      save({
        data: {
          username: p.username,
          display_name: (p.displayName?.trim() || p.username || "Athlete").slice(0, 60),
          goal: p.goal,
          experience: p.experience,
          gender: p.gender,
          age: p.age,
          weight_kg: p.weightKg,
          height_cm: p.heightCm,
          days_per_week: p.daysPerWeek,
          equipment: p.equipment,
          avatar_url: p.avatarDataUrl,
          public_stats: publicStats,
          onboarded: true,
        },
      })
        .then(async () => {
          setLocalStateOwner(userId);
          const nextState = { ...getState(), profile: p, schedule: sched, units };
          setState(() => nextState);
          await saveFullState({ data: { data: JSON.stringify(nextState) } }).catch(() => {
            toast.warning("Setup saved locally. We'll keep trying to sync it.");
          });
          hapticSaved();
          navigate({ to: "/upgrade", replace: true });
        })
        .catch((e: Error) => {
          savingRef.current = false;
          hapticFailure();
          const msg = e.message || "Couldn't save profile";
          if (/username/i.test(msg)) {
            toast.error("That @username is taken — pick another.");
            setIdx(Math.max(ORDER.indexOf("username"), 0));
          } else {
            toast.error(msg);
          }
        });
    } else {
      setIdx(idx + 1);
    }
  }

  function previewDraft(patch: Partial<Profile>) {
    const merged = { ...draft, ...patch };
    if (draftSchedule && scheduleInputsFingerprint(draft) !== scheduleInputsFingerprint(merged)) {
      setDraftSchedule(null);
    }
    setDraft(merged);
  }

  const chapterOf = useMemo(() => {
    // The rail shows named chapters rather than a raw step count, so "23 of 26"
    // never lands as a wall of work. Each chapter fills as its own screens are
    // answered, and the active one is partly filled rather than binary.
    const counts = new Map<string, { total: number; done: number }>();
    ORDER.forEach((entry, position) => {
      const chapter = onboardingStageLabel(entry);
      const bucket = counts.get(chapter) ?? { total: 0, done: 0 };
      bucket.total += 1;
      if (position < idx) bucket.done += 1;
      counts.set(chapter, bucket);
    });
    return counts;
  }, [ORDER, idx]);

  const chapter = onboardingStageLabel(step);
  const pct = idx === 0 ? 0 : Math.round((idx / Math.max(1, ORDER.length - 1)) * 100);
  const name = firstNameOf(draft);
  const showPreview =
    idx >= ORDER.indexOf("days") &&
    !["mode", "analyzing", "schedule", "notifications", "blueprint"].includes(step);

  return (
    <div
      className="deadset-onboarding min-h-[100dvh] bg-grit flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <header className="px-6 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {idx > 0 && (
              <button
                onClick={() => {
                  hapticSelection();
                  setDirection("back");
                  setIdx(idx - 1);
                }}
                aria-label="Back"
                className="w-9 h-9 -ml-2 flex items-center justify-center rounded-full border border-grit bg-grit-card text-grit-dim press"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <GritLogo className="w-28" />
          </div>
          <span className="label-cap text-[9px]">
            {idx === 0 ? "LIVE SETUP" : `${chapter} · ${idx} / ${ORDER.length - 1}`}
          </span>
        </div>

        <div
          className="mt-4 flex items-center gap-1.5"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${chapter}, ${pct}% complete`}
        >
          {ONBOARDING_CHAPTERS.map((entry) => {
            const bucket = chapterOf.get(entry);
            const fill = bucket?.total ? Math.round((bucket.done / bucket.total) * 100) : 0;
            const active = entry === chapter;
            return (
              <span
                key={entry}
                className={`deadset-setup-progress flex-1 ${active ? "deadset-chapter-active-track" : ""}`}
              >
                <span className="deadset-setup-progress-fill block" style={{ width: `${fill}%` }} />
              </span>
            );
          })}
        </div>
      </header>

      {showPreview && (
        <div className="px-6 pb-1">
          <SetupLivePreview
            draft={draft}
            mode={mode ?? "GENERATE"}
            schedule={draftSchedule}
            compact
          />
        </div>
      )}

      <div
        key={step}
        className={`flex-1 px-6 pt-6 pb-10 flex flex-col ${
          direction === "back" ? "deadset-step-back" : "deadset-step"
        }`}
      >
        {step === "welcome" && <WelcomeStep onStart={() => next({})} />}
        {step === "name" && (
          <NameStep initial={draft.displayName} onSubmit={(n) => next({ displayName: n })} />
        )}
        {step === "goal" && (
          <Choice
            eyebrow={name ? `ALRIGHT ${name.toUpperCase()}` : undefined}
            title="What are you here to do?"
            sub="Everything after this — your split, your fuel targets, your rank — is built around this answer."
            options={[
              { v: "BULK", l: "Bulk", sub: "Add size and strength. Eat for growth." },
              { v: "CUT", l: "Cut", sub: "Strip fat, hold the muscle you built." },
              { v: "MAINTAIN", l: "Maintain", sub: "Stay strong and sharp where you are." },
              { v: "ATHLETIC", l: "Athletic performance", sub: "Power, speed and work capacity." },
            ]}
            onPick={(v) => next({ goal: v as Goal })}
          />
        )}
        {step === "why" && (
          <Choice
            eyebrow="No wrong answer — be honest"
            title="Why are you really here?"
            options={[
              {
                v: "STRONGER",
                l: "Get seriously strong",
                sub: "Move real weight. Numbers that shut people up.",
              },
              { v: "PHYSIQUE", l: "Build the physique", sub: "Look like you lift. Head-turning." },
              {
                v: "CONFIDENCE",
                l: "Feel confident again",
                sub: "In my own skin, in the mirror, everywhere.",
              },
              {
                v: "DISCIPLINE",
                l: "Prove I can commit",
                sub: "No more starting and quitting. This time it sticks.",
              },
              {
                v: "COMPETE",
                l: "Compete and win",
                sub: "Rank up, beat rivals, top the leaderboard.",
              },
            ]}
            onPick={(v) => next({ motivation: v })}
          />
        )}
        {step === "gender" && (
          <Choice
            eyebrow="Strength reference"
            title="Which standards should we grade you against?"
            sub="Strength grades compare your lifts to a reference table. Picking the wrong one makes every grade wrong."
            options={[
              { v: "MALE", l: "Male standards" },
              { v: "FEMALE", l: "Female standards" },
              {
                v: "OTHER",
                l: "Rather not say",
                sub: "Grades stay grey until you choose in Profile. We will not guess.",
              },
            ]}
            onPick={(v) => next({ gender: v as Gender })}
          />
        )}
        {step === "age" && (
          <AgeStep name={name} initial={draft.age} onSubmit={(age) => next({ age })} />
        )}
        {step === "units" && (
          <UnitsStep
            value={units}
            onSubmit={(chosen) => {
              setUnits(chosen);
              next({});
            }}
          />
        )}
        {step === "weight" && (
          <WeightStep
            unit={units}
            initial={draft.weightKg}
            onSubmit={(weightKg) => next({ weightKg, startingWeightKg: weightKg })}
          />
        )}
        {step === "height" && (
          <HeightStep initial={draft.heightCm} onSubmit={(heightCm) => next({ heightCm })} />
        )}
        {step === "experience" && (
          <Choice
            eyebrow="Be honest — it sets your starting loads"
            title="How long have you been training?"
            options={[
              {
                v: "BEGINNER",
                l: "Beginner",
                sub: "Under a year, or coming back after a long break.",
              },
              {
                v: "INTERMEDIATE",
                l: "Intermediate",
                sub: "One to three years of steady lifting.",
              },
              { v: "ADVANCED", l: "Advanced", sub: "Years under the bar. You know your numbers." },
            ]}
            onPick={(v) => next({ experience: v as Experience })}
          />
        )}
        {step === "days" && (
          <TrainingDaysStep
            name={name}
            initial={draft.trainingDays}
            onPreview={(days) =>
              previewDraft({ trainingDays: days, daysPerWeek: daysPerWeekFor(days) })
            }
            onSubmit={(days) => next({ trainingDays: days, daysPerWeek: daysPerWeekFor(days) })}
          />
        )}
        {step === "equipment" && (
          <Choice
            title="What can you train with?"
            sub="We only ever program exercises you can actually do."
            options={[
              { v: "FULL_GYM", l: "Full gym", sub: "Racks, machines, full dumbbell range." },
              { v: "HOME_GYM", l: "Home gym", sub: "Some plates, a bar or dumbbells." },
              { v: "BODYWEIGHT", l: "Bodyweight only", sub: "No equipment needed." },
            ]}
            onPick={(v) => next({ equipment: v as Equipment })}
          />
        )}
        {step === "focus" && (
          <FocusStep
            initial={draft.focusMuscles}
            onPreview={(muscles) => previewDraft({ focusMuscles: muscles })}
            onSubmit={(muscles) => next({ focusMuscles: muscles })}
            onSkip={() => next({ focusMuscles: [] })}
          />
        )}
        {step === "session" && (
          <Choice
            eyebrow="You can change every day later"
            title="How long should a session run?"
            options={[
              { v: "3", l: "About 30 minutes", sub: "3 exercises. In and out." },
              { v: "4", l: "About 45 minutes", sub: "4 exercises. Main lifts plus accessories." },
              { v: "5", l: "About an hour", sub: "5 exercises. Balanced — recommended." },
              { v: "6", l: "Around 90 minutes", sub: "6 exercises. More volume and variety." },
              { v: "7", l: "Long sessions", sub: "7 exercises. High volume." },
            ]}
            onPick={(v) =>
              next({
                exercisesPerSession: Number(v) as 3 | 4 | 5 | 6 | 7,
                sessionMinutes: sessionMinutesFor(Number(v)),
              })
            }
          />
        )}
        {step === "sleep" && (
          <Choice
            eyebrow="Recovery is where you actually grow"
            title="How much do you sleep?"
            options={[
              { v: "LOW", l: "Under 6 hours", sub: "We'll build in extra recovery." },
              { v: "OK", l: "6–7 hours", sub: "Workable — we'll help you protect it." },
              { v: "GOOD", l: "7–8 hours", sub: "Solid foundation to build on." },
              { v: "GREAT", l: "8+ hours", sub: "Elite recovery. Let's use it." },
            ]}
            onPick={(v) => next({ sleepQuality: v as Profile["sleepQuality"] })}
          />
        )}
        {step === "weakness" && (
          <Choice
            eyebrow="Last one about you"
            title="What has stopped you before?"
            options={[
              {
                v: "CONSISTENCY",
                l: "I stop showing up",
                sub: "Streak alerts and rivals for you.",
              },
              { v: "STRENGTH", l: "My numbers stall", sub: "We'll drive progression harder." },
              { v: "DIET", l: "Eating is the hard part", sub: "Fuel targets front and centre." },
              { v: "RECOVERY", l: "I burn out", sub: "We'll protect your rest days." },
            ]}
            onPick={(v) => next({ weakness: v as Weakness })}
          />
        )}
        {step === "mode" && (
          <ModeStep
            name={name}
            onPick={(m: Mode) => {
              if (m !== mode) setDraftSchedule(null);
              setMode(m);
              next({});
            }}
          />
        )}
        {step === "analyzing" && <AnalyzingStep draft={draft} onDone={() => next({})} />}
        {step === "schedule" && (
          <SchedulePreview
            draft={draft}
            initial={draftSchedule}
            startEditing={mode === "BUILD"}
            onContinue={(schedule) => {
              setDraftSchedule(schedule);
              next({});
            }}
          />
        )}
        {step === "notifications" && <NotificationStep onContinue={() => next({})} />}
        {step === "username" && (
          <UsernameStep
            name={name}
            initial={draft.username}
            onSubmit={(u) => next({ username: u })}
          />
        )}
        {step === "blueprint" && (
          <BlueprintStep
            draft={draft}
            mode={mode ?? "GENERATE"}
            schedule={draftSchedule ?? defaultSchedule(draft as Profile)}
            onEnter={() => next({})}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The opening screen.
 *
 * It asks for nothing. Setup that opens on a question reads as a form; setup
 * that opens on a promise — and an honest estimate of how long it takes —
 * reads as something worth finishing.
 */
function WelcomeStep({ onStart }: { onStart: () => void }) {
  const promises = [
    {
      icon: <Sparkles size={15} />,
      title: "A week built around you",
      body: "Your days, your equipment, your priorities — not a template.",
    },
    {
      icon: <ShieldCheck size={15} />,
      title: "Graded against real standards",
      body: "Strength is measured, never invented. Grey until you earn it.",
    },
    {
      icon: <Timer size={15} />,
      title: "One question at a time",
      body: "No forms. Change any answer later in Settings.",
    },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <div className="deadset-setup-hero relative flex flex-1 flex-col items-center justify-center text-center">
        {/*
          The wordmark ships as a PNG with an opaque plate behind it, so a glow
          centred on the logo is simply occluded — and the plate reads as a box.
          Sitting the glow low, under the headline, lights the screen without
          ever passing behind the artwork.
        */}
        <div
          className="deadset-setup-glow pointer-events-none absolute bottom-0 h-44 w-72 rounded-full bg-accent-red/20 blur-3xl"
          aria-hidden="true"
        />
        <GritLogo className="relative w-56" />
        <h1 className="display relative mt-6 text-[2.6rem] font-black uppercase leading-[0.92] text-grit">
          Let&apos;s build
          <br />
          your system
        </h1>
        <p className="relative mt-4 max-w-xs text-sm leading-relaxed text-grit-dim">
          A handful of questions. Your first training week is waiting on the other side.
        </p>
      </div>

      <div className="deadset-step-stagger mt-6 grid gap-2">
        {promises.map((promise) => (
          <div
            key={promise.title}
            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-grit-card px-4 py-3"
          >
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-accent-red/50 bg-accent-red/12 text-accent-red">
              {promise.icon}
            </span>
            <span>
              <span className="block text-xs font-extrabold text-grit">{promise.title}</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-grit-dim">
                {promise.body}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button onClick={onStart} className="btn-grit w-full min-h-14 animate-subtle-pulse">
          <Zap size={16} className="mr-2" />
          Start setup
        </button>
        <p className="mt-2 text-center text-[10px] uppercase tracking-[0.12em] text-grit-dim">
          About a minute
        </p>
      </div>
    </div>
  );
}

/**
 * A one-tap question.
 *
 * Tapping an answer advances the flow on its own — on a walk this long, a
 * second tap on a Continue button for a decision the athlete has already made
 * is the difference between it feeling quick and feeling like paperwork. The
 * short pause before advancing is not padding: it is the beat in which the
 * choice visibly lands, so nobody is left unsure which option they hit.
 */
function Choice({
  title,
  eyebrow,
  sub,
  options,
  onPick,
}: {
  title: string;
  eyebrow?: string;
  sub?: string;
  options: { v: string; l: string; sub?: string }[];
  onPick: (v: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function pick(value: string) {
    // Locked after the first tap: a second answer mid-transition would advance
    // twice and skip the following question entirely.
    if (chosen) return;
    setChosen(value);
    hapticSelection();
    timer.current = setTimeout(() => onPick(value), 250);
  }

  return (
    <>
      {eyebrow && <p className="label-cap text-accent-red text-[10px] mb-1">{eyebrow}</p>}
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        {title}
      </h1>
      {sub && <p className="mt-2 text-sm leading-relaxed text-grit-dim">{sub}</p>}
      <div className="mt-7 flex flex-col gap-2.5">
        {options.map((o, i) => {
          const isChosen = chosen === o.v;
          return (
            <button
              key={o.v}
              onClick={() => pick(o.v)}
              aria-pressed={isChosen}
              style={{ animationDelay: `${60 + i * 55}ms` }}
              className={`deadset-option bg-grit-card border border-grit rounded-2xl p-5 text-left hover:border-accent-red press ${
                isChosen ? "deadset-option-chosen" : chosen ? "deadset-option-dimmed" : ""
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="display text-lg uppercase tracking-wide font-bold text-grit block">
                  {o.l}
                </span>
                {isChosen && (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-red text-white">
                    <Check size={14} />
                  </span>
                )}
              </span>
              {o.sub && (
                <span className="text-[12px] text-grit-dim mt-1 block normal-case">{o.sub}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * Kilograms or pounds.
 *
 * Asked before anything is weighed, because every weight after this — the
 * athlete's own bodyweight, every load, every strength grade computed against
 * that bodyweight — is meaningless until the number has a unit attached.
 */
function UnitsStep({
  value,
  onSubmit,
}: {
  value: WeightUnit;
  onSubmit: (unit: WeightUnit) => void;
}) {
  const [choice, setChoice] = useState<WeightUnit>(value);
  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">BEFORE WE WEIGH ANYTHING</p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        Kilos or pounds?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-grit-dim">
        Everything in DEADSET follows this — plates, the bar, your bodyweight, your strength grades.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {(["kg", "lb"] as const).map((option) => {
          const active = choice === option;
          return (
            <button
              key={option}
              onClick={() => {
                hapticSelection();
                setChoice(option);
              }}
              aria-pressed={active}
              className="deadset-option rounded-2xl border py-8 press"
              style={{
                borderColor: active ? "#e63222" : "rgba(255,255,255,.1)",
                background: active ? "rgba(230,50,34,.1)" : "rgba(18,18,18,.9)",
              }}
            >
              <span
                className="display block text-4xl font-extrabold uppercase"
                style={{ color: active ? "#e63222" : "#8a8a8a" }}
              >
                {option}
              </span>
              <span className="label-cap mt-1 block text-[10px] text-grit-dim">
                {option === "kg" ? "Kilograms" : "Pounds"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-grit-dim">
        Change it any time in Settings. Your history is stored in kilograms either way, so switching
        never alters a logged set.
      </p>

      <button onClick={() => onSubmit(choice)} className="btn-grit mt-auto min-h-14 w-full">
        Continue
      </button>
    </div>
  );
}

function AgeStep({
  name,
  initial,
  onSubmit,
}: {
  name: string;
  initial?: number;
  onSubmit: (age: number) => void;
}) {
  const [age, setAge] = useState(initial && initial >= 13 ? initial : 24);
  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">
        {name ? `ABOUT YOU, ${name.toUpperCase()}` : "ABOUT YOU"}
      </p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        How old are you?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-grit-dim">
        Age tunes your fuel targets and recovery spacing. Never shown publicly.
      </p>
      <div className="mt-8">
        <WheelPicker
          label="Age in years"
          value={age}
          onChange={setAge}
          min={13}
          max={90}
          step={1}
          suffix="yrs"
        />
      </div>
      <button onClick={() => onSubmit(age)} className="btn-grit mt-auto w-full min-h-14">
        Continue — {age} yrs
      </button>
    </div>
  );
}

function WeightStep({
  unit,
  initial,
  onSubmit,
}: {
  unit: WeightUnit;
  initial?: number;
  onSubmit: (weightKg: number) => void;
}) {
  // The wheel runs in the athlete's own units. Bounds are converted from the
  // same 30–250 kg human range the typed field used to enforce, so a pound
  // lifter is never told 400 lb is out of range.
  const range = unit === "kg" ? { min: 30, max: 250, step: 0.5 } : { min: 66, max: 550, step: 1 };
  const fallback = unit === "kg" ? 80 : 176;
  const [value, setValue] = useState(() =>
    initial ? Number(toDisplay(initial, unit).toFixed(unit === "kg" ? 1 : 0)) : fallback,
  );
  const kg = toKg(value, unit);
  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">STRENGTH CALIBRATION</p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        What do you weigh?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-grit-dim">
        Bodyweight is the denominator of every strength grade you will earn. This is the number that
        keeps the Strength Map honest.
      </p>
      <div className="mt-8">
        <WheelPicker
          label={`Bodyweight in ${unit === "kg" ? "kilograms" : "pounds"}`}
          value={value}
          onChange={setValue}
          min={range.min}
          max={range.max}
          step={range.step}
          suffix={unit}
        />
      </div>
      <p className="mt-6 text-center text-[10px] leading-relaxed text-grit-dim">
        Stored in kilograms, so switching units later never alters a logged set.
      </p>
      <button onClick={() => onSubmit(kg)} className="btn-grit mt-auto w-full min-h-14">
        Continue — {trimNumber(value)} {unit}
      </button>
    </div>
  );
}

function HeightStep({
  initial,
  onSubmit,
}: {
  initial?: number;
  onSubmit: (heightCm: number) => void;
}) {
  const [cm, setCm] = useState(initial && initial >= 120 ? Math.round(initial) : 178);
  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">STRENGTH CALIBRATION</p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        How tall are you?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-grit-dim">
        Height sets your calorie baseline. It is the last thing we ask about your body.
      </p>
      <div className="mt-8">
        <WheelPicker
          label="Height in centimetres"
          value={cm}
          onChange={setCm}
          min={120}
          max={230}
          step={1}
          suffix="cm"
          secondary={feetAndInches}
        />
      </div>
      <button onClick={() => onSubmit(cm)} className="btn-grit mt-auto w-full min-h-14">
        Continue — {cm} cm
      </button>
    </div>
  );
}

/** The same height in feet and inches, for anyone who does not think in centimetres. */
function feetAndInches(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}′ ${inches}″`;
}

function NameStep({ initial, onSubmit }: { initial?: string; onSubmit: (name: string) => void }) {
  // DOM-owned input (defaultValue + shadow state) — controlled value= freezes
  // typing in the iOS WKWebView.
  const [shadow, setShadow] = useState(initial ?? "");
  const valid = shadow.trim().length >= 1;
  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">FIRST THINGS FIRST</p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        What should we call you?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-grit-dim">
        Shown on your athlete card and nowhere you have not put it. Your public @handle comes at the
        end.
      </p>
      <input
        autoFocus
        defaultValue={initial ?? ""}
        onChange={(e) => setShadow(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valid) onSubmit(shadow.trim());
        }}
        maxLength={40}
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        className="mt-9 w-full border-b-2 border-grit bg-transparent pb-2 font-display text-3xl font-extrabold text-grit outline-none focus:border-accent-red"
        placeholder="Your name"
      />
      <button
        disabled={!valid}
        onClick={() => onSubmit(shadow.trim())}
        className="btn-grit mt-auto min-h-14 w-full disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}

function UsernameStep({
  name,
  initial,
  onSubmit,
}: {
  name: string;
  initial?: string;
  onSubmit: (u: string) => void;
}) {
  const [v, setV] = useState(initial ?? "");
  const clean = v
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  const valid = clean.length >= 3;
  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">ONE LAST THING</p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        Claim your handle
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-grit-dim">
        This is how {name ? `${name} shows` : "you show"} up on leaderboards, duels and the feed.
        Three characters or more.
      </p>
      <div className="mt-9 flex items-center gap-2 border-b-2 border-grit focus-within:border-accent-red">
        <span className="pb-2 font-display text-3xl font-extrabold text-grit-dim">@</span>
        <input
          autoFocus
          defaultValue={clean}
          onChange={(e) => {
            const c = e.target.value
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "")
              .slice(0, 20);
            e.target.value = c;
            setV(c);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) onSubmit(clean);
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="flex-1 bg-transparent pb-2 font-display text-4xl font-extrabold text-grit outline-none"
          placeholder="ironwolf"
        />
      </div>

      {/* A read-back of the handle exactly where it will actually appear. */}
      <div className="deadset-step-stagger mt-7">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-grit-card px-4 py-3">
          <span className="display w-6 text-center text-sm font-black text-accent-red">1</span>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-accent-red/40 bg-accent-red/12 font-display text-sm font-black uppercase text-accent-red">
            {(clean || name || "?").slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-extrabold text-grit">
              {name || "Your name"}
            </span>
            <span className="block truncate text-[11px] text-grit-dim">@{clean || "ironwolf"}</span>
          </span>
          <span className="label-cap text-[9px] text-grit-dim">LEADERBOARD</span>
        </div>
      </div>

      <button
        disabled={!valid}
        onClick={() => onSubmit(clean)}
        className="btn-grit mt-auto min-h-14 w-full disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}

function SchedulePreview({
  draft,
  initial,
  startEditing = false,
  onContinue,
}: {
  draft: Partial<Profile>;
  initial: Schedule | null;
  startEditing?: boolean;
  onContinue: (schedule: Schedule) => void;
}) {
  // Preview must match what actually gets saved.
  const stub = useMemo(
    () =>
      ({
        goal: draft.goal ?? "MAINTAIN",
        daysPerWeek: draft.daysPerWeek ?? 4,
        equipment: draft.equipment ?? "FULL_GYM",
        focusMuscles: draft.focusMuscles,
        exercisesPerSession: draft.exercisesPerSession ?? 5,
        trainingDays: draft.trainingDays,
      }) as Profile,
    [
      draft.goal,
      draft.daysPerWeek,
      draft.equipment,
      draft.focusMuscles,
      draft.exercisesPerSession,
      draft.trainingDays,
    ],
  );
  const [schedule, setSchedule] = useState<Schedule>(() => initial ?? defaultSchedule(stub));
  const [selectedDay, setSelectedDay] = useState<DayKey>(
    () => WEEK.find((day) => schedule[day].exerciseIds.length > 0) ?? "MON",
  );
  const [editing, setEditing] = useState(startEditing);

  const DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const available = EXERCISES.filter(
    (exercise) =>
      exercise.equipment.includes(stub.equipment) || exercise.equipment.includes("BODYWEIGHT"),
  );
  const selected = schedule[selectedDay];
  const configuredDays = DAYS.filter((day) => schedule[day].exerciseIds.length).length;

  function daySets(dayKey: DayKey) {
    return schedule[dayKey].sets ?? 3;
  }

  function dayReps(dayKey: DayKey) {
    return schedule[dayKey].reps ?? "8-12";
  }

  function updateDayTargets(dayKey: DayKey, patch: { sets?: number; reps?: string }) {
    hapticSelection();
    setSchedule((current) => ({
      ...current,
      [dayKey]: { ...current[dayKey], ...patch },
    }));
  }

  function updateExercisePlan(
    dayKey: DayKey,
    exerciseId: string,
    patch: { sets?: number; reps?: string },
  ) {
    hapticSelection();
    setSchedule((current) => ({
      ...current,
      [dayKey]: {
        ...current[dayKey],
        exerciseConfig: {
          ...(current[dayKey].exerciseConfig ?? {}),
          [exerciseId]: {
            ...(current[dayKey].exerciseConfig?.[exerciseId] ?? {}),
            ...patch,
          },
        },
      },
    }));
  }

  function moveExercise(dayKey: DayKey, index: number, direction: -1 | 1) {
    const target = index + direction;
    const exerciseIds = schedule[dayKey].exerciseIds;
    if (target < 0 || target >= exerciseIds.length) return;
    const next = [...exerciseIds];
    hapticSelection();
    [next[index], next[target]] = [next[target], next[index]];
    setSchedule((current) => ({
      ...current,
      [dayKey]: { ...current[dayKey], exerciseIds: next },
    }));
  }

  function removeExercise(dayKey: DayKey, exerciseId: string) {
    setSchedule((current) => {
      const exerciseIds = current[dayKey].exerciseIds.filter((id) => id !== exerciseId);
      const exerciseConfig = { ...(current[dayKey].exerciseConfig ?? {}) };
      delete exerciseConfig[exerciseId];
      return {
        ...current,
        [dayKey]: {
          ...current[dayKey],
          exerciseIds,
          exerciseConfig: Object.keys(exerciseConfig).length ? exerciseConfig : undefined,
          label: exerciseIds.length ? current[dayKey].label : "REST",
        },
      };
    });
  }

  function addExercise(exerciseId: string) {
    if (!exerciseId) return;
    const exercise = getExercise(exerciseId);
    if (!exercise) return;
    hapticSelection();
    setSchedule((current) => {
      const day = current[selectedDay];
      if (day.exerciseIds.includes(exerciseId)) return current;
      return {
        ...current,
        [selectedDay]: {
          ...day,
          label: day.label === "REST" ? exercise.muscleGroup : day.label,
          exerciseIds: [...day.exerciseIds, exerciseId],
        },
      };
    });
  }

  if (!editing) {
    const blueprint = deriveLiveSetupBlueprint(draft, { mode: "GENERATE", schedule });
    const trainingDays = blueprint.week.filter((day) => day.isTraining);
    return (
      <>
        <p className="label-cap mb-2 flex items-center gap-1.5 text-accent-red">
          <Zap size={12} fill="currentColor" /> YOUR WEEK IS LIVE
        </p>
        <h1 className="display mb-1 text-3xl font-extrabold uppercase text-grit sm:text-4xl">
          Built around your life
        </h1>
        <p className="mb-5 text-sm leading-relaxed text-[#8a8a8a]">
          This is the exact week DEADSET will save. Starting loads come next, one movement at a
          time.
        </p>

        <SetupLivePreview draft={draft} mode="GENERATE" schedule={schedule} />

        <div className="mt-4 space-y-2" aria-label="Generated training days">
          {trainingDays.map((day, index) => (
            <div
              key={day.dayKey}
              className="deadset-plan-reveal flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111214] px-3 py-2.5"
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-red/10 text-[10px] font-black text-accent-red">
                {day.dayKey}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black uppercase text-grit">{day.shortLabel}</p>
                <p className="text-[9px] text-grit-dim">
                  {day.exerciseCount} exercises · about {blueprint.sessionMinutes} min
                </p>
              </div>
              <Check size={14} className="shrink-0 text-emerald-400" />
            </div>
          ))}
        </div>

        <div className="mt-auto pt-5">
          <button
            type="button"
            onClick={() => {
              hapticSelection();
              setEditing(true);
            }}
            className="btn-ghost mb-2 w-full"
          >
            Fine-tune exercises, sets and reps
          </button>
          <button onClick={() => onContinue(schedule)} className="btn-grit w-full">
            Use this week
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="label-cap mb-2 flex items-center gap-1.5 text-accent-red">
        <Zap size={12} /> BUILD YOUR WEEK
      </p>
      <h1 className="display mb-1 text-3xl font-extrabold uppercase text-grit sm:text-4xl">
        Set every target now
      </h1>
      <p className="mb-5 text-sm leading-relaxed text-[#8a8a8a]">
        Choose the exercises, order, sets and reps before you start. Working weights are collected
        one at a time after the blueprint reveal.
      </p>

      <button
        type="button"
        onClick={() => {
          hapticSelection();
          setEditing(false);
        }}
        className="btn-ghost mb-4 w-full"
      >
        Back to week overview
      </button>

      <div className="grid grid-cols-7 gap-1.5" aria-label="Training week">
        {DAYS.map((d) => {
          const day = schedule[d];
          const isRest = !day.exerciseIds.length;
          return (
            <button
              key={d}
              onClick={() => {
                hapticSelection();
                setSelectedDay(d);
              }}
              aria-pressed={selectedDay === d}
              aria-label={`${d}, ${isRest ? "rest day" : `${day.exerciseIds.length} exercises`}`}
              className="relative min-w-0 rounded-lg border px-1 py-3 text-center press"
              style={{
                borderColor: selectedDay === d ? "#e63222" : "rgba(255,255,255,.1)",
                background: selectedDay === d ? "rgba(230,50,34,.12)" : "rgba(18,18,18,.9)",
              }}
            >
              <span
                className={`block text-[9px] font-black uppercase ${
                  selectedDay === d ? "text-accent-red" : "text-grit-dim"
                }`}
              >
                {d}
              </span>
              <span className="display mt-1 block text-sm font-black text-grit">
                {isRest ? "—" : day.exerciseIds.length}
              </span>
              {!isRest && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent-red" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#111214] shadow-[0_18px_46px_rgba(0,0,0,.34)]">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase text-accent-red">{selectedDay}</p>
              <input
                key={`onboarding-label-${selectedDay}`}
                defaultValue={selected.label}
                onBlur={(event) => {
                  const label = event.target.value.trim().toUpperCase() || "TRAINING";
                  event.target.value = label;
                  setSchedule((current) => ({
                    ...current,
                    [selectedDay]: { ...current[selectedDay], label },
                  }));
                }}
                aria-label={`${selectedDay} workout name`}
                className="display mt-1 w-full border-0 bg-transparent p-0 text-2xl font-black uppercase text-grit outline-none"
              />
            </div>
            <span className="shrink-0 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[9px] font-black uppercase text-grit-dim">
              {selected.exerciseIds.length
                ? `${selected.exerciseIds.reduce(
                    (total, id) =>
                      total +
                      (selected.exerciseConfig?.[id]?.sets ??
                        selected.sets ??
                        getExercise(id)?.sets ??
                        3),
                    0,
                  )} sets`
                : "Rest"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
              <p className="text-[9px] font-black uppercase text-grit-dim">Default sets</p>
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={() =>
                    updateDayTargets(selectedDay, {
                      sets: Math.max(1, daySets(selectedDay) - 1),
                    })
                  }
                  disabled={daySets(selectedDay) <= 1}
                  aria-label={`Use fewer sets on ${selectedDay}`}
                  className="grid h-11 w-11 place-items-center rounded-md border border-white/10 text-grit-dim disabled:opacity-30"
                >
                  <Minus size={14} />
                </button>
                <span className="display text-xl font-black text-grit">{daySets(selectedDay)}</span>
                <button
                  onClick={() =>
                    updateDayTargets(selectedDay, {
                      sets: Math.min(12, daySets(selectedDay) + 1),
                    })
                  }
                  disabled={daySets(selectedDay) >= 12}
                  aria-label={`Use more sets on ${selectedDay}`}
                  className="grid h-11 w-11 place-items-center rounded-md border border-white/10 text-grit-dim disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <label className="rounded-lg border border-white/10 bg-black/30 p-2.5">
              <span className="block text-[9px] font-black uppercase text-grit-dim">
                Default reps
              </span>
              <select
                value={dayReps(selectedDay)}
                onChange={(event) => updateDayTargets(selectedDay, { reps: event.target.value })}
                aria-label={`Default reps for ${selectedDay}`}
                className="mt-2 min-h-9 w-full bg-transparent text-sm font-black text-grit outline-none"
              >
                {REP_TARGETS.map((reps) => (
                  <option key={reps} value={reps}>
                    {reps}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-grit-dim">
            New exercises use these targets. Fine-tune any movement below.
          </p>
        </div>

        <div className="space-y-2 p-3">
          {selected.exerciseIds.length ? (
            selected.exerciseIds.map((id, index) => {
              const exercise = getExercise(id);
              if (!exercise) return null;
              const config = selected.exerciseConfig?.[id];
              const sets = config?.sets ?? selected.sets ?? exercise.sets;
              const reps = config?.reps ?? selected.reps ?? exercise.reps;
              return (
                <div key={id} className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent-red/10 text-[10px] font-black text-accent-red">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-grit">{exercise.name}</p>
                      <p className="text-[9px] font-bold uppercase text-grit-dim">
                        {exercise.muscleGroup}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        onClick={() => moveExercise(selectedDay, index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${exercise.name} up`}
                        className="grid h-11 w-11 place-items-center text-grit-dim disabled:opacity-20"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        onClick={() => moveExercise(selectedDay, index, 1)}
                        disabled={index === selected.exerciseIds.length - 1}
                        aria-label={`Move ${exercise.name} down`}
                        className="grid h-11 w-11 place-items-center text-grit-dim disabled:opacity-20"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        onClick={() => removeExercise(selectedDay, id)}
                        aria-label={`Remove ${exercise.name}`}
                        className="grid h-11 w-11 place-items-center text-grit-dim"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="flex min-h-11 items-center justify-between rounded-md border border-white/10 bg-[#111214] px-3">
                      <span className="text-[9px] font-black uppercase text-grit-dim">Sets</span>
                      <select
                        value={sets}
                        onChange={(event) =>
                          updateExercisePlan(selectedDay, id, {
                            sets: Number(event.target.value),
                          })
                        }
                        aria-label={`${exercise.name} sets`}
                        className="bg-transparent text-sm font-black text-grit outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center justify-between rounded-md border border-white/10 bg-[#111214] px-3">
                      <span className="text-[9px] font-black uppercase text-grit-dim">Reps</span>
                      <select
                        value={reps}
                        onChange={(event) =>
                          updateExercisePlan(selectedDay, id, { reps: event.target.value })
                        }
                        aria-label={`${exercise.name} reps`}
                        className="max-w-[5.5rem] bg-transparent text-sm font-black text-grit outline-none"
                      >
                        {REP_TARGETS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-7 text-center">
              <Dumbbell size={22} className="mx-auto text-grit-dim" />
              <p className="display mt-3 text-lg font-black uppercase text-grit">Recovery day</p>
              <p className="mt-1 text-xs text-grit-dim">Add a movement to turn it into training.</p>
            </div>
          )}

          <label className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-3">
            <Plus size={14} className="shrink-0 text-accent-red" />
            <select
              value=""
              onChange={(event) => addExercise(event.target.value)}
              aria-label={`Add exercise to ${selectedDay}`}
              className="min-h-12 min-w-0 flex-1 bg-transparent text-xs font-bold text-grit outline-none"
            >
              <option value="">Add an exercise...</option>
              {available
                .filter((exercise) => !selected.exerciseIds.includes(exercise.id))
                .map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name} · {exercise.muscleGroup}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center gap-2">
          <Check size={14} className="shrink-0 text-emerald-400" />
          <p className="text-xs font-bold text-grit">{configuredDays} training days configured</p>
        </div>
        <p className="mt-1 pl-6 text-[10px] leading-relaxed text-grit-dim">
          Each workout will open with these exact movements and targets.
        </p>
      </div>
      <button
        onClick={() => onContinue(schedule)}
        disabled={configuredDays === 0}
        className="btn-grit mt-auto disabled:cursor-not-allowed disabled:opacity-40"
      >
        Lock in my week
      </button>
    </>
  );
}

function ModeStep({ name, onPick }: { name: string; onPick: (m: Mode) => void }) {
  const [chosen, setChosen] = useState<Mode | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function pick(mode: Mode) {
    if (chosen) return;
    setChosen(mode);
    hapticSelection();
    timer.current = setTimeout(() => onPick(mode), 250);
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">
        {name ? `THAT'S EVERYTHING, ${name.toUpperCase()}` : "THAT'S EVERYTHING"}
      </p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        How should we build your week?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-grit-dim">
        Either way you review the week before anything is saved, and you can change every session
        later.
      </p>
      <div className="mt-7 flex flex-col gap-2.5">
        <button
          onClick={() => pick("GENERATE")}
          aria-pressed={chosen === "GENERATE"}
          style={{ animationDelay: "60ms" }}
          className={`deadset-option rounded-3xl border-2 border-accent-red bg-grit-card p-6 text-left press ${
            chosen === "GENERATE" ? "deadset-option-chosen" : chosen ? "deadset-option-dimmed" : ""
          }`}
        >
          <div className="mb-1 flex items-center gap-2">
            <Zap size={14} className="text-accent-red" />
            <span className="label-cap text-accent-red">RECOMMENDED</span>
          </div>
          <span className="display block text-2xl font-extrabold uppercase tracking-wide text-grit">
            Generate it for me
          </span>
          <p className="mt-1 text-xs text-grit-dim">
            We build your first week from everything you just told us.
          </p>
        </button>
        <button
          onClick={() => pick("BUILD")}
          aria-pressed={chosen === "BUILD"}
          style={{ animationDelay: "115ms" }}
          className={`deadset-option rounded-3xl border border-grit bg-grit-card p-6 text-left hover:border-accent-red press ${
            chosen === "BUILD" ? "deadset-option-chosen" : chosen ? "deadset-option-dimmed" : ""
          }`}
        >
          <span className="display block text-2xl font-extrabold uppercase tracking-wide text-grit">
            Build it myself
          </span>
          <p className="mt-1 text-xs text-grit-dim">
            Start from a safe week, then replace anything — exercises, sets and reps.
          </p>
        </button>
      </div>
    </div>
  );
}

function TrainingDaysStep({
  name,
  initial,
  onPreview,
  onSubmit,
}: {
  name: string;
  initial?: DayKey[];
  onPreview: (days: DayKey[]) => void;
  onSubmit: (days: DayKey[]) => void;
}) {
  const [days, setDays] = useState<DayKey[]>(initial ?? ["MON", "WED", "FRI"]);
  const enough = days.length >= MIN_TRAINING_DAYS;
  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">YOUR WEEK</p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        {name ? `When do you train, ${name}?` : "Which days do you train?"}
      </h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-grit-dim">
        Tap the days that suit your week. Workouts land on exactly those days and you rest on the
        others.
      </p>

      <WeekdayPicker
        value={days}
        onChange={(next) => {
          setDays(next);
          onPreview(next);
        }}
      />

      <p className="text-sm mt-4" style={{ color: enough ? "#f5f5f0" : "#8a8a8a" }}>
        {enough ? (
          <>
            <span className="font-bold">{days.length} days a week</span> — {describeDays(days)}.
          </>
        ) : (
          `Pick at least ${MIN_TRAINING_DAYS} days.`
        )}
      </p>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <button
          onClick={() => onSubmit(days)}
          disabled={!enough}
          className="btn-grit min-h-14 disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function FocusStep({
  initial,
  onPreview,
  onSubmit,
  onSkip,
}: {
  initial?: FocusMuscle[];
  onPreview: (muscles: FocusMuscle[]) => void;
  onSubmit: (muscles: FocusMuscle[]) => void;
  onSkip: () => void;
}) {
  const [picked, setPicked] = useState<FocusMuscle[]>(initial ?? []);
  const OPTIONS: { v: FocusMuscle; l: string }[] = [
    { v: "CHEST", l: "Chest" },
    { v: "BACK", l: "Back" },
    { v: "SHOULDERS", l: "Shoulders" },
    { v: "ARMS", l: "Arms" },
    { v: "LEGS", l: "Legs" },
    { v: "CORE", l: "Core" },
  ];
  function toggle(m: FocusMuscle) {
    hapticSelection();
    // Two priorities at most. A third pushes the oldest out rather than being
    // ignored, so a tap always does something visible.
    const next = picked.includes(m)
      ? picked.filter((x) => x !== m)
      : picked.length < 2
        ? [...picked, m]
        : [picked[1], m];
    setPicked(next);
    // The muscle map above this screen lights up as they choose.
    onPreview(next);
  }
  return (
    <div className="flex flex-1 flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">PICK UP TO TWO</p>
      <h1 className="display text-[1.9rem] font-black uppercase leading-[1.02] text-grit">
        What do you want to grow?
      </h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-grit-dim">
        Your split gets extra volume where you want it. Watch the map above change as you pick.
      </p>
      <div className="deadset-step-stagger mb-6 grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const active = picked.includes(o.v);
          return (
            <button
              key={o.v}
              onClick={() => toggle(o.v)}
              aria-pressed={active}
              className="deadset-option rounded-2xl border p-4 text-left press"
              style={{
                borderColor: active ? "#e63222" : "#262626",
                background: active ? "rgba(230,50,34,0.1)" : "#141414",
              }}
            >
              <p className="display text-lg font-extrabold uppercase text-grit">{o.l}</p>
              <p
                className="label-cap mt-0.5 text-[9px]"
                style={{ color: active ? "#e63222" : "#8a8a8a" }}
              >
                {active ? "PRIORITY" : "TAP TO PICK"}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={() => onSubmit(picked)}
          disabled={picked.length === 0}
          className="btn-grit min-h-14 disabled:opacity-40"
        >
          Continue
        </button>
        <button onClick={onSkip} className="btn-ghost">
          No preference
        </button>
      </div>
    </div>
  );
}

function BlueprintStep({
  draft,
  mode,
  schedule,
  onEnter,
}: {
  draft: Partial<Profile>;
  mode: Mode;
  schedule: Schedule;
  onEnter: () => void;
}) {
  const blueprint = deriveLiveSetupBlueprint(draft, { mode, schedule });
  const covered = blueprint.coveredMuscles.map(
    (muscle) => muscle.charAt(0) + muscle.slice(1).toLowerCase(),
  );
  const missing = blueprint.missingMuscles.map(
    (muscle) => muscle.charAt(0) + muscle.slice(1).toLowerCase(),
  );

  return (
    <div className="flex-1 flex flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">BUILT FROM YOUR REAL ANSWERS</p>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">
        Your system is ready
      </h1>
      <p className="mb-5 text-xs leading-relaxed text-grit-dim">
        This is planned training, not invented progress. Your Strength Map only earns colour when
        you log the work.
      </p>

      <SetupLivePreview draft={draft} mode={mode} schedule={schedule} />

      <StrengthEngineTutorial focus={draft.focusMuscles?.[0]} />

      <div className="mt-4 grid gap-2">
        <div className="deadset-plan-reveal rounded-2xl border border-white/10 bg-[#111214] p-3">
          <p className="label-cap text-[8px] text-accent-red">MUSCLE COVERAGE</p>
          <p className="mt-1 text-xs font-bold text-grit">
            {covered.length ? covered.join(" · ") : "No exercises set yet"}
          </p>
          {missing.length > 0 && (
            <p className="mt-1 text-[9px] leading-relaxed text-grit-dim">
              Grey: {missing.join(", ")} — no exercise set for that area.
            </p>
          )}
        </div>
        <div
          className="deadset-plan-reveal rounded-2xl border border-white/10 bg-[#111214] p-3"
          style={{ animationDelay: "80ms" }}
        >
          <p className="label-cap text-[8px] text-accent-red">RECOVERY SPACING</p>
          <p className="mt-1 text-xs font-bold text-grit">{blueprint.recovery.headline}</p>
          <p className="mt-1 text-[9px] leading-relaxed text-grit-dim">
            {blueprint.recovery.detail}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <button onClick={onEnter} className="btn-grit w-full min-h-14 animate-subtle-pulse">
          <Zap size={16} className="mr-2" />
          Continue to 7-day free trial
        </button>
        <p className="mt-2 text-center text-[9px] leading-relaxed text-grit-dim">
          Your setup is saved before Apple opens. Eligible new subscribers get seven days free, then
          the monthly subscription begins.
        </p>
      </div>
    </div>
  );
}

function NotificationStep({ onContinue }: { onContinue: () => void }) {
  const [busy, setBusy] = useState(false);

  async function choose(enabled: boolean) {
    setBusy(true);
    try {
      const granted =
        enabled && isNativeIos() ? await requestWorkoutNotificationPermission() : false;
      setState((current) => ({
        ...current,
        deviceRemindersEnabled: granted,
        streakAlertsEnabled: granted,
        rivalAlertsEnabled: granted,
        notificationPreferenceConfigured: true,
      }));
      if (enabled && !granted && isNativeIos()) {
        hapticFailure();
        toast.error("Notifications weren't allowed. You can enable them later in Settings.");
      } else if (granted) {
        hapticSaved();
      } else {
        hapticSelection();
      }
      onContinue();
    } catch {
      hapticFailure();
      toast.error("Notifications couldn't be configured. You can retry in Settings.");
      setState((current) => ({
        ...current,
        deviceRemindersEnabled: false,
        streakAlertsEnabled: false,
        rivalAlertsEnabled: false,
        notificationPreferenceConfigured: true,
      }));
      onContinue();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-accent-red/50 bg-[#111214] p-6 text-center shadow-[0_24px_70px_rgba(230,50,34,0.14)]">
        <div className="absolute inset-x-10 top-0 h-24 rounded-full bg-accent-red/20 blur-3xl" />
        <span className="relative mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-accent-red/50 bg-accent-red/15 text-accent-red">
          <BellRing size={36} />
        </span>
        <p className="label-cap relative mt-5 text-[9px] text-accent-red">YOUR PLAN, ON TIME</p>
        <h1 className="display relative mt-2 text-3xl font-black uppercase leading-[0.95] text-grit">
          Put DEADSET on your Lock Screen
        </h1>
        <p className="relative mx-auto mt-4 max-w-sm text-xs leading-relaxed text-grit-dim">
          Get one alert on scheduled training days, a warning before a real streak ends, and
          pressure when a rival duel needs you. No spam and no exact location tracking.
        </p>
      </div>

      <div className="grid gap-2">
        {["Scheduled workout reminders", "Streak-at-risk warnings", "Rival duel pressure"].map(
          (label) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-grit-card px-4 py-3"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-red text-white">
                <Check size={13} />
              </span>
              <span className="text-xs font-bold text-grit">{label}</span>
            </div>
          ),
        )}
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => void choose(true)}
          className="btn-grit min-h-14 w-full text-[11px]"
        >
          <BellRing size={15} className="mr-2" /> Enable notifications
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void choose(false)}
          className="mt-2 min-h-11 w-full text-[10px] font-black uppercase tracking-wider text-grit-dim"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// Cinematic build-up before the blueprint: sequential, personalized "analysis"
// lines tick over with a filling progress bar, then auto-advances.
function AnalyzingStep({ draft, onDone }: { draft: Partial<Profile>; onDone: () => void }) {
  const p = draft as Profile;
  const name = firstNameOf(draft);
  const focus = (p.focusMuscles ?? []).join(" + ").toLowerCase();
  const lines = useMemo(
    () => [
      "Reading your goal and your why",
      `Calibrating a ${p.daysPerWeek ?? 4}-day split${focus ? ` with extra ${focus}` : ""}`,
      `Spacing recovery around ${p.sessionMinutes ?? 45}-minute sessions`,
      "Setting your calorie and protein targets",
      "Benchmarking your lifts against the standards",
      "Locking in your ranked starting point",
    ],
    [p.daysPerWeek, p.sessionMinutes, focus],
  );
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= lines.length) {
      const t = setTimeout(onDone, 750);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((d) => d + 1), 720);
    return () => clearTimeout(t);
  }, [done, lines.length, onDone]);
  const pct = Math.round((done / lines.length) * 100);
  return (
    <div className="flex-1 flex flex-col justify-center">
      <p className="label-cap text-accent-red text-[10px] mb-1">
        {name ? `BUILDING ${name.toUpperCase()}'S WEEK` : "BUILDING YOUR WEEK"}
      </p>
      <h1 className="display mb-8 text-[2.1rem] font-black uppercase leading-[1.02] text-grit">
        Locking you in…
      </h1>
      <div className="flex flex-col gap-3 mb-8">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 transition-opacity duration-300 ${i < done ? "opacity-100" : "opacity-30"}`}
          >
            <span
              className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center border ${i < done ? "bg-accent-red border-accent-red" : "border-grit"}`}
            >
              {i < done ? (
                <Check size={14} className="text-white" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-grit-dim" />
              )}
            </span>
            <span className="text-sm text-grit font-medium">{line}</span>
          </div>
        ))}
      </div>
      <div className="h-1.5 bg-grit-card rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-red rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-center label-cap text-grit-dim text-[10px] mt-3">{pct}%</p>
    </div>
  );
}
