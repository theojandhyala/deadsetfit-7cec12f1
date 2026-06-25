import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Zap, Camera, MessageSquare, Scan, Trophy } from "lucide-react";
import { GritLogo } from "@/components/GritLogo";
import { getState, setLocalStateOwner, setState } from "@/lib/storage";
import { defaultSchedule } from "@/lib/calc";
import { getExercise } from "@/lib/exercises";
import { getMyProfile, saveProfile } from "@/lib/profile.functions";
import { profileFromAccount, profileQuestionsComplete, withTimeout } from "@/lib/account-restore";
import type { Equipment, Experience, Gender, Goal, Profile, Weakness } from "@/lib/types";
import { buildPublicStats, PR_CATALOG } from "@/lib/fifa-stats";
import { cacheProfileBootstrap, getLoggedSession, logSessionEvent } from "@/lib/session-diagnostics";

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
  | "prs"
  | "username"
  | "photo"
  | "tour";

type Mode = "GENERATE" | "BUILD";

function orderFor(mode: Mode | null): Step[] {
  const base: Step[] = ["mode"];
  if (!mode) return base;
  const schedule: Step[] =
    mode === "GENERATE" ? ["goal", "days", "equipment", "schedule"] : ["goal", "days", "equipment"];
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
    "prs",
    "username",
    "photo",
    "tour",
  ];
}

