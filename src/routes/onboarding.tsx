import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Zap } from "lucide-react";
import { GritLogo } from "@/components/GritLogo";
import { getState, setState, waitForRemoteState } from "@/lib/storage";
import { defaultSchedule } from "@/lib/calc";
import { getExercise } from "@/lib/exercises";
import { getMyProfile, saveProfile } from "@/lib/profile.functions";
import { profileFromAccount } from "@/lib/account-restore";
import type { Equipment, Experience, Gender, Goal, Profile, Weakness } from "@/lib/types";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "DEADSET — Onboarding" }] }),
  component: Onboarding,
});

type Step =
  | "mode"
  | "goal"
  | "days"
  | "equipment"
  | "schedule"
  | "experience"
  | "age"
  | "weight"
  | "height"
  | "gender"
  | "injuries"
  | "weakness"
  | "username"
  | "photo";

type Mode = "GENERATE" | "BUILD";

function orderFor(mode: Mode | null): Step[] {
  const base: Step[] = ["mode"];
  if (!mode) return base;
  const schedule: Step[] =
    mode === "GENERATE"
      ? ["goal", "days", "equipment", "schedule"]
      : ["goal", "days", "equipment"];
  return [
    ...base,
    ...schedule,
    "experience",
    "age",
    "weight",
    "height",
    "gender",
    "injuries",
    "weakness",
    "username",
    "photo",
  ];
}

