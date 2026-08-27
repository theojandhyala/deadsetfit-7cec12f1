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
import { getState, setLocalStateOwner, setState, waitForRemoteState } from "@/lib/storage";
import { calculateCalories, calculateMacros, defaultSchedule, isoDay } from "@/lib/calc";
import { strengthStandard, TIER_COLORS } from "@/lib/strength-standards";
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
import { PRO_HIGHLIGHTS } from "@/lib/pro-features";
import {
  CURRENCY_META,
  currencyForCountry,
  detectCountry,
  type SupportedCurrency,
} from "@/lib/currency";

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
  | "commit"
  | "pro";

type Mode = "GENERATE" | "BUILD";

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

function orderFor(mode: Mode | null): Step[] {
  const base: Step[] = ["mode"];
  if (!mode) return base;
  const schedule: Step[] =
    mode === "GENERATE"
      ? ["goal", "days", "equipment", "preferences", "schedule"]
      : ["goal", "days", "equipment", "preferences"];
  return [...base, ...schedule, "username"];
}

function Onboarding() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [draftSchedule, setDraftSchedule] = useState<Schedule | null>(null);
  const savingRef = useRef(false);
  // Where to land after the final save: the web pro step can point this at
  // /upgrade; everything else finishes into the app.
  const destinationRef = useRef<"/train" | "/plan" | "/upgrade">("/train");
  const save = saveProfile;
  const saveFullState = saveUserState;
  const getProfile = getMyProfile;
  const ORDER = useMemo(() => orderFor(mode), [mode]);
  const step = ORDER[idx];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
          navigate({ to: "/train", replace: true });
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
    const merged = { ...draft, ...patch };
    setDraft(merged);
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
        age: merged.age ?? 25,
        weightKg: merged.weightKg ?? 75,
        heightCm: merged.heightCm ?? 175,
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
        startingWeightKg: merged.startingWeightKg ?? merged.weightKg ?? 75,
        username: merged.username,
        avatarDataUrl: merged.avatarDataUrl,
        targetWeightKg: merged.targetWeightKg,
        dreamOutcome: merged.dreamOutcome,
        commitmentDate: merged.commitmentDate,
        committed: merged.committed,
      };
      const sched = mode === "BUILD" ? emptySchedule() : (draftSchedule ?? defaultSchedule(p));
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
          navigate({ to: mode === "BUILD" ? "/plan" : destinationRef.current, replace: true });
        })
        .catch((e: Error) => {
          savingRef.current = false;
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

  return (
    <div
      className="deadset-onboarding min-h-screen bg-grit flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-6 pt-10 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {idx > 0 && (
            <button
              onClick={() => setIdx(idx - 1)}
              aria-label="Back"
              className="w-9 h-9 -ml-2 flex items-center justify-center rounded-full border border-grit bg-grit-card text-grit-dim press"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <GritLogo className="text-3xl" />
        </div>
        <span className="label-cap">
          {idx === 0 ? "QUICK SETUP" : `${idx} / ${ORDER.length - 1}`}
        </span>
      </div>
      <div className="px-6">
        <div className="h-1.5 bg-grit-card rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-red rounded-full transition-all"
            style={{
              width:
                idx === 0 ? "0%" : `${Math.round((idx / Math.max(1, ORDER.length - 1)) * 100)}%`,
            }}
          />
        </div>
      </div>
      <div key={step} className="flex-1 px-6 pt-10 pb-10 flex flex-col animate-slide-up">
        {step === "mode" && (
          <ModeStep
            onPick={(m: Mode) => {
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
          <TrainingPreferencesStep initial={draft} onSubmit={(patch) => next(patch)} />
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
        {step === "blueprint" && <BlueprintStep draft={draft} onEnter={() => next({})} />}
        {step === "commit" && (
          <CommitStep
            draft={draft}
            onCommit={(commitmentDate) => next({ committed: true, commitmentDate })}
          />
        )}
        {step === "pro" && (
          <ProChoiceStep
            onChoose={(goPro) => {
              destinationRef.current = goPro ? "/upgrade" : "/train";
              next({});
            }}
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
  onSubmit,
}: {
  initial?: Partial<Profile>;
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
    setFocus((current) => {
      if (current.includes(muscle)) return current.filter((item) => item !== muscle);
      return current.length < 2 ? [...current, muscle] : [current[1], muscle];
    });
  }

  const sessionMinutes = exerciseCount <= 3 ? 30 : exerciseCount <= 4 ? 45 : exerciseCount <= 5 ? 60 : 90;

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
                onClick={() => setExperience(level)}
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
                onClick={() => setExerciseCount(count)}
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
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">About you</h1>
      <p className="text-sm text-[#8a8a8a] mb-8">
        Sets your calories, macros and strength standards. Never shown publicly.
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
                  const cleaned = e.target.value.replace(f.digitsOnly ? /[^0-9]/g : /[^0-9.]/g, "");
                  e.target.value = cleaned;
                  f.set(cleaned);
                }}
                inputMode="decimal"
                placeholder={f.placeholder}
                className="bg-transparent outline-none w-full min-w-0 text-2xl font-display font-extrabold text-grit"
                style={{ color: f.value && !f.ok ? "#e63222" : undefined }}
              />
              <span className="label-cap text-[9px] text-grit-dim">{f.suffix}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="label-cap text-[10px] text-grit-dim mb-2">GENDER</p>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {(["MALE", "FEMALE", "OTHER"] as Gender[]).map((g) => {
          const active = gender === g;
          return (
            <button
              key={g}
              onClick={() => setGender(g)}
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
                {g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Other"}
              </span>
            </button>
          );
        })}
      </div>
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
      }) as Profile,
    [draft.goal, draft.daysPerWeek, draft.equipment, draft.focusMuscles, draft.exercisesPerSession],
  );
  const [schedule, setSchedule] = useState<Schedule>(() => initial ?? defaultSchedule(stub));
  const [selectedDay, setSelectedDay] = useState<DayKey>("MON");

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

  return (
    <>
      <p className="label-cap mb-2 flex items-center gap-1.5 text-accent-red">
        <Zap size={12} /> BUILD YOUR WEEK
      </p>
      <h1 className="display mb-1 text-3xl font-extrabold uppercase text-grit sm:text-4xl">
        Set every target now
      </h1>
      <p className="mb-5 text-sm leading-relaxed text-[#8a8a8a]">
        Choose the exercises, order, sets and reps before you start. Everything remains editable
        later.
      </p>

      <div className="grid grid-cols-7 gap-1.5" aria-label="Training week">
        {DAYS.map((d) => {
          const day = schedule[d];
          const isRest = !day.exerciseIds.length;
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
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

function emptySchedule(): import("@/lib/types").Schedule {
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
  const out = {} as Record<string, { label: string; exerciseIds: string[] }>;
  days.forEach((d) => {
    out[d] = { label: "REST", exerciseIds: [] };
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
  onSubmit,
}: {
  initial?: DayKey[];
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
        Tap the days that suit your week. We'll put your workouts on exactly those
        days and rest you on the others.
      </p>

      <WeekdayPicker value={days} onChange={setDays} />

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

function BlueprintStep({ draft, onEnter }: { draft: Partial<Profile>; onEnter: () => void }) {
  const p = draft as Profile;
  const calories = p.weightKg && p.heightCm && p.age ? calculateCalories(p) : 0;
  const macros = calories ? calculateMacros(p, calories) : null;
  const manualPRs = getState().manualPRs ?? {};
  const lifts = (
    [
      { id: "bench-press", label: "Bench" },
      { id: "squat", label: "Squat" },
      { id: "deadlift", label: "Deadlift" },
    ] as const
  )
    .map((l) => {
      const pr = manualPRs[l.id];
      const oneRm = pr?.value ?? 0;
      const std = oneRm && p.weightKg ? strengthStandard(oneRm, p.weightKg, l.id, p.gender) : null;
      return { ...l, oneRm, std };
    })
    .filter((l) => l.std);
  const program =
    p.experience === "BEGINNER"
      ? "StrongLifts 5x5"
      : p.experience === "ADVANCED"
        ? (p.daysPerWeek ?? 4) >= 6
          ? "Arnold Split"
          : "nSuns 5/3/1"
        : p.goal === "BULK"
          ? "PHUL"
          : "5/3/1 BBB";
  const focus = (p.focusMuscles ?? []).join(" + ");
  const delta =
    p.targetWeightKg && p.weightKg ? Math.round((p.targetWeightKg - p.weightKg) * 10) / 10 : null;

  return (
    <>
      <p className="label-cap text-accent-red text-[10px] mb-1">BUILT FROM YOUR ANSWERS</p>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-5">Your blueprint</h1>
      <div className="flex flex-col gap-2 mb-6">
        <div className="bg-grit-card border border-grit p-4">
          <p className="label-cap text-[9px] text-grit-dim">THE WEEK</p>
          <p className="text-sm text-grit font-bold mt-1">
            {p.daysPerWeek} days · {p.exercisesPerSession ?? 5} exercises per workout
            {focus && ` · extra ${focus.toLowerCase()}`}
          </p>
        </div>
        {calories > 0 && macros && (
          <div className="bg-grit-card border border-grit p-4">
            <p className="label-cap text-[9px] text-grit-dim">THE FUEL</p>
            <p className="text-sm text-grit font-bold mt-1">
              {calories} kcal · {macros.protein}g protein a day
              {delta !== null && delta !== 0 && (
                <span className="text-grit-dim font-normal">
                  {" "}
                  — {Math.abs(delta)}kg to {delta > 0 ? "gain" : "drop"}
                </span>
              )}
            </p>
          </div>
        )}
        {lifts.length > 0 && (
          <div className="bg-grit-card border border-grit p-4">
            <p className="label-cap text-[9px] text-grit-dim mb-2">WHERE YOU STAND</p>
            <div className="flex flex-col gap-1.5">
              {lifts.map((l) => (
                <div key={l.id} className="flex items-center justify-between">
                  <span className="text-xs text-grit font-bold">
                    {l.label} {l.oneRm}kg
                  </span>
                  <span
                    className="label-cap text-[9px] rounded px-1.5 border"
                    style={{
                      color: TIER_COLORS[l.std!.tier],
                      borderColor: `${TIER_COLORS[l.std!.tier]}66`,
                    }}
                  >
                    {l.std!.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="bg-grit-card border border-accent-red/40 p-4">
          <p className="label-cap text-[9px] text-accent-red">RECOMMENDED PROGRAM</p>
          <p className="text-sm text-grit font-bold mt-1">
            {program}
            <span className="label-cap text-[8px] text-accent-red border border-accent-red/40 rounded px-1 ml-2">
              PRO
            </span>
          </p>
          <p className="text-[11px] text-grit-dim mt-1">
            Matched to your experience, goal and week. Find it in Programs.
          </p>
        </div>
      </div>
      <div className="mt-auto">
        <button onClick={onEnter} className="btn-grit w-full">
          <Zap size={16} className="mr-2" />
          One last thing
        </button>
      </div>
    </>
  );
}

// Web-only conversion moment at the end of onboarding: Free vs Pro with
// ticks, a monthly/yearly toggle, and a clear "start free" escape hatch.
// (Never rendered on native iOS — App Store 3.1.1.)
function ProChoiceStep({ onChoose }: { onChoose: (goPro: boolean) => void }) {
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [currency, setCurrency] = useState<SupportedCurrency>("gbp");
  useEffect(() => {
    detectCountry().then((c) => setCurrency(currencyForCountry(c)));
  }, []);
  const meta = CURRENCY_META[currency];
  return (
    <div className="flex-1 flex flex-col">
      <p className="label-cap text-accent-red text-[10px] mb-1">One decision left</p>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-1">Choose your edge</h1>
      <p className="text-xs text-grit-dim mb-5">
        Everything core is free forever. Pro is for the ones chasing rank.
      </p>

      {/* Free vs Pro ticks */}
      <div className="bg-grit-card border border-grit rounded-2xl overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_56px_56px] items-center px-4 py-2.5 border-b border-grit">
          <span className="label-cap text-[9px] text-grit-dim">Feature</span>
          <span className="label-cap text-[9px] text-grit-dim text-center">Free</span>
          <span className="label-cap text-[9px] text-accent-red text-center">Pro</span>
        </div>
        <div className="grid grid-cols-[1fr_56px_56px] items-center px-4 py-2.5 border-b border-grit/60">
          <span className="text-xs text-grit font-medium">All core training & social</span>
          <span className="text-center">
            <Check size={14} className="inline text-grit" />
          </span>
          <span className="text-center">
            <Check size={14} className="inline text-accent-red" />
          </span>
        </div>
        {PRO_HIGHLIGHTS.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[1fr_56px_56px] items-center px-4 py-2.5 border-b border-grit/60 last:border-b-0"
          >
            <span className="text-xs text-grit font-medium">{r.label}</span>
            <span className="text-center text-grit-dim text-xs">
              {typeof r.free === "string" ? r.free : "—"}
            </span>
            <span className="text-center">
              {typeof r.pro === "string" ? (
                <span className="text-xs text-accent-red font-bold">{r.pro}</span>
              ) : (
                <Check size={14} className="inline text-accent-red" />
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Month vs year */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => setPlan("yearly")}
          className="rounded-2xl border p-3 text-left press relative"
          style={{
            background: plan === "yearly" ? "rgba(230,50,34,0.12)" : "#141414",
            borderColor: plan === "yearly" ? "#e63222" : "#262626",
          }}
        >
          <span
            className="absolute -top-2 left-3 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full text-white"
            style={{ background: "#e63222" }}
          >
            Save 33%
          </span>
          <p className="label-cap text-[9px] text-grit-dim">Yearly</p>
          <p className="display text-xl font-extrabold text-white leading-none mt-0.5">
            {meta.yearly}
          </p>
          <p className="text-[10px] text-grit-dim">per year</p>
        </button>
        <button
          onClick={() => setPlan("monthly")}
          className="rounded-2xl border p-3 text-left press"
          style={{
            background: plan === "monthly" ? "rgba(230,50,34,0.12)" : "#141414",
            borderColor: plan === "monthly" ? "#e63222" : "#262626",
          }}
        >
          <p className="label-cap text-[9px] text-grit-dim">Monthly</p>
          <p className="display text-xl font-extrabold text-white leading-none mt-0.5">
            {meta.monthly}
          </p>
          <p className="text-[10px] text-grit-dim">per month · cancel anytime</p>
        </button>
      </div>

      <div className="mt-auto">
        <button
          onClick={() => onChoose(true)}
          className="btn-grit w-full py-4 text-base animate-subtle-pulse"
        >
          <Zap size={16} className="mr-2" />
          Unlock DEADSET Pro
        </button>
        <button
          onClick={() => onChoose(false)}
          className="mt-3 w-full text-center label-cap text-[10px] text-grit-dim press py-2"
        >
          Start free — upgrade any time
        </button>
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
