import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  Dumbbell,
  Minus,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { GritLogo } from "@/components/GritLogo";
import { SetupLivePreview } from "@/components/SetupLivePreview";
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
import {
  onboardingOrder,
  onboardingStageLabel,
  type OnboardingActiveStep,
  type OnboardingMode,
} from "@/lib/onboarding-flow";
import { hapticFailure, hapticSaved, hapticSelection } from "@/lib/haptics";
import { deriveLiveSetupBlueprint } from "@/lib/setup-blueprint";
import { normaliseDecimalInput } from "@/lib/programme-weight-setup";
import { finishAppBoot } from "@/lib/app-boot";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "DEADSET — Onboarding" }] }),
  component: Onboarding,
});

type Step =
  | "mode"
  | "goal"
  | "why"
  | "days"
  | "equipment"
  | "focus"
  | "session"
  | "preferences"
  | "schedule"
  | "experience"
  | "about"
  | "sleep"
  | "target"
  | "dream"
  | "injuries"
  | "weakness"
  | "prs"
  | "name"
  | "username"
  | "photo"
  | "analyzing"
  | "blueprint"
  | "commit";

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
    if (upcoming === "preferences") {
      merged.experience ??= "BEGINNER";
      merged.exercisesPerSession ??= 4;
      merged.sessionMinutes ??= 45;
      merged.focusMuscles ??= [];
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
      const sched =
        mode === "BUILD" ? emptySchedule(p.trainingDays) : (draftSchedule ?? defaultSchedule(p));
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
          const nextState = { ...getState(), profile: p, schedule: sched };
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

  return (
    <div
      className="deadset-onboarding min-h-[100dvh] bg-grit flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-6 pt-10 pb-6 flex items-center justify-between">
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
          <GritLogo className="text-3xl" />
        </div>
        <span className="label-cap">
          {idx === 0
            ? "LIVE SETUP"
            : `${onboardingStageLabel(step as OnboardingActiveStep)} · ${idx} / ${ORDER.length - 1}`}
        </span>
      </div>
      <div className="px-6">
        <div
          className="h-1.5 bg-grit-card rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, ORDER.length - 1)}
          aria-valuenow={idx}
        >
          <div
            className="h-full bg-accent-red rounded-full transition-all"
            style={{
              width:
                idx === 0 ? "0%" : `${Math.round((idx / Math.max(1, ORDER.length - 1)) * 100)}%`,
            }}
          />
        </div>
      </div>
      {mode && !["mode", "schedule", "blueprint", "analyzing"].includes(step) && (
        <div className="px-6 pt-4">
          <SetupLivePreview draft={draft} mode={mode} schedule={draftSchedule} compact />
        </div>
      )}
      <div
        key={step}
        className={`flex-1 px-6 pt-8 pb-10 flex flex-col ${
          direction === "back" ? "animate-slide-down" : "animate-slide-up"
        }`}
      >
        {step === "mode" && (
          <ModeStep
            onPick={(m: Mode) => {
              hapticSelection();
              setDirection("forward");
              if (m !== mode) setDraftSchedule(null);
              setMode(m);
              setIdx(1);
            }}
          />
        )}
        {step === "goal" && (
          <Choice
            title="What's your goal?"
            options={[
              { v: "BULK", l: "Bulk" },
              { v: "CUT", l: "Cut" },
              { v: "MAINTAIN", l: "Maintain" },
              { v: "ATHLETIC", l: "Athletic Performance" },
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
        {step === "experience" && (
          <Choice
            title="Experience level"
            options={[
              { v: "BEGINNER", l: "Beginner" },
              { v: "INTERMEDIATE", l: "Intermediate" },
              { v: "ADVANCED", l: "Advanced" },
            ]}
            onPick={(v) => next({ experience: v as Experience })}
          />
        )}
        {step === "about" && <AboutYouStep initial={draft} onSubmit={(patch) => next(patch)} />}
        {step === "sleep" && (
          <Choice
            eyebrow="Recovery is where you actually grow"
            title="How's your sleep?"
            options={[
              { v: "LOW", l: "Under 6 hours", sub: "We'll build in extra recovery." },
              { v: "OK", l: "6–7 hours", sub: "Workable — we'll help you protect it." },
              { v: "GOOD", l: "7–8 hours", sub: "Solid foundation to build on." },
              { v: "GREAT", l: "8+ hours", sub: "Elite recovery. Let's use it." },
            ]}
            onPick={(v) => next({ sleepQuality: v as Profile["sleepQuality"] })}
          />
        )}
        {step === "days" && (
          <TrainingDaysStep
            initial={draft.trainingDays}
            onPreview={(days) =>
              previewDraft({ trainingDays: days, daysPerWeek: daysPerWeekFor(days) })
            }
            onSubmit={(days) => next({ trainingDays: days, daysPerWeek: daysPerWeekFor(days) })}
          />
        )}
        {step === "equipment" && (
          <Choice
            title="Equipment access"
            options={[
              { v: "FULL_GYM", l: "Full Gym" },
              { v: "HOME_GYM", l: "Home Gym" },
              { v: "BODYWEIGHT", l: "Bodyweight Only" },
            ]}
            onPick={(v) => next({ equipment: v as Equipment })}
          />
        )}
        {step === "preferences" && (
          <TrainingPreferencesStep
            initial={draft}
            onPreview={previewDraft}
            onSubmit={(patch) => next(patch)}
          />
        )}
        {step === "schedule" && (
          <SchedulePreview
            draft={draft}
            initial={draftSchedule}
            onContinue={(schedule) => {
              setDraftSchedule(schedule);
              next({});
            }}
          />
        )}
        {step === "injuries" && (
          <Injuries
            initial={draft.injuries}
            onSubmit={(t) => next({ injuries: t })}
            onSkip={() => next({ injuries: "" })}
          />
        )}
        {step === "focus" && (
          <FocusStep
            initial={draft.focusMuscles}
            onSubmit={(muscles) => next({ focusMuscles: muscles })}
            onSkip={() => next({ focusMuscles: [] })}
          />
        )}
        {step === "session" && (
          <Choice
            eyebrow="You can change every day later"
            title="Exercises per workout"
            options={[
              { v: "3", l: "3 exercises", sub: "Short and focused." },
              { v: "4", l: "4 exercises", sub: "Main lifts plus accessories." },
              { v: "5", l: "5 exercises", sub: "Balanced — recommended." },
              { v: "6", l: "6 exercises", sub: "More volume and variety." },
              { v: "7", l: "7 exercises", sub: "High-volume sessions." },
            ]}
            onPick={(v) => next({ exercisesPerSession: Number(v) as 3 | 4 | 5 | 6 | 7 })}
          />
        )}
        {step === "target" && (
          <TargetStep
            currentKg={draft.weightKg}
            goal={draft.goal}
            initial={draft.targetWeightKg}
            onSubmit={(n) => next({ targetWeightKg: n })}
            onSkip={() => next({ targetWeightKg: undefined })}
          />
        )}
        {step === "dream" && (
          <Choice
            eyebrow="Picture 12 weeks from now"
            title="What does winning look like?"
            options={[
              {
                v: "PLATES",
                l: "Plates I couldn't touch",
                sub: "Bench, squat and deadlift up across the board.",
              },
              {
                v: "MIRROR",
                l: "The mirror hits different",
                sub: "Visibly leaner, fuller, more defined.",
              },
              { v: "STREAK", l: "A streak I never break", sub: "Training is just who I am now." },
              {
                v: "RANK",
                l: "Top of the rankings",
                sub: "Elite rank, rivals beaten, respect earned.",
              },
            ]}
            onPick={(v) => next({ dreamOutcome: v })}
          />
        )}
        {step === "weakness" && (
          <Choice
            title="Your biggest weakness?"
            options={[
              { v: "STRENGTH", l: "Strength" },
              { v: "CONSISTENCY", l: "Consistency" },
              { v: "DIET", l: "Diet" },
              { v: "RECOVERY", l: "Recovery" },
            ]}
            onPick={(v) => next({ weakness: v as Weakness })}
          />
        )}
        {step === "prs" && <PRStep onContinue={() => next({})} />}
        {step === "name" && (
          <NameStep initial={draft.displayName} onSubmit={(n) => next({ displayName: n })} />
        )}
        {step === "username" && (
          <UsernameStep initial={draft.username} onSubmit={(u) => next({ username: u })} />
        )}
        {step === "photo" && (
          <PhotoStep onSubmit={(url) => next({ avatarDataUrl: url })} onSkip={() => next({})} />
        )}
        {step === "analyzing" && <AnalyzingStep draft={draft} onDone={() => next({})} />}
        {step === "blueprint" && (
          <BlueprintStep
            draft={draft}
            mode={mode ?? "GENERATE"}
            schedule={
              mode === "BUILD"
                ? emptySchedule(draft.trainingDays)
                : (draftSchedule ?? defaultSchedule(draft as Profile))
            }
            onEnter={() => next({})}
          />
        )}
        {step === "commit" && (
          <CommitStep
            draft={draft}
            onCommit={(commitmentDate) => next({ committed: true, commitmentDate })}
          />
        )}
      </div>
    </div>
  );
}

function Choice({
  title,
  eyebrow,
  options,
  onPick,
}: {
  title: string;
  eyebrow?: string;
  options: { v: string; l: string; sub?: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <>
      {eyebrow && <p className="label-cap text-accent-red text-[10px] mb-1">{eyebrow}</p>}
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-8">{title}</h1>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onPick(o.v)}
            className="bg-grit-card border border-grit p-5 text-left hover:border-accent-red transition-colors press"
          >
            <span className="display text-lg uppercase tracking-wide font-bold text-grit block">
              {o.l}
            </span>
            {o.sub && (
              <span className="text-[12px] text-grit-dim mt-1 block normal-case">{o.sub}</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

function TrainingPreferencesStep({
  initial,
  onPreview,
  onSubmit,
}: {
  initial?: Partial<Profile>;
  onPreview: (patch: Partial<Profile>) => void;
  onSubmit: (patch: Partial<Profile>) => void;
}) {
  const [experience, setExperience] = useState<Experience>(initial?.experience ?? "BEGINNER");
  const initialExerciseCount = initial?.exercisesPerSession;
  const [exerciseCount, setExerciseCount] = useState<3 | 4 | 5 | 6 | 7>(
    initialExerciseCount === 3 ||
      initialExerciseCount === 4 ||
      initialExerciseCount === 5 ||
      initialExerciseCount === 6 ||
      initialExerciseCount === 7
      ? initialExerciseCount
      : 4,
  );
  const [focus, setFocus] = useState<FocusMuscle[]>(initial?.focusMuscles ?? []);
  const focusOptions: { value: FocusMuscle; label: string }[] = [
    { value: "CHEST", label: "Chest" },
    { value: "BACK", label: "Back" },
    { value: "SHOULDERS", label: "Shoulders" },
    { value: "ARMS", label: "Arms" },
    { value: "LEGS", label: "Legs" },
    { value: "CORE", label: "Core" },
  ];

  function toggleFocus(muscle: FocusMuscle) {
    hapticSelection();
    const next = focus.includes(muscle)
      ? focus.filter((item) => item !== muscle)
      : focus.length < 2
        ? [...focus, muscle]
        : [focus[1], muscle];
    setFocus(next);
    onPreview({ focusMuscles: next });
  }

  const sessionMinutes =
    exerciseCount <= 3 ? 30 : exerciseCount <= 4 ? 45 : exerciseCount <= 5 ? 60 : 90;

  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">Plan preferences</h1>
      <p className="text-sm text-[#8a8a8a] mb-7">Set the training style for your first week.</p>

      <section className="mb-6" aria-labelledby="experience-label">
        <p id="experience-label" className="label-cap text-[10px] text-grit-dim mb-2">
          Experience
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as Experience[]).map((level) => {
            const active = experience === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  hapticSelection();
                  setExperience(level);
                  onPreview({ experience: level });
                }}
                className="border rounded-2xl p-3 press"
                style={{
                  borderColor: active ? "#e63222" : "#262626",
                  background: active ? "rgba(230,50,34,0.1)" : "#141414",
                }}
              >
                <span className="display block text-sm uppercase font-extrabold text-grit">
                  {level === "BEGINNER" ? "New" : level === "INTERMEDIATE" ? "Regular" : "Advanced"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-6" aria-labelledby="exercise-count-label">
        <div className="flex items-baseline justify-between mb-2">
          <p id="exercise-count-label" className="label-cap text-[10px] text-grit-dim">
            Exercises per workout
          </p>
          <span className="label-cap text-[9px] text-accent-red">{sessionMinutes} min target</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {([3, 4, 5, 6, 7] as const).map((count) => {
            const active = exerciseCount === count;
            return (
              <button
                key={count}
                type="button"
                aria-label={`${count} exercises per workout`}
                aria-pressed={active}
                onClick={() => {
                  hapticSelection();
                  setExerciseCount(count);
                  onPreview({
                    exercisesPerSession: count,
                    sessionMinutes: count <= 3 ? 30 : count <= 4 ? 45 : count <= 5 ? 60 : 90,
                  });
                }}
                className="border rounded-2xl min-h-12 press"
                style={{
                  borderColor: active ? "#e63222" : "#262626",
                  background: active ? "rgba(230,50,34,0.1)" : "#141414",
                }}
              >
                <span className="display text-lg font-extrabold text-grit">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="focus-label">
        <div className="flex items-baseline justify-between mb-2">
          <p id="focus-label" className="label-cap text-[10px] text-grit-dim">
            Focus muscles
          </p>
          <span className="label-cap text-[9px] text-grit-dim">Optional, up to 2</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {focusOptions.map((option) => {
            const active = focus.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleFocus(option.value)}
                className="border rounded-2xl px-4 py-3 text-left press"
                style={{
                  borderColor: active ? "#e63222" : "#262626",
                  background: active ? "rgba(230,50,34,0.1)" : "#141414",
                }}
              >
                <span className="display text-base uppercase font-extrabold text-grit">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
        {focus.length > 0 && (
          <div className="mt-3 rounded-2xl border border-accent-red/30 bg-accent-red/[0.07] p-3">
            <p className="label-cap text-[8px] text-accent-red">PINNED INTO YOUR WEEK</p>
            <div className="mt-2 grid gap-1.5">
              {focus.map((muscle) => {
                const recommendation = focusExerciseRecommendation(
                  muscle,
                  initial?.equipment ?? "FULL_GYM",
                );
                return (
                  <p key={muscle} className="text-[11px] font-semibold text-grit">
                    <Check size={12} className="mr-1.5 inline text-accent-red" />
                    {muscle.charAt(0) + muscle.slice(1).toLowerCase()}:{" "}
                    {recommendation?.name ?? "targeted movement"}
                  </p>
                );
              })}
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-grit-dim">
              DEADSET keeps these movements when it trims the workout to your chosen length.
            </p>
          </div>
        )}
      </section>

      <button
        onClick={() =>
          onSubmit({
            experience,
            exercisesPerSession: exerciseCount,
            sessionMinutes,
            focusMuscles: focus,
          })
        }
        className="btn-grit mt-auto"
      >
        Preview my week
      </button>
    </>
  );
}

function AboutYouStep({
  initial,
  onSubmit,
}: {
  initial?: Partial<Profile>;
  onSubmit: (patch: Partial<Profile>) => void;
}) {
  const [age, setAge] = useState(initial?.age != null ? String(initial.age) : "");
  const [weight, setWeight] = useState(initial?.weightKg != null ? String(initial.weightKg) : "");
  const [height, setHeight] = useState(initial?.heightCm != null ? String(initial.heightCm) : "");
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const a = Number(age);
  const w = Number(weight);
  const h = Number(height);
  const ageOk = age !== "" && a >= 13 && a <= 90;
  const weightOk = weight !== "" && w >= 30 && w <= 250;
  const heightOk = height !== "" && h >= 120 && h <= 230;
  const valid = ageOk && weightOk && heightOk && gender !== null;

  const fields = [
    {
      label: "AGE",
      suffix: "yrs",
      value: age,
      set: setAge,
      ok: ageOk,
      placeholder: "24",
      digitsOnly: true,
    },
    {
      label: "WEIGHT",
      suffix: "kg",
      value: weight,
      set: setWeight,
      ok: weightOk,
      placeholder: "80",
      digitsOnly: false,
    },
    {
      label: "HEIGHT",
      suffix: "cm",
      value: height,
      set: setHeight,
      ok: heightOk,
      placeholder: "180",
      digitsOnly: false,
    },
  ];

  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">
        Strength calibration
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-8">
        Your bodyweight and reference table keep the Strength Map honest. Age and height tune fuel
        targets. Never shown publicly.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {fields.map((f, i) => (
          <div key={f.label} className="bg-grit-card border border-grit rounded-2xl p-3">
            <p className="label-cap text-[9px] text-grit-dim mb-1">{f.label}</p>
            <div className="flex items-baseline gap-1">
              <input
                autoFocus={i === 0}
                defaultValue={f.value}
                onChange={(e) => {
                  const cleaned = f.digitsOnly
                    ? e.target.value.replace(/[^0-9]/g, "")
                    : normaliseDecimalInput(e.target.value);
                  e.target.value = cleaned;
                  f.set(cleaned);
                }}
                inputMode="decimal"
                placeholder={f.placeholder}
                aria-label={`${f.label.toLowerCase()} in ${f.suffix}`}
                className="bg-transparent outline-none w-full min-w-0 text-2xl font-display font-extrabold text-grit"
                style={{ color: f.value && !f.ok ? "#e63222" : undefined }}
              />
              <span className="label-cap text-[9px] text-grit-dim">{f.suffix}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="label-cap text-[10px] text-grit-dim mb-2">STRENGTH REFERENCE</p>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {(["MALE", "FEMALE", "OTHER"] as Gender[]).map((g) => {
          const active = gender === g;
          return (
            <button
              key={g}
              aria-pressed={active}
              onClick={() => {
                hapticSelection();
                setGender(g);
              }}
              className="border rounded-2xl p-3 press"
              style={{
                borderColor: active ? "#e63222" : "#262626",
                background: active ? "rgba(230,50,34,0.1)" : "#141414",
              }}
            >
              <span
                className="display text-sm uppercase font-extrabold"
                style={{ color: active ? "#f5f5f0" : "#8a8a8a" }}
              >
                {g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Skip"}
              </span>
            </button>
          );
        })}
      </div>
      {gender === "OTHER" && (
        <p className="mb-4 text-[10px] leading-relaxed text-grit-dim">
          Skip keeps strength grades grey until you choose a reference in Profile. DEADSET will not
          silently use the wrong standard.
        </p>
      )}
      <button
        disabled={!valid}
        onClick={() => gender && onSubmit({ age: a, weightKg: w, heightCm: h, gender })}
        className="btn-grit mt-auto disabled:opacity-40"
      >
        Continue
      </button>
    </>
  );
}

function Injuries({
  initial,
  onSubmit,
  onSkip,
}: {
  initial?: string;
  onSubmit: (s: string) => void;
  onSkip: () => void;
}) {
  const [v, setV] = useState(initial ?? "");
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">
        Injuries or limits?
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-8">Optional. Skip if none.</p>
      <textarea
        defaultValue={v}
        onChange={(e) => setV(e.target.value)}
        rows={5}
        className="input-grit mb-4"
        placeholder="e.g. lower back tweak, bad knee..."
      />
      <div className="mt-auto flex flex-col gap-3">
        <button onClick={() => onSubmit(v)} className="btn-grit">
          Continue
        </button>
        <button onClick={onSkip} className="btn-ghost">
          Skip — no injuries
        </button>
      </div>
    </>
  );
}

function NameStep({ initial, onSubmit }: { initial?: string; onSubmit: (name: string) => void }) {
  // DOM-owned input (defaultValue + shadow state) — controlled value= freezes
  // typing in the iOS WKWebView.
  const [shadow, setShadow] = useState(initial ?? "");
  const valid = shadow.trim().length >= 1;
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">
        What&apos;s your name?
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-8">
        Shown on your athlete card. Your public @username comes next.
      </p>
      <input
        autoFocus
        defaultValue={initial ?? ""}
        onChange={(e) => setShadow(e.target.value)}
        maxLength={40}
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        className="bg-transparent border-b-2 border-grit focus:border-accent-red outline-none text-3xl font-display font-extrabold text-grit w-full pb-2 mb-8"
        placeholder="Your name"
      />
      <button
        disabled={!valid}
        onClick={() => onSubmit(shadow.trim())}
        className="btn-grit mt-auto disabled:opacity-40"
      >
        Continue
      </button>
    </>
  );
}

function UsernameStep({ initial, onSubmit }: { initial?: string; onSubmit: (u: string) => void }) {
  const [v, setV] = useState(initial ?? "");
  const clean = v
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  const valid = clean.length >= 3;
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">Pick a username</h1>
      <p className="text-sm text-[#8a8a8a] mb-8">
        Your public @handle for leaderboards and the feed. Your name stays on your card.
      </p>
      <div className="flex items-center gap-2 mb-8 border-b-2 border-grit focus-within:border-accent-red">
        <span className="text-3xl font-display font-extrabold text-grit-dim pb-2">@</span>
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
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="bg-transparent outline-none text-4xl font-display font-extrabold text-grit flex-1 pb-2"
          placeholder="ironwolf"
        />
      </div>
      <button
        disabled={!valid}
        onClick={() => onSubmit(clean)}
        className="btn-grit mt-auto disabled:opacity-40"
      >
        Continue
      </button>
    </>
  );
}

function PhotoStep({ onSubmit, onSkip }: { onSubmit: (url: string) => void; onSkip: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  function pick(file: File) {
    // Downscale to a bounded JPEG — raw camera photos overflow the server's
    // 2MB payload cap and would block finishing onboarding.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 512;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPreview(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">Profile photo</h1>
      <p className="text-sm text-[#8a8a8a] mb-8">One face. One brand. Optional.</p>
      <div className="flex justify-center mb-8">
        <button
          onClick={() => ref.current?.click()}
          className="w-40 h-40 rounded-full border-4 border-accent-red overflow-hidden bg-grit-card flex items-center justify-center"
        >
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="label-cap">Tap to upload</span>
          )}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <button onClick={() => (preview ? onSubmit(preview) : onSkip())} className="btn-grit">
          Continue
        </button>
        {preview && (
          <button onClick={onSkip} className="btn-ghost">
            Skip photo
          </button>
        )}
      </div>
    </>
  );
}

function SchedulePreview({
  draft,
  initial,
  onContinue,
}: {
  draft: Partial<Profile>;
  initial: Schedule | null;
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
  const [editing, setEditing] = useState(false);

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

function emptySchedule(trainingDays: DayKey[] = []): import("@/lib/types").Schedule {
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
  const out = {} as Record<string, { label: string; exerciseIds: string[] }>;
  days.forEach((d) => {
    out[d] = { label: trainingDays.includes(d) ? "ADD WORKOUT" : "REST", exerciseIds: [] };
  });
  return out as import("@/lib/types").Schedule;
}

function ModeStep({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">
        How do you want to start?
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-8">Pick one. You can change everything later.</p>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => onPick("GENERATE")}
          className="bg-grit-card border-2 border-accent-red rounded-3xl p-6 text-left hover:bg-[#1a0a08] transition-colors press"
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-accent-red" />
            <span className="label-cap text-accent-red">RECOMMENDED</span>
          </div>
          <span className="display text-2xl uppercase tracking-wide font-extrabold text-grit block">
            Generate Schedule
          </span>
          <p className="text-xs text-[#8a8a8a] mt-1">
            A short guided setup. We build your first week.
          </p>
        </button>
        <button
          onClick={() => onPick("BUILD")}
          className="bg-grit-card border border-grit rounded-3xl p-6 text-left hover:border-accent-red transition-colors press"
        >
          <span className="display text-2xl uppercase tracking-wide font-extrabold text-grit block">
            Build Your Own
          </span>
          <p className="text-xs text-[#8a8a8a] mt-1">
            Start blank. Map every day yourself — exercises, sets, reps and weight.
          </p>
        </button>
      </div>
    </>
  );
}

const ONBOARDING_PRS: Array<{
  id: string;
  label: string;
  unit: string;
  placeholder: string;
}> = [
  { id: "bench-press", label: "Bench Press", unit: "kg", placeholder: "80" },
  { id: "squat", label: "Back Squat", unit: "kg", placeholder: "100" },
  { id: "deadlift", label: "Deadlift", unit: "kg", placeholder: "120" },
];

function PRStep({ onContinue }: { onContinue: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});

  function commit() {
    const today = isoDay();
    const manualPRs: Record<string, { value: number; reps?: number; date: string }> = {};
    for (const pr of ONBOARDING_PRS) {
      const n = Number(vals[pr.id]);
      if (n > 0) {
        manualPRs[pr.id] =
          pr.unit === "kg" ? { value: n, reps: 1, date: today } : { value: n, date: today };
      }
    }
    if (Object.keys(manualPRs).length) {
      setState((s) => ({ ...s, manualPRs: { ...(s.manualPRs ?? {}), ...manualPRs } }));
    }
    onContinue();
  }

  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">Your PRs</h1>
      <p className="text-sm text-[#8a8a8a] mb-6">
        Best single lift for each. Rough numbers are fine — leave blank to skip.
      </p>
      <div className="flex flex-col gap-3 mb-6">
        {ONBOARDING_PRS.map((pr) => (
          <div
            key={pr.id}
            className="bg-grit-card border border-grit rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="display text-base font-extrabold uppercase text-grit truncate">
                {pr.label}
              </p>
              <p className="label-cap text-[9px] text-grit-dim mt-0.5">1-rep max · optional</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                defaultValue={vals[pr.id] ?? ""}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                  e.target.value = clean;
                  setVals((v) => ({ ...v, [pr.id]: clean }));
                }}
                inputMode="decimal"
                placeholder={pr.placeholder}
                className="input-grit w-24 h-12 text-center text-xl font-display font-extrabold"
                aria-label={`${pr.label} one-rep max in kilograms`}
              />
              <span className="label-cap text-[10px] text-grit-dim">{pr.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <button onClick={commit} className="btn-grit">
          Continue
        </button>
        <button onClick={onContinue} className="btn-ghost">
          Skip for now
        </button>
      </div>
    </>
  );
}

/**
 * Asks which weekdays the lifter trains rather than only how many. The count
 * alone left `defaultSchedule` guessing — three days was always Mon/Wed/Fri,
 * whatever the lifter's week actually looked like.
 */
function TrainingDaysStep({
  initial,
  onPreview,
  onSubmit,
}: {
  initial?: DayKey[];
  onPreview: (days: DayKey[]) => void;
  onSubmit: (days: DayKey[]) => void;
}) {
  const [days, setDays] = useState<DayKey[]>(initial ?? ["MON", "WED", "FRI"]);
  const enough = days.length >= MIN_TRAINING_DAYS;
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">
        Which days do you train?
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-6">
        Tap the days that suit your week. We'll put your workouts on exactly those days and rest you
        on the others.
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

      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={() => onSubmit(days)}
          disabled={!enough}
          className="btn-grit disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </>
  );
}

function FocusStep({
  initial,
  onSubmit,
  onSkip,
}: {
  initial?: FocusMuscle[];
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
    setPicked((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : cur.length < 2 ? [...cur, m] : [cur[1], m],
    );
  }
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">
        What do you want to grow?
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-6">
        Pick up to two priority muscles. Your split gets extra volume where you want it.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {OPTIONS.map((o) => {
          const active = picked.includes(o.v);
          return (
            <button
              key={o.v}
              onClick={() => toggle(o.v)}
              className="border rounded-2xl p-4 text-left press"
              style={{
                borderColor: active ? "#e63222" : "#262626",
                background: active ? "rgba(230,50,34,0.1)" : "#141414",
              }}
            >
              <p className="display text-lg font-extrabold uppercase text-grit">{o.l}</p>
              <p
                className="label-cap text-[9px] mt-0.5"
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
          className="btn-grit disabled:opacity-40"
        >
          Continue
        </button>
        <button onClick={onSkip} className="btn-ghost">
          No preference
        </button>
      </div>
    </>
  );
}

function TargetStep({
  currentKg,
  goal,
  initial,
  onSubmit,
  onSkip,
}: {
  currentKg?: number;
  goal?: Goal;
  initial?: number;
  onSubmit: (n: number) => void;
  onSkip: () => void;
}) {
  const [v, setV] = useState(initial != null ? String(initial) : "");
  const n = Number(v);
  const valid = Number.isFinite(n) && n >= 30 && n <= 250;
  const hint =
    goal === "BULK"
      ? "Where do you want the scale in 6 months?"
      : goal === "CUT"
        ? "What weight are you cutting to?"
        : "A number to aim at keeps the log honest.";
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">Target weight</h1>
      <p className="text-sm text-[#8a8a8a] mb-6">
        {hint}
        {currentKg ? ` You're at ${currentKg}kg now.` : ""}
      </p>
      <div className="flex items-center gap-3 mb-6">
        <input
          defaultValue={v}
          onChange={(e) => {
            const c = e.target.value.replace(/[^0-9.]/g, "");
            e.target.value = c;
            setV(c);
          }}
          inputMode="decimal"
          placeholder={currentKg ? String(currentKg) : "80"}
          className="input-grit text-2xl display font-extrabold"
        />
        <span className="label-cap text-grit-dim">kg</span>
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={() => valid && onSubmit(n)}
          disabled={!valid}
          className="btn-grit disabled:opacity-40"
        >
          Continue
        </button>
        <button onClick={onSkip} className="btn-ghost">
          Skip
        </button>
      </div>
    </>
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

// Cinematic build-up before the blueprint: sequential, personalized "analysis"
// lines tick over with a filling progress bar, then auto-advances.
function AnalyzingStep({ draft, onDone }: { draft: Partial<Profile>; onDone: () => void }) {
  const p = draft as Profile;
  const focus = (p.focusMuscles ?? []).join(" + ").toLowerCase();
  const lines = useMemo(
    () => [
      "Reading your goals and your why",
      `Calibrating a ${p.daysPerWeek ?? 4}-day split${focus ? ` with extra ${focus}` : ""}`,
      "Setting your calorie and protein targets",
      "Benchmarking your lifts against the standards",
      "Locking in your ranked starting point",
    ],
    [p.daysPerWeek, focus],
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
      <p className="label-cap text-accent-red text-[10px] mb-1">Building your blueprint</p>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-8">Locking you in…</h1>
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

// The lock-in finale: a first-person pledge with a chosen horizon and target
// date. Tapping "I'm locked in" is the final onboarding action (triggers save).
function CommitStep({
  draft,
  onCommit,
}: {
  draft: Partial<Profile>;
  onCommit: (commitmentDate: string) => void;
}) {
  const p = draft as Profile;
  const name = p.displayName?.trim() || p.username || "Athlete";
  const goalLine =
    (
      {
        BULK: "build serious size",
        CUT: "get lean and defined",
        MAINTAIN: "stay strong and sharp",
        ATHLETIC: "perform like an athlete",
      } as Record<string, string>
    )[p.goal] ?? "transform";
  const [horizon, setHorizon] = useState(90);
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + horizon);
    return d;
  }, [horizon]);
  const iso = targetDate.toISOString().slice(0, 10);
  const pretty = targetDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex-1 flex flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">The last step is a promise</p>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-5">Lock in.</h1>
      <div className="deadset-3d-panel border border-accent-red/40 bg-[#0c0c0c] p-5 mb-6">
        <p className="text-sm text-grit leading-relaxed">
          I, <span className="font-extrabold text-white">{name}</span>, am done starting over. For
          the next <span className="text-accent-red font-bold">{horizon} days</span> I show up, I
          log every session, and I {goalLine}. No excuses.
        </p>
        <p className="label-cap text-[9px] text-grit-dim mt-4">Target date</p>
        <p className="display text-xl font-extrabold text-white">{pretty}</p>
      </div>
      <p className="label-cap text-[10px] text-grit-dim mb-2">Choose your horizon</p>
      <div className="grid grid-cols-3 gap-2 mb-auto">
        {[30, 90, 180].map((d) => (
          <button
            key={d}
            onClick={() => setHorizon(d)}
            className="py-3 rounded-xl border press font-bold text-sm"
            style={{
              background: horizon === d ? "rgba(230,50,34,0.12)" : "#141414",
              borderColor: horizon === d ? "#e63222" : "#262626",
              color: horizon === d ? "#fff" : "#8A8A8A",
            }}
          >
            {d} days
          </button>
        ))}
      </div>
      <button
        onClick={() => onCommit(iso)}
        className="btn-grit w-full mt-6 py-4 text-base animate-subtle-pulse"
      >
        <Zap size={16} className="mr-2" />
        I&apos;m locked in
      </button>
    </div>
  );
}
