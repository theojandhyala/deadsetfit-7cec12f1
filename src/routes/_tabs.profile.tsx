import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Flame, LogOut, Crown } from "lucide-react";
import { useAppState } from "@/lib/storage";
import { calculateStreak } from "@/lib/calc";
import { GritLogo } from "@/components/GritLogo";

export const Route = createFileRoute("/_tabs/profile")({
  head: () => ({ meta: [{ title: "GRIT — Profile" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [state, set] = useAppState();
  const navigate = useNavigate();
  const p = state.profile;
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState<string>(p?.goal || "BULK");
  const [exp, setExp] = useState<string>(p?.experience || "BEGINNER");
  const [w, setW] = useState(String(p?.weightKg ?? ""));
  const [h, setH] = useState(String(p?.heightCm ?? ""));

  if (!p) return null;
  const streak = calculateStreak(state.completedDates);

  function save() {
    set((s) => s.profile ? ({ ...s, profile: {
      ...s.profile, goal: goal as typeof s.profile.goal, experience: exp as typeof s.profile.experience,
      weightKg: Number(w) || s.profile.weightKg, heightCm: Number(h) || s.profile.heightCm
    }}) : s);
    setEditing(false);
  }

  function reset() {
    if (!confirm("Reset all your GRIT data?")) return;
    localStorage.removeItem("grit_app_state_v1");
    navigate({ to: "/onboarding", replace: true });
  }

  return (
    <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <GritLogo className="text-2xl" />
        <button onClick={() => setEditing((v) => !v)} className="label-cap text-accent-red">{editing ? "Save" : "Edit"}</button>
      </header>

      {/* Streak */}
      <section className="px-5 mb-6">
        <div className="bg-grit-card border border-grit p-5 flex items-center gap-4">
          <Flame size={36} className="text-accent-red" />
          <div>
            <p className="label-cap">Streak</p>
            <p className="display text-4xl font-extrabold text-grit leading-none">{streak}<span className="text-base ml-2 text-[#8a8a8a]">days</span></p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Your Stats</p>
        <div className="bg-grit-card border border-grit divide-y divide-[#262626]">
          {editing ? (
            <>
              <Field label="Goal">
                <Select value={goal} onChange={setGoal} opts={["BULK","CUT","MAINTAIN","ATHLETIC"]} />
              </Field>
              <Field label="Experience">
                <Select value={exp} onChange={setExp} opts={["BEGINNER","INTERMEDIATE","ADVANCED"]} />
              </Field>
              <Field label="Weight"><input value={w} onChange={(e) => setW(e.target.value)} className="input-grit text-right" /></Field>
              <Field label="Height"><input value={h} onChange={(e) => setH(e.target.value)} className="input-grit text-right" /></Field>
              <div className="p-3"><button onClick={save} className="btn-grit w-full">Save Changes</button></div>
            </>
          ) : (
            <>
              <Stat label="Goal" v={p.goal} />
              <Stat label="Experience" v={p.experience} />
              <Stat label="Age" v={`${p.age} yrs`} />
              <Stat label="Weight" v={`${p.weightKg} kg`} />
              <Stat label="Height" v={`${p.heightCm} cm`} />
              <Stat label="Gender" v={p.gender} />
              <Stat label="Days / Week" v={String(p.daysPerWeek)} />
              <Stat label="Equipment" v={p.equipment.replace("_"," ")} />
              {p.injuries && <Stat label="Injuries" v={p.injuries} />}
            </>
          )}
        </div>
      </section>

      {/* Split overview */}
      <section className="px-5 mb-6">
        <p className="label-cap mb-2">Training Split</p>
        <div className="bg-grit-card border border-grit">
          {state.schedule && (["MON","TUE","WED","THU","FRI","SAT","SUN"] as const).map((d) => (
            <div key={d} className="px-4 py-3 border-b border-grit last:border-b-0 flex justify-between gap-3">
              <span className="label-cap">{d}</span>
              <span className="text-xs font-bold uppercase text-grit text-right">{state.schedule![d].label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* GRIT Pro */}
      <section className="px-5 mb-6">
        <div className="border border-accent-red p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2a0d0a 100%)" }}>
          <Crown size={20} className="text-accent-red mb-2" />
          <p className="display text-2xl font-extrabold uppercase text-grit">GRIT Pro</p>
          <p className="text-xs text-[#8a8a8a] mt-1 mb-4">AI coach, advanced analytics, custom splits, video form review.</p>
          <button className="btn-grit w-full">Upgrade — $9.99 / mo</button>
        </div>
      </section>

      <section className="px-5 mb-10">
        <button onClick={reset} className="btn-ghost w-full"><LogOut size={14} className="mr-2" /> Reset All Data</button>
      </section>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="label-cap">{label}</span>
      <span className="text-sm font-bold uppercase text-grit">{v}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 grid grid-cols-[100px_1fr] items-center gap-3">
      <span className="label-cap">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Select({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-grit">
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
