import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { GritLogo } from "@/components/GritLogo";
import { setState } from "@/lib/storage";
import { defaultSchedule } from "@/lib/calc";
import type { Equipment, Experience, Gender, Goal, Profile, Weakness } from "@/lib/types";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "GRIT — Onboarding" }] }),
  component: Onboarding,
});

type Step =
  | "goal" | "experience" | "age" | "weight" | "height" | "gender"
  | "days" | "equipment" | "injuries" | "weakness" | "username" | "photo";

const ORDER: Step[] = ["goal","experience","age","weight","height","gender","days","equipment","injuries","weakness","username","photo"];

function Onboarding() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const step = ORDER[idx];

  function next(patch: Partial<Profile>) {
    const merged = { ...draft, ...patch };
    setDraft(merged);
    if (idx === ORDER.length - 1) {
      const p = { ...merged, startingWeightKg: merged.startingWeightKg ?? merged.weightKg } as Profile;
      setState((s) => ({ ...s, profile: p, schedule: defaultSchedule(p) }));
      navigate({ to: "/train", replace: true });
    } else {
      setIdx(idx + 1);
    }
  }

  return (
    <div className="min-h-screen bg-grit flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="px-6 pt-10 pb-6 flex items-center justify-between">
        <GritLogo className="text-3xl" />
        <span className="label-cap">{idx + 1} / {ORDER.length}</span>
      </div>
      <div className="px-6">
        <div className="h-1 bg-grit-card">
          <div className="h-1 bg-accent-red transition-all" style={{ width: `${((idx + 1) / ORDER.length) * 100}%` }} />
        </div>
      </div>
      <div className="flex-1 px-6 pt-10 pb-10 flex flex-col">
        {step === "goal" && <Choice title="What's your goal?" options={[
          { v: "BULK", l: "Bulk" }, { v: "CUT", l: "Cut" },
          { v: "MAINTAIN", l: "Maintain" }, { v: "ATHLETIC", l: "Athletic Performance" }
        ]} onPick={(v) => next({ goal: v as Goal })} />}
        {step === "experience" && <Choice title="Experience level" options={[
          { v: "BEGINNER", l: "Beginner" }, { v: "INTERMEDIATE", l: "Intermediate" }, { v: "ADVANCED", l: "Advanced" }
        ]} onPick={(v) => next({ experience: v as Experience })} />}
        {step === "age" && <Numeric title="Your age" suffix="yrs" min={13} max={90} onSubmit={(n) => next({ age: n })} />}
        {step === "weight" && <Numeric title="Your weight" suffix="kg" min={30} max={250} onSubmit={(n) => next({ weightKg: n })} />}
        {step === "height" && <Numeric title="Your height" suffix="cm" min={120} max={230} onSubmit={(n) => next({ heightCm: n })} />}
        {step === "gender" && <Choice title="Gender" options={[
          { v: "MALE", l: "Male" }, { v: "FEMALE", l: "Female" }, { v: "OTHER", l: "Other" }
        ]} onPick={(v) => next({ gender: v as Gender })} />}
        {step === "days" && <Choice title="Days per week you can train" options={[
          { v: "3", l: "3 days" }, { v: "4", l: "4 days" }, { v: "5", l: "5 days" }, { v: "6", l: "6 days" }
        ]} onPick={(v) => next({ daysPerWeek: Number(v) as 3|4|5|6 })} />}
        {step === "equipment" && <Choice title="Equipment access" options={[
          { v: "FULL_GYM", l: "Full Gym" }, { v: "HOME_GYM", l: "Home Gym" }, { v: "BODYWEIGHT", l: "Bodyweight Only" }
        ]} onPick={(v) => next({ equipment: v as Equipment })} />}
        {step === "injuries" && <Injuries onSubmit={(t) => next({ injuries: t })} onSkip={() => next({ injuries: "" })} />}
        {step === "weakness" && <Choice title="Your biggest weakness?" options={[
          { v: "STRENGTH", l: "Strength" },
          { v: "CONSISTENCY", l: "Consistency" },
          { v: "DIET", l: "Diet" },
          { v: "RECOVERY", l: "Recovery" },
        ]} onPick={(v) => next({ weakness: v as Weakness })} />}
        {step === "username" && <UsernameStep onSubmit={(u) => next({ username: u })} />}
        {step === "photo" && <PhotoStep onSubmit={(url) => next({ avatarDataUrl: url })} onSkip={() => next({})} />}
      </div>
    </div>
  );
}

function Choice({ title, options, onPick }: { title: string; options: { v: string; l: string }[]; onPick: (v: string) => void }) {
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-8">{title}</h1>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <button key={o.v} onClick={() => onPick(o.v)} className="bg-grit-card border border-grit p-5 text-left hover:border-accent-red transition-colors">
            <span className="display text-lg uppercase tracking-wide font-bold text-grit">{o.l}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Numeric({ title, suffix, min, max, onSubmit }: { title: string; suffix: string; min: number; max: number; onSubmit: (n: number) => void }) {
  const [v, setV] = useState("");
  const n = Number(v);
  const valid = v !== "" && n >= min && n <= max;
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-8">{title}</h1>
      <div className="flex items-end gap-3 mb-8">
        <input
          autoFocus inputMode="numeric" type="number"
          value={v} onChange={(e) => setV(e.target.value)}
          className="bg-transparent border-b-2 border-grit focus:border-accent-red outline-none text-6xl font-display font-extrabold text-grit w-40 pb-2"
          placeholder="0"
        />
        <span className="label-cap text-lg pb-3">{suffix}</span>
      </div>
      <button disabled={!valid} onClick={() => onSubmit(n)} className="btn-grit mt-auto">Continue</button>
    </>
  );
}

function Injuries({ onSubmit, onSkip }: { onSubmit: (s: string) => void; onSkip: () => void }) {
  const [v, setV] = useState("");
  return (
    <>
      <h1 className="display text-3xl font-extrabold uppercase text-grit mb-2">Injuries or limits?</h1>
      <p className="text-sm text-[#8a8a8a] mb-8">Optional. Skip if none.</p>
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={5} className="input-grit mb-4" placeholder="e.g. lower back tweak, bad knee..." />
      <div className="mt-auto flex flex-col gap-3">
        <button onClick={() => onSubmit(v)} className="btn-grit">Finish Setup</button>
        <button onClick={onSkip} className="btn-ghost">Skip</button>
      </div>
    </>
  );
}