function Onboarding() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const save = useServerFn(saveProfile);
  const getProfile = useServerFn(getMyProfile);
  const ORDER = useMemo(() => orderFor(mode), [mode]);
  const step = ORDER[idx];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      await waitForRemoteState(session.user.id);
      if (cancelled) return;
      if (getState().profile) {
        navigate({ to: "/train", replace: true });
        return;
      }
      const accountProfile = profileFromAccount(await getProfile().catch(() => null));
      if (accountProfile) {
        setState((current) => ({
          ...current,
          profile: accountProfile,
          schedule: current.schedule ?? defaultSchedule(accountProfile),
        }));
        navigate({ to: "/train", replace: true });
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
      const p = {
        ...merged,
        startingWeightKg: merged.startingWeightKg ?? merged.weightKg,
      } as Profile;
      const sched = mode === "BUILD" ? emptySchedule() : defaultSchedule(p);
      setState((s) => ({ ...s, profile: p, schedule: sched }));
      save({
        data: {
          username: p.username,
          display_name: p.username,
          goal: p.goal,
          experience: p.experience,
          gender: p.gender,
          age: p.age,
          weight_kg: p.weightKg,
          height_cm: p.heightCm,
          days_per_week: p.daysPerWeek,
          equipment: p.equipment,
          avatar_url: p.avatarDataUrl,
          onboarded: true,
        },
      })
        .then(() => navigate({ to: "/train", replace: true }))
        .catch((e: Error) => {
          toast.error(e.message || "Couldn't save profile");
          navigate({ to: "/train", replace: true });
        });
    } else {
      setIdx(idx + 1);
    }
  }

  return (
    <div
      className="min-h-screen bg-grit flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-6 pt-10 pb-6 flex items-center justify-between">
        <GritLogo className="text-3xl" />
        <span className="label-cap">
          {idx + 1} / {ORDER.length}
        </span>
      </div>
      <div className="px-6">
        <div className="h-1 bg-grit-card">
          <div
            className="h-1 bg-accent-red transition-all"
            style={{ width: `${((idx + 1) / ORDER.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex-1 px-6 pt-10 pb-10 flex flex-col">
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
        {step === "age" && (
          <Numeric
            title="Your age"
            suffix="yrs"
            min={13}
            max={90}
            onSubmit={(n) => next({ age: n })}
          />
        )}
        {step === "weight" && (
          <Numeric
            title="Your weight"
            suffix="kg"
            min={30}
            max={250}
            onSubmit={(n) => next({ weightKg: n })}
          />
        )}
        {step === "height" && (
          <Numeric
            title="Your height"
            suffix="cm"
            min={120}
            max={230}
            onSubmit={(n) => next({ heightCm: n })}
          />
        )}
        {step === "gender" && (
          <Choice
            title="Gender"
            options={[
              { v: "MALE", l: "Male" },
              { v: "FEMALE", l: "Female" },
              { v: "OTHER", l: "Other" },
            ]}
            onPick={(v) => next({ gender: v as Gender })}
          />
        )}
        {step === "days" && (
          <Choice
            title="Days per week you can train"
            options={[
              { v: "3", l: "3 days" },
              { v: "4", l: "4 days" },
              { v: "5", l: "5 days" },
              { v: "6", l: "6 days" },
            ]}
            onPick={(v) => next({ daysPerWeek: Number(v) as 3 | 4 | 5 | 6 })}
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
        {step === "schedule" && (
          <SchedulePreview draft={draft} onContinue={() => next({})} />
        )}
        {step === "injuries" && (
          <Injuries onSubmit={(t) => next({ injuries: t })} onSkip={() => next({ injuries: "" })} />
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
        {step === "username" && <UsernameStep onSubmit={(u) => next({ username: u })} />}
        {step === "photo" && (
          <PhotoStep onSubmit={(url) => next({ avatarDataUrl: url })} onSkip={() => next({})} />
        )}
      </div>
    </div>
  );
}

function Choice({
  title,
  options,
  onPick,
}: {
  title: string;
  options: { v: string; l: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-8">{title}</h1>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onPick(o.v)}
            className="bg-grit-card border border-grit p-5 text-left hover:border-accent-red transition-colors"
          >
            <span className="display text-lg uppercase tracking-wide font-bold text-grit">
              {o.l}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function Numeric({
  title,
  suffix,
  min,
  max,
  onSubmit,
}: {
  title: string;
  suffix: string;
  min: number;
  max: number;
  onSubmit: (n: number) => void;
}) {
  const [v, setV] = useState("");
  const n = Number(v);
  const valid = v !== "" && n >= min && n <= max;
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-8">{title}</h1>
      <div className="flex items-end gap-3 mb-8">
        <input
          autoFocus
          inputMode="numeric"
          type="number"
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="bg-transparent border-b-2 border-grit focus:border-accent-red outline-none text-6xl font-display font-extrabold text-grit w-40 pb-2"
          placeholder="0"
        />
        <span className="label-cap text-lg pb-3">{suffix}</span>
      </div>
      <button disabled={!valid} onClick={() => onSubmit(n)} className="btn-grit mt-auto">
        Continue
      </button>
    </>
  );
}

function Injuries({ onSubmit, onSkip }: { onSubmit: (s: string) => void; onSkip: () => void }) {
  const [v, setV] = useState("");
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">
        Injuries or limits?
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-8">Optional. Skip if none.</p>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={5}
        className="input-grit mb-4"
        placeholder="e.g. lower back tweak, bad knee..."
      />
      <div className="mt-auto flex flex-col gap-3">
        <button onClick={() => onSubmit(v)} className="btn-grit">
          Finish Setup
        </button>
        <button onClick={onSkip} className="btn-ghost">
          Skip
        </button>
      </div>
    </>
  );
}

function UsernameStep({ onSubmit }: { onSubmit: (u: string) => void }) {
  const [v, setV] = useState("");
  const clean = v
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  const valid = clean.length >= 3;
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">Pick a username</h1>
      <p className="text-sm text-[#8a8a8a] mb-8">Public. Shown on leaderboards and your profile.</p>
      <div className="flex items-center gap-2 mb-8 border-b-2 border-grit focus-within:border-accent-red">
        <span className="text-3xl font-display font-extrabold text-grit-dim pb-2">@</span>
        <input
          autoFocus
          value={clean}
          onChange={(e) => setV(e.target.value)}
          className="bg-transparent outline-none text-4xl font-display font-extrabold text-grit flex-1 pb-2"
          placeholder="ironwolf"
        />
      </div>
      <button disabled={!valid} onClick={() => onSubmit(clean)} className="btn-grit mt-auto">
        Continue
      </button>
    </>
  );
}

function PhotoStep({ onSubmit, onSkip }: { onSubmit: (url: string) => void; onSkip: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  function pick(file: File) {
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
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
        <button
          disabled={!preview}
          onClick={() => preview && onSubmit(preview)}
          className="btn-grit"
        >
          Finish Setup
        </button>
        <button onClick={onSkip} className="btn-ghost">
          Skip
        </button>
      </div>
    </>
  );
}

function SchedulePreview({
  draft,
  onContinue,
}: {
  draft: Partial<Profile>;
  onContinue: () => void;
}) {
  // Build a schedule from the 3 basics; rest of profile is irrelevant to defaultSchedule.
  const stub = useMemo(
    () =>
      ({
        goal: draft.goal ?? "MAINTAIN",
        daysPerWeek: draft.daysPerWeek ?? 4,
        equipment: draft.equipment ?? "FULL_GYM",
      }) as Profile,
    [draft.goal, draft.daysPerWeek, draft.equipment],
  );
  const schedule = useMemo(() => defaultSchedule(stub), [stub]);

  const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

  return (
    <>
      <p className="label-cap text-accent-red mb-2 flex items-center gap-1.5">
        <Zap size={12} /> YOUR WEEK
      </p>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-1">
        Schedule locked in
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-6">
        {draft.daysPerWeek} days · {(draft.equipment ?? "").replace("_", " ").toLowerCase()} · tuned for{" "}
        {(draft.goal ?? "").toLowerCase()}. Tweak anytime in Programs.
      </p>
      <div className="flex flex-col gap-1.5 mb-6">
        {DAYS.map((d) => {
          const day = schedule[d];
          const isRest = !day.exerciseIds.length;
          return (
            <div
              key={d}
              className="bg-grit-card border border-grit p-3 flex items-start gap-3"
              style={{ borderColor: isRest ? "#262626" : "#3a1410" }}
            >
              <span className="label-cap text-[10px] w-10 pt-0.5 text-grit-dim">{d}</span>
              <div className="flex-1 min-w-0">
                <p
                  className="display text-xs uppercase font-extrabold leading-tight"
                  style={{ color: isRest ? "#8a8a8a" : "#f5f5f0" }}
                >
                  {day.label}
                </p>
                {!isRest && (
                  <p className="text-[10px] text-grit-dim mt-1 truncate">
                    {day.exerciseIds
                      .map((id) => getExercise(id)?.name ?? id)
                      .join(" · ")}
                  </p>
                )}
              </div>
              {!isRest && <Check size={14} className="text-accent-red flex-shrink-0 mt-1" />}
            </div>
          );
        })}
      </div>
      <button onClick={onContinue} className="btn-grit mt-auto">
        Lock it in — finish profile
      </button>
    </>
  );
}