function Onboarding() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [submitting, setSubmitting] = useState(false);
  const save = useServerFn(saveProfile);
  const getProfile = useServerFn(getMyProfile);
  const ORDER = useMemo(() => orderFor(mode), [mode]);
  const step = ORDER[idx];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      logSessionEvent("onboarding:bootstrap-start");
      const session = await getLoggedSession("onboarding:bootstrap", 3000);
      if (cancelled) return;
      if (!session) {
        logSessionEvent("onboarding:no-session-redirect-auth");
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUserId(session.user.id);
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
        setLocalStateOwner(session.user.id);
        cacheProfileBootstrap(session.user.id, {
          onboarded: Boolean(row?.onboarded),
          complete: true,
          hasUsername: Boolean(row?.username),
        });
        logSessionEvent("onboarding:already-complete-redirect-train", {
          user: session.user.id.slice(0, 8),
        });
        navigate({ to: "/train", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getProfile, navigate]);

  async function finalize(merged: Partial<Profile>) {
    const p = {
      ...merged,
      startingWeightKg: merged.startingWeightKg ?? merged.weightKg,
    } as Profile;
    const sched = mode === "BUILD" ? emptySchedule() : defaultSchedule(p);
    if (userId) setLocalStateOwner(userId);
    setState((s) => ({ ...s, profile: p, schedule: sched }));
    const publicStats = buildPublicStats(getState());

    setSubmitting(true);
    // Retry the save up to 3 times so a transient network blip doesn't
    // silently leave the account un-onboarded.
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await save({
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
            public_stats: publicStats,
            onboarded: true,
          },
        });
        setSubmitting(false);
        if (userId) {
          cacheProfileBootstrap(userId, {
            onboarded: true,
            complete: true,
            hasUsername: Boolean(p.username),
          });
          logSessionEvent("onboarding:profile-saved", { user: userId.slice(0, 8) });
        }
        navigate({ to: "/train", replace: true });
        return;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error("Save failed");
        logSessionEvent("onboarding:profile-save-error", {
          attempt: attempt + 1,
          message: lastErr.message,
        });
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    setSubmitting(false);
    toast.error(
      lastErr?.message ||
        "Couldn't save your details. Check your connection and tap Finish again.",
    );
  }

  function next(patch: Partial<Profile>) {
    const merged = { ...draft, ...patch };
    setDraft(merged);
    if (idx === ORDER.length - 1) {
      void finalize(merged);
    } else {
      setIdx(idx + 1);
    }
  }

  if (submitting) {
    return (
      <div className="min-h-screen bg-grit flex flex-col items-center justify-center px-6">
        <GritLogo className="text-3xl mb-6" />
        <p className="label-cap text-grit-dim">Saving your setup…</p>
      </div>
    );
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
        {step === "schedule" && <SchedulePreview draft={draft} onContinue={() => next({})} />}
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
        {step === "prs" && <PRStep onContinue={() => next({})} />}
        {step === "username" && <UsernameStep onSubmit={(u) => next({ username: u })} />}
        {step === "photo" && (
          <PhotoStep onSubmit={(url) => next({ avatarDataUrl: url })} onSkip={() => next({})} />
        )}
        {step === "tour" && <TourStep onContinue={() => next({})} />}
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
          Continue
        </button>
        <button onClick={onSkip} className="btn-ghost">
          Skip — no injuries
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
        <button onClick={() => (preview ? onSubmit(preview) : onSkip())} className="btn-grit">
          Finish Setup
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
        {draft.daysPerWeek} days · {(draft.equipment ?? "").replace("_", " ").toLowerCase()} · tuned
        for {(draft.goal ?? "").toLowerCase()}. Tweak anytime in Programs.
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
                    {day.exerciseIds.map((id) => getExercise(id)?.name ?? id).join(" · ")}
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
      <p className="label-cap text-accent-red mb-3 text-[10px]">STEP 1 OF 1 MINUTE</p>
      <h1 className="display text-4xl font-extrabold uppercase text-grit mb-2 leading-none">
        Let's build your programme.
      </h1>
      <p className="text-sm mb-8" style={{ color: "#8A8A8A" }}>Answer 3 questions and we'll generate a full weekly training schedule tuned to your goal and equipment.</p>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => onPick("GENERATE")}
          className="border-2 border-accent-red p-6 text-left transition-colors"
          style={{ background: "linear-gradient(135deg,#1a0606 0%,#0a0a0a 100%)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-accent-red" />
            <span className="label-cap text-accent-red text-[10px]">FASTEST — RECOMMENDED</span>
          </div>
          <span className="display text-2xl uppercase font-extrabold text-white block leading-tight">
            Generate My Schedule
          </span>
          <p className="text-xs mt-1.5" style={{ color: "#8A8A8A" }}>3 questions. 10 seconds. Full programme ready.</p>
        </button>
        <button
          onClick={() => onPick("BUILD")}
          className="border border-grit p-6 text-left transition-colors"
          style={{ background: "#141414" }}
        >
          <span className="display text-2xl uppercase font-extrabold text-grit block leading-tight">
            I'll Build My Own
          </span>
          <p className="text-xs mt-1.5" style={{ color: "#8A8A8A" }}>Start with a blank week. Full control.</p>
        </button>
      </div>
    </>
  );
}

function PRStep({ onContinue }: { onContinue: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});

  function commit() {
    const today = new Date().toISOString().slice(0, 10);
    const manualPRs: Record<string, { value: number; reps?: number; date: string }> = {};
    for (const def of PR_CATALOG) {
      const n = Number(vals[def.id]);
      if (n > 0) {
        manualPRs[def.id] =
          def.kind === "1RM" ? { value: n, reps: 1, date: today } : { value: n, date: today };
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
      <p className="text-sm text-[#8a8a8a] mb-4">
        Drop your best lifts. Powers your athlete card. Leave blank to skip.
      </p>
      <div className="bg-grit-card border border-grit divide-y divide-[#262626] mb-6 overflow-y-auto" style={{ maxHeight: "55vh" }}>
        {PR_CATALOG.map((def) => {
          const unit = def.kind === "1RM" ? "kg" : def.kind === "REPS" ? "reps" : "sec";
          return (
            <div key={def.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-grit truncate">{def.label}</p>
                <p className="text-[10px] text-grit-dim leading-snug">{def.desc}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  value={vals[def.id] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [def.id]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="—"
                  className="input-grit w-20 text-right py-1.5"
                />
                <span className="label-cap text-[10px] text-grit-dim w-8">{unit}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <button onClick={commit} className="btn-grit">
          Continue
        </button>
        <button onClick={onContinue} className="btn-ghost">
          Skip
        </button>
      </div>
    </>
  );
}

function TourStep({ onContinue }: { onContinue: () => void }) {
  const tools = [
    { Icon: Zap, t: "YOUR SCHEDULE", d: "AI-built for your goal, equipment, and days available. Edit anytime.", where: "Train tab" },
    { Icon: Camera, t: "AI MEAL SCAN", d: "Snap your plate — get accurate calories and macros instantly.", where: "Diet tab" },
    { Icon: MessageSquare, t: "AI COACH", d: "24/7 strength and nutrition coach. Real answers, no fluff.", where: "Profile → Coach" },
    { Icon: Scan, t: "PHYSIQUE SCAN", d: "Upload a photo — AI maps your muscle imbalances and weak points to target. Pro feature.", where: "Train tab" },
    { Icon: Trophy, t: "PR CELEBRATIONS", d: "Log a new personal best and we make it a moment.", where: "After your workout" },
  ];
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">Your AI toolkit</h1>
      <p className="text-sm text-[#8a8a8a] mb-6">
        Built in. Always on. Find them anywhere you see the spark.
      </p>
      <div className="flex flex-col gap-3 mb-8">
        {tools.map(({ Icon, t, d, where }) => (
          <div
            key={t}
            className="p-4 flex gap-3"
            style={{
              background: "rgba(20,20,20,0.85)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{ background: "rgba(225,6,0,0.15)", color: "#E10600" }}
            >
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="label-cap text-sm text-grit">{t}</p>
              <p className="text-xs text-grit-dim mt-1 leading-relaxed">{d}</p>
              <p className="text-[10px] text-accent-red mt-1 label-cap">{where}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onContinue} className="btn-grit mt-auto" style={{ fontSize: "1rem", letterSpacing: "0.05em" }}>
        Start Training →
      </button>
    </>
  );
}
